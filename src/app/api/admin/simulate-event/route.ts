/**
 * POST /api/admin/simulate-event
 *
 * Simulate a track event against a badge for demo/testing.
 * Increments the track's progress counter, recalculates level and Signal Score,
 * and queues a DUAL badge update if state changed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventSource, EventStatus } from '@prisma/client';
import { achievementConfig, calculateTier } from '@/lib/config';
import type { SimulateEventBody } from '@/types';

export const dynamic = 'force-dynamic';

// ─── Track level resolvers ─────────────────────────────────────────────────────

function resolveXSignalLevel(impressions: number): number {
  const levels = achievementConfig.xSignal;
  let lvl = 0;
  for (const l of levels) {
    if ('impressions' in l && impressions >= l.impressions) lvl = l.level;
    else if ('qualifyingPosts' in l && impressions >= 1) lvl = Math.max(lvl, 1);
  }
  return lvl;
}

function resolveTelegramLevel(activeDays: number): number {
  let lvl = 0;
  for (const l of achievementConfig.telegramPresence) {
    if (activeDays >= l.activeDays) lvl = l.level;
  }
  return lvl;
}

function resolveGovernanceLevel(votes: number): number {
  let lvl = 0;
  for (const l of achievementConfig.governance) {
    if (votes >= l.votes) lvl = l.level;
  }
  return lvl;
}

function resolveHolderLevel(qualDays: number): number {
  let lvl = 0;
  for (const l of achievementConfig.holderStaking) {
    if (qualDays >= l.qualifyingDays) lvl = l.level;
  }
  return lvl;
}

function computeSignalScore(xLvl: number, tgLvl: number, govLvl: number, hldLvl: number): number {
  const xPts  = achievementConfig.xSignal[xLvl - 1]?.points  ?? 0;
  const tgPts = achievementConfig.telegramPresence[tgLvl - 1]?.points ?? 0;
  const govPts= achievementConfig.governance[govLvl - 1]?.points ?? 0;
  const hldPts= achievementConfig.holderStaking[hldLvl - 1]?.points ?? 0;
  return xPts + tgPts + govPts + hldPts;
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SimulateEventBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { badgeId, track, contentId, secret, progress } = body;

  if (secret !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }
  if (!badgeId || !track || !contentId) {
    return NextResponse.json({ error: 'badgeId, track, and contentId are required' }, { status: 400 });
  }

  const sourceEventId = `MOCK:${track}:${badgeId}:${contentId}`;

  // Idempotency
  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: EventSource.MOCK, sourceEventId } },
  });
  if (existing) return NextResponse.json({ status: 'duplicate', eventId: existing.id });

  const badge = await db.badge.findUnique({ where: { id: badgeId } });
  if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

  // Record the event
  const event = await db.event.create({
    data: {
      source: EventSource.MOCK,
      sourceEventId,
      contentId,
      type: `SIMULATE_${track.toUpperCase()}`,
      status: EventStatus.PENDING,
      payload: { simulated: true, badgeId, track },
      occurredAt: new Date(),
    },
  });

  // Compute new progress for the affected track
  const newX   = track === 'xSignal'       ? (progress ?? badge.xSignalImpressions + 1) : badge.xSignalImpressions;
  const newTg  = track === 'telegram'      ? (progress ?? badge.telegramActiveDays + 1)  : badge.telegramActiveDays;
  const newGov = track === 'governance'    ? (progress ?? badge.governanceVotes + 1)      : badge.governanceVotes;
  const newHld = track === 'holderStaking' ? (progress ?? badge.holderQualDays + 1)       : badge.holderQualDays;

  const newXLvl  = resolveXSignalLevel(newX);
  const newTgLvl = resolveTelegramLevel(newTg);
  const newGovLvl= resolveGovernanceLevel(newGov);
  const newHldLvl= resolveHolderLevel(newHld);
  const newScore = computeSignalScore(newXLvl, newTgLvl, newGovLvl, newHldLvl);
  const newTier  = calculateTier(newScore);

  const stateChanged =
    newXLvl   !== badge.xSignalLevel    ||
    newTgLvl  !== badge.telegramLevel   ||
    newGovLvl !== badge.governanceLevel ||
    newHldLvl !== badge.holderLevel     ||
    newScore  !== badge.signalScore;

  await db.$transaction(async (tx) => {
    await tx.badge.update({
      where: { id: badge.id },
      data: {
        xSignalImpressions: newX,
        telegramActiveDays: newTg,
        governanceVotes:    newGov,
        holderQualDays:     newHld,
        xSignalLevel:       newXLvl,
        telegramLevel:      newTgLvl,
        governanceLevel:    newGovLvl,
        holderLevel:        newHldLvl,
        signalScore:        newScore,
        cachedTier:         newTier as any,
      },
    });

    await tx.event.update({
      where: { id: event.id },
      data: { status: EventStatus.PROCESSED, processedAt: new Date() },
    });

    if (stateChanged) {
      await tx.badgeUpdate.create({
        data: {
          badgeId: badge.id,
          requestedState: {
            signal_score:     String(newScore),
            identity_tier:    newTier,
            x_signal_level:   String(newXLvl),
            telegram_level:   String(newTgLvl),
            governance_level: String(newGovLvl),
            holder_level:     String(newHldLvl),
          },
          status: 'PENDING',
        },
      });
    }
  });

  return NextResponse.json({
    status:       'processed',
    eventId:      event.id,
    badgeId:      badge.id,
    track,
    signalScore:  newScore,
    tier:         newTier,
    levels: { xSignal: newXLvl, telegram: newTgLvl, governance: newGovLvl, holderStaking: newHldLvl },
    dualUpdateQueued: stateChanged,
  });
}
