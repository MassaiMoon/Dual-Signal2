/**
 * POST /api/admin/governance/activity
 *
 * Manually record a governance activity (e.g. POLL_PARTICIPATION).
 * Protected by ADMIN_TOKEN bearer auth.
 *
 * Body:
 *   {
 *     badgeId:      string;
 *     activityType: "POLL_PARTICIPATION" | "COMMENT" | "TOPIC_CREATED" | "FORMAL_PROPOSAL";
 *     topicId:      number;
 *     topicUrl:     string;
 *     occurredAt?:  string; // ISO date, defaults to now
 *     adminNote?:   string;
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider, GovernanceActivityType, GovernanceActivityStatus, GovernanceActivitySource } from '@prisma/client';
import { GOVERNANCE_ACTIVITY_POINTS } from '@/lib/config';
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

const POINTS_BY_TYPE: Record<string, number> = {
  POLL_PARTICIPATION: GOVERNANCE_ACTIVITY_POINTS.pollParticipation,
  TOPIC_CREATED:      GOVERNANCE_ACTIVITY_POINTS.topicCreated,
  FORMAL_PROPOSAL:    GOVERNANCE_ACTIVITY_POINTS.formalProposal,
  COMMENT:            GOVERNANCE_ACTIVITY_POINTS.firstComment,
};

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    badgeId:      string;
    activityType: string;
    topicId:      number;
    topicUrl:     string;
    occurredAt?:  string;
    adminNote?:   string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { badgeId, activityType, topicId, topicUrl, occurredAt, adminNote } = body;
  if (!badgeId || !activityType || !topicId) {
    return NextResponse.json({ error: 'badgeId, activityType, topicId required' }, { status: 400 });
  }

  const pointsAwarded = POINTS_BY_TYPE[activityType];
  if (pointsAwarded === undefined) {
    return NextResponse.json({ error: `Unknown activityType: ${activityType}` }, { status: 400 });
  }

  // Look up the forum account for this badge to get forumUserId
  const badge = await db.badge.findUnique({
    where: { id: badgeId },
    select: {
      userId: true,
      governanceActivityPoints: true,
      governanceLevel:          true,
      signalScore:              true,
      telegramActiveDays:       true,
      discordActiveDays:        true,
      xSignalPublicViews:       true,
      xQualifyingPosts:         true,
    },
  });
  if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

  const forumAcct = await db.externalAccount.findFirst({
    where: { userId: badge.userId, source: Provider.DUAL_FORUM },
  });
  const forumUserId   = forumAcct ? parseInt(forumAcct.externalUserId, 10) : 0;
  const forumUsername = forumAcct?.handle ?? 'manual';

  // Use a stable postId so the unique constraint prevents duplicates on re-save
  const postId = `manual_${activityType.toLowerCase()}_${topicId}_${badgeId}`;

  try {
    await db.governanceActivity.create({
      data: {
        badgeId,
        forumUserId:   forumUserId > 0 ? forumUserId : 0,
        forumUsername,
        topicId,
        postId,
        activityType:  activityType as GovernanceActivityType,
        pointsAwarded,
        occurredAt:    occurredAt ? new Date(occurredAt) : new Date(),
        topicUrl:      topicUrl ?? '',
        status:        GovernanceActivityStatus.MANUAL,
        source:        GovernanceActivitySource.MANUAL_ADMIN,
        verifiedBy:    'admin',
        verifiedAt:    new Date(),
        adminNote:     adminNote ?? null,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Activity already recorded for this topic' }, { status: 409 });
    }
    throw e;
  }

  // Recompute badge totals
  const agg = await db.governanceActivity.aggregate({
    where:  { badgeId, status: { not: GovernanceActivityStatus.DELETED } },
    _sum:   { pointsAwarded: true },
  });
  const totalPoints = agg._sum.pointsAwarded ?? 0;

  const newGovLvl = resolveGovernanceLevel(totalPoints);
  const newTgLvl  = resolveTelegramLevel(badge.telegramActiveDays);
  const newDcLvl  = resolveDiscordLevel(badge.discordActiveDays);
  const newXLvl   = resolveXSignalLevel(badge.xSignalPublicViews, badge.xQualifyingPosts);
  const newScore  = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
  const newTier   = calculateTier(newScore);

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
