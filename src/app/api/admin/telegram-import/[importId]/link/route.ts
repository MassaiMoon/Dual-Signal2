/**
 * POST /api/admin/telegram-import/[importId]/link
 *
 * Manually links an UNMATCHED or AMBIGUOUS Telegram identity to a DUAL user.
 * After linking, retroactively creates TelegramActiveDay rows for the user's
 * badge from ALL historical imports where this Telegram identity appeared.
 * Then triggers badge recalculation.
 *
 * Body: { identityId, userId }
 *   identityId — TelegramImportIdentity.id
 *   userId     — DUAL User.id to link to
 *
 * Protected by ADMIN_TOKEN.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recalculateTelegramForBadge } from '@/lib/telegram-recalculate';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { importId } = await params;

  let body: { identityId: string; userId: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { identityId, userId } = body;
  if (!identityId || !userId) {
    return NextResponse.json({ error: 'identityId and userId are required' }, { status: 400 });
  }

  // Fetch identity and verify it belongs to this import
  const identity = await db.telegramImportIdentity.findFirst({
    where: { id: identityId, importId },
  });
  if (!identity) {
    return NextResponse.json({ error: 'Identity not found in this import' }, { status: 404 });
  }
  if (identity.status === 'MATCHED') {
    return NextResponse.json({ error: 'Identity is already matched — cannot re-link' }, { status: 409 });
  }

  // Verify the target user exists and has a badge
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { badge: { select: { id: true } } },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!user.badge) return NextResponse.json({ error: 'User has no Passport badge yet' }, { status: 404 });

  const badgeId = user.badge.id;

  // Collect all dates from ALL past imports for this Telegram user ID
  const allIdentities = await db.telegramImportIdentity.findMany({
    where: { telegramUserId: identity.telegramUserId },
    select: { activeDates: true },
  });

  const allDatesSet = new Set<string>();
  for (const ident of allIdentities) {
    const dates = ident.activeDates as string[];
    for (const d of dates) allDatesSet.add(d);
  }

  const allDates = [...allDatesSet].sort();

  // Create TelegramActiveDay rows for all collected dates (idempotent)
  const rows = allDates.map((day) => ({
    badgeId,
    day:                    new Date(day + 'T00:00:00.000Z'),
    sourceImportId:         importId,
    telegramProviderUserId: identity.telegramUserId,
    firstMessageId:         null,
  }));

  const created = rows.length > 0
    ? await db.telegramActiveDay.createMany({ data: rows, skipDuplicates: true })
    : { count: 0 };

  // Update all identity records for this Telegram user to LINKED
  await db.telegramImportIdentity.updateMany({
    where: { telegramUserId: identity.telegramUserId },
    data: {
      matchedUserId:  userId,
      matchedBadgeId: badgeId,
      matchReason:    'admin_link',
      status:         'LINKED',
    },
  });

  // Recalculate badge
  const recalc = await recalculateTelegramForBadge(badgeId);

  console.log(
    `[tg-link] identity=${identityId} → user=${userId} badge=${badgeId}` +
    ` datesCreated=${created.count}/${allDates.length} stateChanged=${recalc.stateChanged}`,
  );

  return NextResponse.json({
    linked:       true,
    userId,
    badgeId,
    datesLinked:  allDates.length,
    daysCreated:  created.count,
    recalc: {
      previousDays:  recalc.previousDays,
      newDays:       recalc.newDays,
      previousLevel: recalc.previousLevel,
      newLevel:      recalc.newLevel,
      previousScore: recalc.previousScore,
      newScore:      recalc.newScore,
      stateChanged:  recalc.stateChanged,
    },
  });
}
