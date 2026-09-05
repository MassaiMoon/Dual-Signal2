/**
 * GET  /api/admin/telegram-import  — list all import jobs
 * POST /api/admin/telegram-import  — upload + parse + dry-run / commit
 *
 * Accepts multipart/form-data with:
 *   file    — result.json from Telegram Desktop export
 *   dryRun  — "true" | "false"  (default: "false")
 *
 * Identity matching priority:
 *   1. ExternalAccount(TELEGRAM, externalUserId = from_id)    — immutable numeric ID
 *   2. ExternalAccount(TELEGRAM, externalUserId = handle.lower) — legacy handle storage
 *   3. ExternalAccount(TELEGRAM, handle = username)            — normalized fallback
 *   4. Unmatched → stored in TelegramImportIdentity for admin review
 *
 * Idempotency:
 *   TelegramActiveDay has @@unique([badgeId, day]).
 *   createMany with skipDuplicates ensures the same day is never double-counted.
 *
 * Privacy:
 *   Raw message text is NOT stored. We store only:
 *     Telegram user ID, display name, UTC dates, first message ID per day.
 *   The uploaded file is parsed in memory and discarded immediately.
 *
 * File size limit: 15 MB (enforced server-side).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider } from '@prisma/client';
import {
  parseTelegramExport,
  validateExportShape,
  MAX_EXPORT_BYTES,
  type TelegramIdentityAggregate,
} from '@/lib/telegram-parser';
import { recalculateTelegramForBadge } from '@/lib/telegram-recalculate';

export const dynamic = 'force-dynamic';

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_TOKEN}`;
}

// ─── GET — list imports ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const imports = await db.telegramImport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, filename: true, status: true, isDryRun: true,
      messageCount: true, matchedUsers: true, unmatchedUsers: true,
      activeDaysCreated: true, duplicatesIgnored: true,
      importedWeekStart: true, importedWeekEnd: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ imports });
}

// ─── POST — upload + process ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── 1. Parse multipart form ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file   = formData.get('file');
  const dryRun = formData.get('dryRun') === 'true';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded (field name: "file")' }, { status: 400 });
  }
  if (file.size > MAX_EXPORT_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_EXPORT_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }
  if (!file.name.toLowerCase().endsWith('.json')) {
    return NextResponse.json({ error: 'Expected a .json file (Telegram Desktop JSON export)' }, { status: 400 });
  }

  // ── 2. Parse JSON ────────────────────────────────────────────────────────
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: 'File is not valid JSON' }, { status: 400 });
  }

  const shapeError = validateExportShape(rawJson);
  if (shapeError) return NextResponse.json({ error: shapeError }, { status: 422 });

  let parsed;
  try {
    parsed = parseTelegramExport(rawJson);
  } catch (err) {
    return NextResponse.json({ error: `Parse error: ${err instanceof Error ? err.message : err}` }, { status: 422 });
  }

  // ── 3. Match identities to DUAL users ────────────────────────────────────
  const { matched, unmatched, ambiguous } = await matchIdentities(parsed.identities);

  // ── 4. Compute what would change (for dry run preview AND commit stats) ───
  const preview = await computePreview(matched);

  // ── 5. Dry run: return preview without writing ────────────────────────────
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      chatName:           parsed.chatName,
      totalMessages:      parsed.totalMessages,
      qualifyingMessages: parsed.qualifyingMessages,
      dateRange:          parsed.dateRange,
      uniqueIdentities:   parsed.identities.length,
      matchedUsers:       matched.length,
      unmatchedUsers:     unmatched.length + ambiguous.length,
      ambiguousUsers:     ambiguous.length,
      wouldCreateDays:    preview.newDays,
      wouldIgnoreDups:    preview.dupDays,
      wouldChangeLevel:   preview.levelChanges,
      wouldChangeTier:    preview.tierChanges,
      sampleMatched:      matched.slice(0, 5).map(m => ({
        telegramUserId: m.identity.telegramUserId,
        displayName:    m.identity.displayName,
        newDays:        m.newDays,
        totalDays:      m.existingDays + m.newDays,
      })),
      sampleUnmatched: unmatched.slice(0, 5).map(u => ({
        telegramUserId: u.telegramUserId,
        displayName:    u.displayName,
        uniqueDays:     u.activeDates.length,
        messageCount:   u.messageCount,
      })),
    });
  }

  // ── 6. Commit ────────────────────────────────────────────────────────────
  let importRecord;
  try {
    importRecord = await db.telegramImport.create({
      data: {
        filename:          file.name,
        messageCount:      parsed.totalMessages,
        matchedUsers:      matched.length,
        unmatchedUsers:    unmatched.length + ambiguous.length,
        activeDaysCreated: 0,  // updated after inserts
        duplicatesIgnored: 0,
        importedWeekStart: parsed.dateRange.min || null,
        importedWeekEnd:   parsed.dateRange.max || null,
        status:            'COMPLETED',
        isDryRun:          false,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: `DB error creating import record: ${err}` }, { status: 500 });
  }

  let totalCreated = 0;
  let totalDups    = 0;
  const affectedBadgeIds = new Set<string>();
  const recalcResults: ReturnType<typeof recalculateTelegramForBadge> extends Promise<infer R> ? R[] : never[] = [];

  // Insert TelegramActiveDay rows for matched users
  for (const m of matched) {
    if (m.newDays === 0) continue;

    const rows = m.newDates.map((day) => ({
      badgeId:               m.badgeId,
      day:                   new Date(day + 'T00:00:00.000Z'),
      sourceImportId:        importRecord.id,
      telegramProviderUserId: m.identity.telegramUserId,
      firstMessageId:        null,
    }));

    // skipDuplicates = idempotent replay
    const result = await db.telegramActiveDay.createMany({ data: rows, skipDuplicates: true });
    totalCreated += result.count;
    totalDups    += rows.length - result.count;
    if (result.count > 0) affectedBadgeIds.add(m.badgeId);
  }

  // Create TelegramImportIdentity records for all observed users (matched + unmatched)
  const allIdentities = [
    ...matched.map(m => ({
      importId:       importRecord.id,
      telegramUserId: m.identity.telegramUserId,
      handle:         m.identity.displayName,
      displayName:    m.identity.displayName,
      messageCount:   m.identity.messageCount,
      uniqueDays:     m.identity.activeDates.length,
      firstSeenDate:  m.identity.firstSeenDate,
      lastSeenDate:   m.identity.lastSeenDate,
      activeDates:    m.identity.activeDates,
      matchedUserId:  m.userId,
      matchedBadgeId: m.badgeId,
      matchReason:    m.matchReason,
      status:         'MATCHED' as const,
    })),
    ...unmatched.map(u => ({
      importId:       importRecord.id,
      telegramUserId: u.telegramUserId,
      handle:         u.displayName,
      displayName:    u.displayName,
      messageCount:   u.messageCount,
      uniqueDays:     u.activeDates.length,
      firstSeenDate:  u.firstSeenDate,
      lastSeenDate:   u.lastSeenDate,
      activeDates:    u.activeDates,
      matchedUserId:  null,
      matchedBadgeId: null,
      matchReason:    null,
      status:         'UNMATCHED' as const,
    })),
    ...ambiguous.map(u => ({
      importId:       importRecord.id,
      telegramUserId: u.telegramUserId,
      handle:         u.displayName,
      displayName:    u.displayName,
      messageCount:   u.messageCount,
      uniqueDays:     u.activeDates.length,
      firstSeenDate:  u.firstSeenDate,
      lastSeenDate:   u.lastSeenDate,
      activeDates:    u.activeDates,
      matchedUserId:  null,
      matchedBadgeId: null,
      matchReason:    'ambiguous',
      status:         'AMBIGUOUS' as const,
    })),
  ];

  await db.telegramImportIdentity.createMany({ data: allIdentities, skipDuplicates: true });

  // Recalculate affected badges
  for (const badgeId of affectedBadgeIds) {
    try {
      const r = await recalculateTelegramForBadge(badgeId);
      recalcResults.push(r as never);
    } catch (err) {
      console.error(`[tg-import] recalc failed for badge ${badgeId}:`, err);
    }
  }

  // Update import record with final counts
  await db.telegramImport.update({
    where: { id: importRecord.id },
    data: {
      activeDaysCreated: totalCreated,
      duplicatesIgnored: totalDups,
    },
  });

  const levelChanges = (recalcResults as { stateChanged: boolean }[]).filter(r => r.stateChanged).length;

  console.log(
    `[tg-import] file=${file.name} created=${totalCreated} dups=${totalDups}` +
    ` matched=${matched.length} unmatched=${unmatched.length + ambiguous.length}` +
    ` badgesRecalculated=${affectedBadgeIds.size} levelChanges=${levelChanges}`,
  );

  return NextResponse.json({
    dryRun:            false,
    importId:          importRecord.id,
    chatName:          parsed.chatName,
    totalMessages:     parsed.totalMessages,
    qualifyingMessages: parsed.qualifyingMessages,
    matchedUsers:      matched.length,
    unmatchedUsers:    unmatched.length + ambiguous.length,
    activeDaysCreated: totalCreated,
    duplicatesIgnored: totalDups,
    badgesRecalculated: affectedBadgeIds.size,
    levelChanges,
  }, { status: 201 });
}

// ─── Identity matching ────────────────────────────────────────────────────────

interface MatchedIdentity {
  identity:    TelegramIdentityAggregate;
  userId:      string;
  badgeId:     string;
  matchReason: string;
  existingDays: number;
  newDays:     number;
  newDates:    string[];
}

async function matchIdentities(identities: TelegramIdentityAggregate[]) {
  const matched:   MatchedIdentity[] = [];
  const unmatched: TelegramIdentityAggregate[] = [];
  const ambiguous: TelegramIdentityAggregate[] = [];

  // Load all TELEGRAM ExternalAccounts into memory to avoid N+1 queries
  const allTgAccounts = await db.externalAccount.findMany({
    where: { source: Provider.TELEGRAM },
    include: { user: { include: { badge: { select: { id: true, telegramActiveDays: true } } } } },
  });

  // Build lookup maps
  const byExternalUserId = new Map<string, typeof allTgAccounts[0][]>();
  const byHandleLower    = new Map<string, typeof allTgAccounts[0][]>();

  for (const acct of allTgAccounts) {
    const eid = acct.externalUserId.toLowerCase();
    if (!byExternalUserId.has(eid)) byExternalUserId.set(eid, []);
    byExternalUserId.get(eid)!.push(acct);

    const hl = acct.handle.toLowerCase();
    if (!byHandleLower.has(hl)) byHandleLower.set(hl, []);
    byHandleLower.get(hl)!.push(acct);
  }

  for (const identity of identities) {
    const userId = identity.telegramUserId; // e.g. "user123456789"
    // Numeric part only (e.g. "123456789") for legacy matching
    const numericId = userId.startsWith('user') ? userId.slice(4) : userId;

    let candidates: typeof allTgAccounts[0][] = [];
    let matchReason = '';

    // Priority 1: exact externalUserId match (full "user123..." or numeric "123...")
    const p1 = byExternalUserId.get(userId.toLowerCase()) ??
                byExternalUserId.get(numericId.toLowerCase()) ?? [];
    if (p1.length > 0) {
      candidates  = p1;
      matchReason = 'providerUserId';
    }

    // Priority 2: handle match (handles in Telegram exports = display name, often @username)
    if (candidates.length === 0) {
      // Strip @ prefix if present
      const handleKey = identity.displayName.replace(/^@/, '').toLowerCase();
      const p2 = byHandleLower.get(handleKey) ?? [];
      if (p2.length > 0) {
        candidates  = p2;
        matchReason = 'handle';
      }
    }

    // Still no match
    if (candidates.length === 0) {
      unmatched.push(identity);
      continue;
    }

    // Ambiguous: multiple different users could match this Telegram identity
    const uniqueUsers = new Set(candidates.map(c => c.userId));
    if (uniqueUsers.size > 1) {
      ambiguous.push(identity);
      continue;
    }

    const acct  = candidates[0];
    const badge = acct.user?.badge;
    if (!badge || !acct.user) {
      unmatched.push(identity);
      continue;
    }

    // Determine which days are new (not already in TelegramActiveDay for this badge)
    const existingDays = await db.telegramActiveDay.findMany({
      where: { badgeId: badge.id },
      select: { day: true },
    });
    const existingSet = new Set(
      existingDays.map(d => d.day.toISOString().slice(0, 10)),
    );
    const newDates = identity.activeDates.filter(d => !existingSet.has(d));

    matched.push({
      identity,
      userId:       acct.userId,
      badgeId:      badge.id,
      matchReason,
      existingDays: existingDays.length,
      newDays:      newDates.length,
      newDates,
    });
  }

  return { matched, unmatched, ambiguous };
}

// ─── Preview computation ──────────────────────────────────────────────────────

interface PreviewResult {
  newDays:      number;
  dupDays:      number;
  levelChanges: number;
  tierChanges:  number;
}

async function computePreview(matched: MatchedIdentity[]): Promise<PreviewResult> {
  let newDays  = 0;
  let dupDays  = 0;
  let levelChanges = 0;
  let tierChanges  = 0;

  for (const m of matched) {
    newDays += m.newDays;
    dupDays += m.identity.activeDates.length - m.newDays;

    if (m.newDays > 0) {
      // Peek at what the new level would be
      const { resolveTelegramLevel, resolveXSignalLevel, resolveDiscordLevel, resolveGovernanceLevel, computeSignalScore } = await import('@/lib/rules-engine');
      const { calculateTier } = await import('@/lib/config');

      const badge = await db.badge.findUnique({ where: { id: m.badgeId } });
      if (!badge) continue;

      const newTotalDays = m.existingDays + m.newDays;
      const newTgLvl     = resolveTelegramLevel(newTotalDays);
      const newScore     = computeSignalScore(
        resolveXSignalLevel(badge.xSignalPublicViews, badge.xQualifyingPosts),
        newTgLvl,
        resolveDiscordLevel(badge.discordActiveDays),
        resolveGovernanceLevel(badge.governanceVotes),
      );

      if (newTgLvl  !== badge.telegramLevel) levelChanges++;
      if (calculateTier(newScore) !== badge.cachedTier) tierChanges++;
    }
  }

  return { newDays, dupDays, levelChanges, tierChanges };
}
