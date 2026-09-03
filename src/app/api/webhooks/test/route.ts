/**
 * POST /api/webhooks/test
 *
 * Phase A simulated webhook — accepts a test payload and drives the full
 * event → rules → achievement pipeline without any real social source.
 *
 * Protected by a shared secret in the request body.
 * The mock Dual adapter is used here; M5 swaps it for the real DUAL client.
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
import type { WebhookTestBody } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: WebhookTestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Secret check ──────────────────────────────────────────────────────────
  if (body.secret !== process.env.WEBHOOK_TEST_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const { source = 'MOCK', eventType, externalUserId, contentId, payload = {} } = body;

  if (!eventType || !externalUserId || !contentId) {
    return NextResponse.json(
      { error: 'eventType, externalUserId, and contentId are required' },
      { status: 400 }
    );
  }

  const sourceEventId = `${source}:${externalUserId}:${contentId}`;

  // ── Idempotency check ─────────────────────────────────────────────────────
  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: source as EventSource, sourceEventId } },
  });
  if (existing) {
    return NextResponse.json({
      status: 'duplicate',
      message: 'Event already processed — rejected as duplicate.',
      eventId: existing.id,
      originalStatus: existing.status,
    });
  }

  // ── Find linked external account ──────────────────────────────────────────
  const externalAccount = await db.externalAccount.findUnique({
    where: { source_externalUserId: { source: source as EventSource, externalUserId } },
    include: { user: { include: { badge: { include: { achievementProgress: true } } } } },
  });

  // ── Store event (pending) ─────────────────────────────────────────────────
  const event = await db.event.create({
    data: {
      source: source as EventSource,
      sourceEventId,
      contentId,
      externalAccountId: externalAccount?.id ?? null,
      type: eventType,
      status: EventStatus.PENDING,
      payload: payload as object,
      occurredAt: new Date(),
    },
  });

  // ── No linked account → reject ────────────────────────────────────────────
  if (!externalAccount?.user?.badge) {
    await db.event.update({
      where: { id: event.id },
      data: { status: EventStatus.REJECTED, rejectionReason: 'No linked badge for this external account', processedAt: new Date() },
    });
    return NextResponse.json({
      status: 'rejected',
      reason: 'No linked badge found for this external user ID.',
      eventId: event.id,
    });
  }

  const badge = externalAccount.user.badge;

  // ── Qualification check ───────────────────────────────────────────────────
  const incomingEvent = { source, type: eventType, externalUserId, contentId, payload };
  if (!qualifiesForSignal(incomingEvent)) {
    await db.event.update({
      where: { id: event.id },
      data: { status: EventStatus.REJECTED, rejectionReason: `Event type ${eventType} does not qualify for signal`, processedAt: new Date() },
    });
    return NextResponse.json({
      status: 'rejected',
      reason: `Event type "${eventType}" does not count toward signal achievements.`,
      eventId: event.id,
    });
  }

  // ── Rules engine ──────────────────────────────────────────────────────────
  const progressMap = new Map<AchievementType, number>(
    badge.achievementProgress.map((p) => [p.achievementType, p.level])
  );

  // signal_count = sum of AMPLIFIER_I progress (we use FIRST_SIGNAL progress as the counter)
  const signalProgress = badge.achievementProgress.find(
    (p) => p.achievementType === AchievementType.FIRST_SIGNAL
  );
  const currentSignalCount = signalProgress?.progress ?? 0;
  const newSignalCount = currentSignalCount + 1;

  const achievementChanges = resolveSignalAchievements(newSignalCount, progressMap);

  // ── Persist progress + badge changes ──────────────────────────────────────
  await db.$transaction(async (tx) => {
    // Increment signal count on FIRST_SIGNAL row (we use it as the master counter)
    for (const type of SIGNAL_ACHIEVEMENTS) {
      const current = badge.achievementProgress.find((p) => p.achievementType === type);
      const change = achievementChanges.find((c) => c.achievementType === type);
      await tx.achievementProgress.update({
        where: { badgeId_achievementType: { badgeId: badge.id, achievementType: type } },
        data: {
          progress: newSignalCount,
          ...(change ? { level: 1, unlockedAt: new Date() } : {}),
        },
      });
    }

    // Mark event processed
    await tx.event.update({
      where: { id: event.id },
      data: { status: EventStatus.PROCESSED, processedAt: new Date() },
    });

    // Queue a badge update if any achievements unlocked
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

      await tx.badgeUpdate.create({
        data: {
          badgeId: badge.id,
          requestedState: dualState,
          status: 'PENDING',
        },
      });
    }
  });

  return NextResponse.json({
    status: 'processed',
    eventId: event.id,
    badgeId: badge.id,
    signalCount: newSignalCount,
    achievementsUnlocked: achievementChanges.map((c) => c.achievementType),
    dualUpdateQueued: achievementChanges.length > 0,
    message:
      achievementChanges.length > 0
        ? `Achievement(s) unlocked: ${achievementChanges.map((c) => c.achievementType).join(', ')}. DUAL badge update queued.`
        : `Signal count now ${newSignalCount}. No new achievements yet.`,
  });
}
