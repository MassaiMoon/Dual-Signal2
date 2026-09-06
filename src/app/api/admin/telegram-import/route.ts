/**
 * GET  /api/admin/telegram-import  — list all import jobs
 * POST /api/admin/telegram-import  — upload + parse + dry-run / commit
 *
 * Accepts multipart/form-data with:
 *   file     — one or more Telegram Desktop export files (.html or .json)
 *              For HTML: upload messages.html, messages2.html, …  (field name "file", multiple)
 *              For JSON: upload result.json (single file, field name "file")
 *   dryRun   — "true" | "false"  (default: "false")
 *
 * HTML identity matching priority:
 *   0. Previous LINKED TelegramImportIdentity with same telegramUserId (persistent link memory)
 *   1. ExternalAccount(TELEGRAM, externalUserId = @username)   — HIGH confidence
 *   2. ExternalAccount(TELEGRAM, externalUserId = from_id)     — JSON numeric ID (HIGH)
 *   3. ExternalAccount(TELEGRAM, handle = username)            — handle fallback
 *   4. Display-name only match → AMBIGUOUS (requires admin confirmation)
 *   5. Unmatched → stored in TelegramImportIdentity for admin review
 *
 * Idempotency:
 *   TelegramActiveDay has @@unique([badgeId, day]).
 *   createMany with skipDuplicates ensures the same day is never double-counted.
 *
 * Privacy:
 *   Raw message text is NOT stored. Parsed in memory and discarded immediately.
 *   Stored per identity: telegramUserId key, display name, UTC dates.
 *
 * File size limit: 15 MB per file, max 20 HTML files per session.
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
import {
  parseTelegramHtmlExport,
  MAX_HTML_FILE_BYTES,
  MAX_HTML_FILES,
  type HtmlParsedExport,
  type HtmlIdentityAggregate,
} from '@/lib/telegram-html-parser';
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

  const dryRun = formData.get('dryRun') === 'true';

  // Accept multiple "file" entries (for HTML multi-file upload) and a single JSON
  const rawFiles = formData.getAll('file');
  const files    = rawFiles.filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No file uploaded (field name: "file")' }, { status: 400 });
  }

  // Detect format by first file extension
  const isHtml = files[0].name.toLowerCase().endsWith('.html');
  const isJson = files[0].name.toLowerCase().endsWith('.json');

  if (!isHtml && !isJson) {
    return NextResponse.json({ error: 'Expected .html or .json file(s) from Telegram Desktop export' }, { status: 400 });
  }

  // ── 2a. Parse HTML export ────────────────────────────────────────────────
  let parsed: ReturnType<typeof parseTelegramExport> | HtmlParsedExport;
  let isHtmlImport = false;

  if (isHtml) {
    if (files.length > MAX_HTML_FILES) {
      return NextResponse.json({ error: `Too many files (max ${MAX_HTML_FILES})` }, { status: 400 });
    }
    for (const f of files) {
      if (f.size > MAX_HTML_FILE_BYTES) {
        return NextResponse.json({ error: `File ${f.name} exceeds size limit (max ${MAX_HTML_FILE_BYTES / 1024 / 1024} MB)` }, { status: 413 });
      }
    }
    const htmlFiles = await Promise.all(
      files.map(async (f) => ({ name: f.name, content: await f.text() })),
    );
    try {
      parsed = parseTelegramHtmlExport(htmlFiles);
    } catch (err) {
      return NextResponse.json({ error: `HTML parse error: ${err instanceof Error ? err.message : err}` }, { status: 422 });
    }
    isHtmlImport = true;

  // ── 2b. Parse JSON export ────────────────────────────────────────────────
  } else {
    const file = files[0];
    if (file.size > MAX_EXPORT_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_EXPORT_BYTES / 1024 / 1024} MB)` }, { status: 413 });
    }
    let rawJson: unknown;
    try { rawJson = JSON.parse(await file.text()); }
    catch { return NextResponse.json({ error: 'File is not valid JSON' }, { status: 400 }); }
    const shapeError = validateExportShape(rawJson);
    if (shapeError) return NextResponse.json({ error: shapeError }, { status: 422 });
    try { parsed = parseTelegramExport(rawJson); }
    catch (err) {
      return NextResponse.json({ error: `Parse error: ${err instanceof Error ? err.message : err}` }, { status: 422 });
    }
  }

  // ── 3. Match identities to DUAL users ────────────────────────────────────
  const { matched, unmatched, ambiguous } = await matchIdentities(parsed.identities, isHtmlImport);

  // ── 4. Compute what would change (for dry run preview AND commit stats) ───
  const preview = await computePreview(matched);

  // HTML-specific stats
  const htmlFiles   = isHtmlImport ? (parsed as HtmlParsedExport).htmlFiles : undefined;
  const strongMatches = isHtmlImport
    ? matched.filter(m => (m.identity as HtmlIdentityAggregate).identityConfidence !== 'LOW').length
    : matched.length;
  const weakMatches   = matched.length - strongMatches;

  // ── 5. Dry run: return preview without writing ────────────────────────────
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      format:             isHtmlImport ? 'html' : 'json',
      htmlFiles,
      chatName:           parsed.chatName,
      totalMessages:      parsed.totalMessages,
      qualifyingMessages: parsed.qualifyingMessages,
      dateRange:          parsed.dateRange,
      uniqueIdentities:   parsed.identities.length,
      matchedUsers:       matched.length,
      strongMatches,
      weakMatches,
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
  const importFilename = files.length === 1
    ? files[0].name
    : `${files[0].name} (+${files.length - 1} more)`;

  let importRecord;
  try {
    importRecord = await db.telegramImport.create({
      data: {
        filename:          importFilename,
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
    `[tg-import] file=${importFilename} format=${isHtmlImport ? 'html' : 'json'} created=${totalCreated} dups=${totalDups}` +
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

async function matchIdentities(identities: TelegramIdentityAggregate[], isHtml = false) {
  const matched:   MatchedIdentity[] = [];
  const unmatched: TelegramIdentityAggregate[] = [];
  const ambiguous: TelegramIdentityAggregate[] = [];

  // Load all TELEGRAM ExternalAccounts into memory to avoid N+1 queries
  const allTgAccounts = await db.externalAccount.findMany({
    where: { source: Provider.TELEGRAM },
    include: { user: { include: { badge: { select: { id: true } } } } },
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

  // Priority 0: load all previously LINKED identities (persistent link memory).
  // When an admin manually links an HTML identity, all future imports with the
  // same telegramUserId key auto-resolve without admin action.
  const linkedIdentities = await db.telegramImportIdentity.findMany({
    where: { status: { in: ['LINKED', 'MATCHED'] }, matchedBadgeId: { not: null }, matchedUserId: { not: null } },
    select: { telegramUserId: true, matchedUserId: true, matchedBadgeId: true },
    distinct: ['telegramUserId'],
  });
  const linkedByKey = new Map<string, { userId: string; badgeId: string }>();
  for (const l of linkedIdentities) {
    if (l.matchedUserId && l.matchedBadgeId) {
      linkedByKey.set(l.telegramUserId.toLowerCase(), { userId: l.matchedUserId, badgeId: l.matchedBadgeId });
    }
  }

  for (const identity of identities) {
    const userId    = identity.telegramUserId;
    const htmlIdent = identity as HtmlIdentityAggregate;
    const confidence = htmlIdent.identityConfidence; // undefined for JSON (treated as HIGH)

    let resolvedUserId  = '';
    let resolvedBadgeId = '';
    let matchReason     = '';

    // Priority 0: persistent link memory from previous imports
    const prevLink = linkedByKey.get(userId.toLowerCase());
    if (prevLink) {
      resolvedUserId  = prevLink.userId;
      resolvedBadgeId = prevLink.badgeId;
      matchReason     = 'persistent_link';
    }

    // Priority 1: exact externalUserId match (JSON "user123..." or HTML "@username")
    if (!resolvedUserId) {
      const numericId = userId.startsWith('user') ? userId.slice(4) : userId;
      const strippedAt = userId.startsWith('@') ? userId.slice(1) : userId;

      const p1 = byExternalUserId.get(userId.toLowerCase())
        ?? byExternalUserId.get(numericId.toLowerCase())
        ?? byExternalUserId.get(strippedAt.toLowerCase())
        ?? [];
      if (p1.length > 0) {
        const uniqueUsers = new Set(p1.map(c => c.userId));
        if (uniqueUsers.size === 1 && p1[0].user?.badge) {
          resolvedUserId  = p1[0].userId;
          resolvedBadgeId = p1[0].user.badge.id;
          matchReason     = 'providerUserId';
        } else if (uniqueUsers.size > 1) {
          ambiguous.push(identity);
          continue;
        }
      }
    }

    // Priority 2: handle lookup by @username (for HTML HIGH/MEDIUM confidence)
    if (!resolvedUserId && identity.telegramUserId.startsWith('@')) {
      const handleKey = identity.telegramUserId.slice(1).toLowerCase();
      const p2 = byHandleLower.get(handleKey) ?? [];
      if (p2.length > 0) {
        const uniqueUsers = new Set(p2.map(c => c.userId));
        if (uniqueUsers.size === 1 && p2[0].user?.badge) {
          resolvedUserId  = p2[0].userId;
          resolvedBadgeId = p2[0].user.badge.id;
          matchReason     = 'handle';
        } else if (uniqueUsers.size > 1) {
          ambiguous.push(identity);
          continue;
        }
      }
    }

    // Priority 3: display name fallback for JSON (handle = display name, often @username)
    if (!resolvedUserId && !isHtml) {
      const handleKey = identity.displayName.replace(/^@/, '').toLowerCase();
      const p3 = byHandleLower.get(handleKey) ?? [];
      if (p3.length > 0) {
        const uniqueUsers = new Set(p3.map(c => c.userId));
        if (uniqueUsers.size === 1 && p3[0].user?.badge) {
          resolvedUserId  = p3[0].userId;
          resolvedBadgeId = p3[0].user.badge.id;
          matchReason     = 'handle';
        } else if (uniqueUsers.size > 1) {
          ambiguous.push(identity);
          continue;
        }
      }
    }

    // Priority 4 (HTML LOW confidence only): display-name match → AMBIGUOUS unless only 1 badge exists
    // We do NOT auto-award on display-name alone — mark for admin review.
    if (!resolvedUserId && isHtml && confidence === 'LOW') {
      // Try display name as handle key but always mark AMBIGUOUS regardless of match count
      // so admin must confirm it's the right person.
      ambiguous.push(identity);
      continue;
    }

    if (!resolvedUserId) {
      unmatched.push(identity);
      continue;
    }

    // Determine which days are new
    const existingDays = await db.telegramActiveDay.findMany({
      where: { badgeId: resolvedBadgeId },
      select: { day: true },
    });
    const existingSet = new Set(existingDays.map(d => d.day.toISOString().slice(0, 10)));
    const newDates = identity.activeDates.filter(d => !existingSet.has(d));

    matched.push({
      identity,
      userId:      resolvedUserId,
      badgeId:     resolvedBadgeId,
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
