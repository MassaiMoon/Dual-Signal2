/**
 * Rules Engine
 *
 * Central scoring and event-processing logic. Used by:
 *   - /api/admin/simulate-event  (inline for MOCK events)
 *   - /api/cron/process-events   (batch for PENDING events)
 */

import { db } from './db';
import { achievementConfig, calculateTier } from './config';
import { EventStatus, UpdateStatus, type Badge, type Event } from '@prisma/client';

// ─── Level resolvers ──────────────────────────────────────────────────────────

export function resolveXSignalLevel(publicViews: number, qualifyingPosts: number): number {
  let lvl = 0;
  for (const l of achievementConfig.xSignal) {
    if (l.level === 1) {
      if (qualifyingPosts >= (l as { qualifyingPosts: number }).qualifyingPosts) lvl = 1;
    } else {
      const threshold = 'publicViews' in l ? (l as { publicViews: number }).publicViews : 0;
      // Levels are sequential — higher levels require the previous level to be reached first
      if (lvl >= l.level - 1 && publicViews >= threshold) lvl = l.level;
    }
  }
  return lvl;
}

export function resolveTelegramLevel(activeDays: number): number {
  let lvl = 0;
  for (const l of achievementConfig.telegramPresence) {
    if (activeDays >= l.activeDays) lvl = l.level;
  }
  return lvl;
}

export function resolveDiscordLevel(activeDays: number): number {
  let lvl = 0;
  for (const l of achievementConfig.discord) {
    if (activeDays >= l.activeDays) lvl = l.level;
  }
  return lvl;
}

export function resolveGovernanceLevel(participations: number): number {
  let lvl = 0;
  for (const l of achievementConfig.governance) {
    if (participations >= l.participations) lvl = l.level;
  }
  return lvl;
}

export function computeSignalScore(
  xLvl:    number,
  tgLvl:   number,
  dcLvl:   number,
  govLvl:  number,
): number {
  const xPts   = achievementConfig.xSignal[xLvl - 1]?.points           ?? 0;
  const tgPts  = achievementConfig.telegramPresence[tgLvl - 1]?.points  ?? 0;
  const dcPts  = achievementConfig.discord[dcLvl - 1]?.points           ?? 0;
  const govPts = achievementConfig.governance[govLvl - 1]?.points       ?? 0;
  return xPts + tgPts + dcPts + govPts;
}

// ─── Badge state builder ──────────────────────────────────────────────────────

export function buildRequestedState(
  score:  number,
  tier:   string,
  xLvl:   number,
  tgLvl:  number,
  dcLvl:  number,
  govLvl: number,
): Record<string, string> {
  return {
    signal_score:     String(score),
    identity_tier:    tier,
    x_signal_level:   String(xLvl),
    telegram_level:   String(tgLvl),
    discord_level:    String(dcLvl),
    governance_level: String(govLvl),
  };
}

// ─── DUAL event processor ─────────────────────────────────────────────────────

interface DualPayload {
  event_type?: string;
  type?:       string;
  object_id?:  string;
  id?:         string;
  owner?:      string;
  occurred_at?: string;
  integrity_hash?: string;
  custom?:     Record<string, string>;
  [key: string]: unknown;
}

export async function processDualEvent(event: Event): Promise<'processed' | 'rejected'> {
  const payload   = event.payload as DualPayload;
  const eventType = (payload.event_type ?? payload.type ?? '').toLowerCase();
  const objectId  = event.contentId;

  if (!objectId) {
    console.warn(`[rules-engine] DUAL event ${event.id} has no object_id — rejecting`);
    await markEvent(event.id, EventStatus.REJECTED, 'no object_id');
    return 'rejected';
  }

  const badge = await db.badge.findFirst({ where: { dualObjectId: objectId } });
  if (!badge) {
    console.warn(`[rules-engine] No badge found for dualObjectId=${objectId}`);
    await markEvent(event.id, EventStatus.REJECTED, 'badge not found');
    return 'rejected';
  }

  if (eventType === 'mint') {
    await handleDualMint(event, badge, payload);
  } else if (eventType === 'update') {
    await handleDualUpdate(event, badge, payload);
  } else {
    console.log(`[rules-engine] DUAL event type="${eventType}" — no rule, marking processed`);
    await markEvent(event.id, EventStatus.PROCESSED);
  }

  return 'processed';
}

async function handleDualMint(event: Event, badge: Badge, payload: DualPayload) {
  const updates: Partial<Badge> = {};

  if (payload.owner && !badge.walletAddress) {
    updates.walletAddress = payload.owner;
  }
  if (payload.occurred_at && !badge.memberSince) {
    const d = new Date(payload.occurred_at);
    updates.memberSince = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  await db.$transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx.badge.update({ where: { id: badge.id }, data: updates as any });
    }
    await tx.event.update({
      where: { id: event.id },
      data: { status: EventStatus.PROCESSED, processedAt: new Date() },
    });
  });

  console.log(`[rules-engine] DUAL mint processed for badge ${badge.id}`);
}

async function handleDualUpdate(event: Event, badge: Badge, payload: DualPayload) {
  const pending = await db.badgeUpdate.findFirst({
    where: { badgeId: badge.id, status: UpdateStatus.PENDING },
    orderBy: { createdAt: 'asc' },
  });

  await db.$transaction(async (tx) => {
    if (pending) {
      await tx.badgeUpdate.update({
        where: { id: pending.id },
        data: {
          status:       UpdateStatus.COMPLETED,
          dualActionId: payload.integrity_hash ?? 'confirmed',
        },
      });
      if (payload.integrity_hash) {
        await tx.badge.update({
          where: { id: badge.id },
          data:  { lastIntegrityHash: payload.integrity_hash },
        });
      }
    }
    await tx.event.update({
      where: { id: event.id },
      data: { status: EventStatus.PROCESSED, processedAt: new Date() },
    });
  });

  console.log(`[rules-engine] DUAL update confirmed for badge ${badge.id}, badgeUpdate=${pending?.id ?? 'none'}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function markEvent(id: string, status: EventStatus, reason?: string) {
  await db.event.update({
    where: { id },
    data: {
      status,
      processedAt:     new Date(),
      ...(reason ? { rejectionReason: reason } : {}),
    },
  });
}
