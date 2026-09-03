/**
 * POST /api/admin/simulate-event
 *
 * Admin shortcut: simulate an event directly against a badge ID.
 * Useful for the first demo without needing to know the external account.
 * Internally calls the same pipeline as the webhook endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventSource, EventStatus, AchievementType } from '@prisma/client';
import {
  qualifiesForSignal,
  resolveSignalAchievements,
  buildDualCustomState,
  SIGNAL_ACHIEVEMENTS,
} from '@/lib/rules-engine';
import type { SimulateEventBody } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SimulateEventBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { badgeId, eventType, contentId, secret } = body;

  if (secret !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (!badgeId || !eventType || !contentId) {
    return NextResponse.json(
      { error: 'badgeId, eventType, and contentId are required' },
      { status: 400 }
    );
  }

  const sourceEventId = `MOCK:admin:${badgeId}:${contentId}`;

  // Idempotency
  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: EventSource.MOCK, sourceEventId } },
  });
  if (existing) {
    return NextResponse.json({ status: 'duplicate', eventId: existing.id });
  }

  const badge = await db.badge.findUnique({
    where: { id: badgeId },
    include: { achievementProgress: true },
  });

  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  // Store event
  const event = await db.event.create({
    data: {
      source: EventSource.MOCK,
      sourceEventId,
      contentId,
      type: eventType,
      status: EventStatus.PENDING,
      payload: { simulated: true, badgeId },
      occurredAt: new Date(),
    },
  });

  // Qualification
  if (!qualifiesForSignal({ source: 'MOCK', type: eventType, externalUserId: 'admin', contentId, payload: {} })) {
    await db.event.update({ where: { id: event.id }, data: { status: EventStatus.REJECTED, rejectionReason: `${eventType} does not qualify`, processedAt: new Date() } });
    return NextResponse.json({ status: 'rejected', reason: `"${eventType}" does not count toward signal achievements.` });
  }

  const progressMap = new Map<AchievementType, number>(
    badge.achievementProgress.map((p) => [p.achievementType, p.level])
  );

  const signalProgress = badge.achievementProgress.find((p) => p.achievementType === AchievementType.FIRST_SIGNAL);
  const newSignalCount = (signalProgress?.progress ?? 0) + 1;
  const achievementChanges = resolveSignalAchievements(newSignalCount, progressMap);

  await db.$transaction(async (tx) => {
    for (const type of SIGNAL_ACHIEVEMENTS) {
      const change = achievementChanges.find((c) => c.achievementType === type);
      await tx.achievementProgress.update({
        where: { badgeId_achievementType: { badgeId: badge.id, achievementType: type } },
        data: { progress: newSignalCount, ...(change ? { level: 1, unlockedAt: new Date() } : {}) },
      });
    }

    await tx.event.update({ where: { id: event.id }, data: { status: EventStatus.PROCESSED, processedAt: new Date() } });

    if (achievementChanges.length > 0) {
      const unlockedSet = new Set<AchievementType>([
        ...badge.achievementProgress.filter((p) => p.level > 0).map((p) => p.achievementType),
        ...achievementChanges.map((c) => c.achievementType),
      ]);
      const dualState = buildDualCustomState(newSignalCount, unlockedSet, badge.identityTier, {
        isGenesis: badge.isGenesis,
        isStakeholder: badge.isStakeholder,
        isGovernor: badge.isGovernor,
      });
      await tx.badgeUpdate.create({ data: { badgeId: badge.id, requestedState: dualState, status: 'PENDING' } });
    }
  });

  return NextResponse.json({
    status: 'processed',
    eventId: event.id,
    badgeId: badge.id,
    signalCount: newSignalCount,
    achievementsUnlocked: achievementChanges.map((c) => c.achievementType),
    dualUpdateQueued: achievementChanges.length > 0,
  });
}
