/**
 * DELETE /api/admin/governance/activity/[activityId]
 *
 * Void a MANUAL_ADMIN governance evidence item.
 * Soft-deletes (sets status = DELETED) — historical record is preserved.
 * Recalculates governance totals and queues a DUAL update if state changed.
 *
 * Only MANUAL_ADMIN source activities may be voided through this endpoint.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GovernanceActivitySource, GovernanceActivityStatus } from '@prisma/client';
import {
  resolveGovernanceLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveXSignalLevel,
  computeSignalScore,
  buildRequestedState,
} from '@/lib/rules-engine';
import { calculateTier } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { activityId } = await params;

  const activity = await db.governanceActivity.findUnique({
    where: { id: activityId },
  });
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }
  if (activity.source !== GovernanceActivitySource.MANUAL_ADMIN) {
    return NextResponse.json(
      { error: 'Only MANUAL_ADMIN evidence items can be voided through this endpoint.' },
      { status: 403 },
    );
  }
  if (activity.status === GovernanceActivityStatus.DELETED) {
    return NextResponse.json({ error: 'Activity already voided.' }, { status: 409 });
  }

  // Soft-delete — record is preserved for audit
  await db.governanceActivity.update({
    where: { id: activityId },
    data:  { status: GovernanceActivityStatus.DELETED },
  });

  const badgeId = activity.badgeId;

  // Recalculate from remaining active evidence
  const [agg, badge] = await Promise.all([
    db.governanceActivity.aggregate({
      where: { badgeId, status: { not: GovernanceActivityStatus.DELETED } },
      _sum:  { pointsAwarded: true },
    }),
    db.badge.findUnique({
      where: { id: badgeId },
      select: {
        governanceActivityPoints: true,
        governanceLevel:          true,
        signalScore:              true,
        telegramActiveDays:       true,
        discordActiveDays:        true,
        xSignalPublicViews:       true,
        xQualifyingPosts:         true,
      },
    }),
  ]);

  if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

  const totalPoints = agg._sum.pointsAwarded ?? 0;
  const newGovLvl   = resolveGovernanceLevel(totalPoints);
  const newTgLvl    = resolveTelegramLevel(badge.telegramActiveDays);
  const newDcLvl    = resolveDiscordLevel(badge.discordActiveDays);
  const newXLvl     = resolveXSignalLevel(badge.xSignalPublicViews, badge.xQualifyingPosts);
  const newScore    = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
  const newTier     = calculateTier(newScore);

  const stateChanged =
    totalPoints !== badge.governanceActivityPoints ||
    newGovLvl   !== badge.governanceLevel          ||
    newScore    !== badge.signalScore;

  await db.$transaction(async tx => {
    await tx.badge.update({
      where: { id: badgeId },
      data: {
        governanceActivityPoints: totalPoints,
        governanceLevel:          newGovLvl,
        telegramLevel:            newTgLvl,
        discordLevel:             newDcLvl,
        xSignalLevel:             newXLvl,
        signalScore:              newScore,
        cachedTier:               newTier as any,
      },
    });
    if (stateChanged) {
      await tx.badgeUpdate.create({
        data: {
          badgeId,
          requestedState: buildRequestedState(newScore, newTier, newXLvl, newTgLvl, newDcLvl, newGovLvl),
          status: 'PENDING',
        },
      });
    }
  });

  return NextResponse.json({
    ok:              true,
    totalPoints,
    governanceLevel: newGovLvl,
    signalScore:     newScore,
    tier:            newTier,
    stateChanged,
  });
}
