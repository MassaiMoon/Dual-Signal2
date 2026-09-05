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
import { calculateTier } from '@/lib/config';
import {
  resolveXSignalLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveGovernanceLevel,
  computeSignalScore,
  buildRequestedState,
} from '@/lib/rules-engine';
import type { SimulateEventBody } from '@/types';

export const dynamic = 'force-dynamic';

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

  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: EventSource.MOCK, sourceEventId } },
  });
  if (existing) return NextResponse.json({ status: 'duplicate', eventId: existing.id });

  const badge = await db.badge.findUnique({ where: { id: badgeId } });
  if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

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
  const newViews     = track === 'xSignal'   ? (progress ?? badge.xSignalPublicViews + 1) : badge.xSignalPublicViews;
  const newPosts     = track === 'xSignal'   ? badge.xQualifyingPosts + 1                 : badge.xQualifyingPosts;
  const newTg        = track === 'telegram'  ? (progress ?? badge.telegramActiveDays + 1) : badge.telegramActiveDays;
  const newDc        = track === 'discord'   ? (progress ?? badge.discordActiveDays + 1)  : badge.discordActiveDays;
  const newGov       = track === 'governance'? (progress ?? badge.governanceVotes + 1)    : badge.governanceVotes;

  const newXLvl   = resolveXSignalLevel(newViews, newPosts);
  const newTgLvl  = resolveTelegramLevel(newTg);
  const newDcLvl  = resolveDiscordLevel(newDc);
  const newGovLvl = resolveGovernanceLevel(newGov);
  const newScore  = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
  const newTier   = calculateTier(newScore);

  const stateChanged =
    newXLvl   !== badge.xSignalLevel    ||
    newTgLvl  !== badge.telegramLevel   ||
    newDcLvl  !== badge.discordLevel    ||
    newGovLvl !== badge.governanceLevel ||
    newScore  !== badge.signalScore;

  await db.$transaction(async (tx) => {
    await tx.badge.update({
      where: { id: badge.id },
      data: {
        xSignalPublicViews: newViews,
        xQualifyingPosts:   newPosts,
        telegramActiveDays: newTg,
        discordActiveDays:  newDc,
        governanceVotes:    newGov,
        xSignalLevel:       newXLvl,
        telegramLevel:      newTgLvl,
        discordLevel:       newDcLvl,
        governanceLevel:    newGovLvl,
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
          badgeId:        badge.id,
          requestedState: buildRequestedState(newScore, newTier, newXLvl, newTgLvl, newDcLvl, newGovLvl),
          status:         'PENDING',
        },
      });
    }
  });

  return NextResponse.json({
    status:          'processed',
    eventId:         event.id,
    badgeId:         badge.id,
    track,
    signalScore:     newScore,
    tier:            newTier,
    levels: { xSignal: newXLvl, telegram: newTgLvl, discord: newDcLvl, governance: newGovLvl },
    dualUpdateQueued: stateChanged,
  });
}
