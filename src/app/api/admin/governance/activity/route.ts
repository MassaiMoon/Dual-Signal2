/**
 * POST /api/admin/governance/activity
 *
 * Manually record a governance activity for a SIGNAL member.
 * Protected by ADMIN_TOKEN bearer auth.
 *
 * Body:
 *   {
 *     badgeId:      string;
 *     activityType: "POLL_PARTICIPATION" | "COMMENT" | "TOPIC_CREATED" | "FORMAL_PROPOSAL";
 *     topicUrl:     string;              // required — used for dedup + audit
 *     topicId?:     number;              // optional — derived from topicUrl if omitted
 *     occurredAt?:  string;             // ISO date, defaults to now
 *     adminNote?:   string;
 *   }
 *
 * Point rules (enforced by server — admin never types a point value):
 *   POLL_PARTICIPATION         → +5
 *   COMMENT (first in topic)   → +3
 *   COMMENT (additional)       → +1
 *   COMMENT (topic cap = 5 pts) → 0 (rejected)
 *   TOPIC_CREATED              → +10
 *   FORMAL_PROPOSAL            → +20
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider, GovernanceActivityType, GovernanceActivityStatus, GovernanceActivitySource } from '@prisma/client';
import { GOVERNANCE_ACTIVITY_POINTS } from '@/lib/config';
import {
  computeCommentPoints,
  resolveGovernanceLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveXSignalLevel,
  computeSignalScore,
  buildRequestedState,
} from '@/lib/rules-engine';
import { calculateTier } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Derive a numeric topicId from a Discourse-style URL. Falls back to URL hash. */
function topicIdFromUrl(url: string): number {
  const m = url.match(/\/t\/(?:[^/]+\/)?(\d+)/);
  if (m) return parseInt(m[1], 10);
  // Deterministic hash for non-Discourse URLs (e.g. Snapshot proposals)
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = Math.imul(31, h) + url.charCodeAt(i) | 0;
  }
  return Math.abs(h) || 1;
}

const FIXED_POINTS: Partial<Record<GovernanceActivityType, number>> = {
  POLL_PARTICIPATION: GOVERNANCE_ACTIVITY_POINTS.pollParticipation,
  TOPIC_CREATED:      GOVERNANCE_ACTIVITY_POINTS.topicCreated,
  FORMAL_PROPOSAL:    GOVERNANCE_ACTIVITY_POINTS.formalProposal,
};

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    badgeId:      string;
    activityType: string;
    topicUrl:     string;
    topicId?:     number;
    occurredAt?:  string;
    adminNote?:   string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { badgeId, activityType, topicUrl, occurredAt, adminNote } = body;

  if (!badgeId || !activityType || !topicUrl?.trim()) {
    return NextResponse.json({ error: 'badgeId, activityType, topicUrl required' }, { status: 400 });
  }

  const validTypes = ['POLL_PARTICIPATION', 'COMMENT', 'TOPIC_CREATED', 'FORMAL_PROPOSAL'];
  if (!validTypes.includes(activityType)) {
    return NextResponse.json({ error: `Unknown activityType: ${activityType}` }, { status: 400 });
  }

  const topicId = body.topicId ?? topicIdFromUrl(topicUrl.trim());

  // Fetch badge counters needed for recalculation
  const badge = await db.badge.findUnique({
    where: { id: badgeId },
    select: {
      userId:                   true,
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
  const forumUserId   = forumAcct ? (parseInt(forumAcct.externalUserId, 10) || 0) : 0;
  const forumUsername = forumAcct?.handle ?? 'manual';

  // ── Determine points awarded ──────────────────────────────────────────────────

  let pointsAwarded: number;
  let postId: string;

  if (activityType === 'COMMENT') {
    // Sum existing active comment points for this badge+topic to auto-determine +3/+1/0
    const existing = await db.governanceActivity.aggregate({
      where: {
        badgeId,
        topicId,
        activityType: GovernanceActivityType.COMMENT,
        status:       { not: GovernanceActivityStatus.DELETED },
      },
      _sum:   { pointsAwarded: true },
      _count: { id: true },
    });
    const existingPoints = existing._sum.pointsAwarded ?? 0;
    const existingCount  = existing._count.id;

    pointsAwarded = computeCommentPoints(existingPoints);
    if (pointsAwarded === 0) {
      return NextResponse.json(
        { error: `Comment cap reached for this topic (${existingPoints}/5 pts). No more comment points can be awarded.` },
        { status: 409 },
      );
    }

    postId = `manual_comment_${topicId}_seq${existingCount + 1}_${badgeId}`;
  } else {
    pointsAwarded = FIXED_POINTS[activityType as GovernanceActivityType]!;
    postId = `manual_${activityType.toLowerCase()}_${topicId}_${badgeId}`;
  }

  // ── Write evidence record ─────────────────────────────────────────────────────

  try {
    await db.governanceActivity.create({
      data: {
        badgeId,
        forumUserId,
        forumUsername,
        topicId,
        postId,
        activityType:  activityType as GovernanceActivityType,
        pointsAwarded,
        occurredAt:    occurredAt ? new Date(occurredAt) : new Date(),
        topicUrl:      topicUrl.trim(),
        status:        GovernanceActivityStatus.MANUAL,
        source:        GovernanceActivitySource.MANUAL_ADMIN,
        verifiedBy:    'admin',
        verifiedAt:    new Date(),
        adminNote:     adminNote ?? null,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { error: 'This exact activity is already recorded for this member and topic.' },
        { status: 409 },
      );
    }
    throw e;
  }

  // ── Recalculate badge totals ──────────────────────────────────────────────────

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
    pointsAwarded,
    totalPoints,
    governanceLevel: newGovLvl,
    signalScore:     newScore,
    tier:            newTier,
    stateChanged,
  });
}
