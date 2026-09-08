/**
 * Discord bot — pure message handler logic.
 *
 * Accepts a db client as parameter so tests can inject a mock without
 * importing discord.js at all. No Discord.js types referenced here.
 */

import type { PrismaClient } from '@prisma/client';
import { recalculateDiscordForBadge } from '../src/lib/discord-recalculate';

export interface MessageEvent {
  authorBot:      boolean;
  authorWebhookId: string | null;
  authorUsername: string;
  guildId:        string | null;
  channelId:      string;
}

export function normalizeHandle(username: string): string {
  return username.trim().toLowerCase();
}

export async function findBadgeByDiscordHandle(
  db: PrismaClient,
  handle: string,
): Promise<{ id: string } | null> {
  const normalized = normalizeHandle(handle);
  return db.badge.findFirst({
    where: { discordHandle: normalized },
    select: { id: true },
  });
}

export async function recordActiveDay(
  db: PrismaClient,
  badgeId: string,
  day: Date,
  discordHandle: string,
  guildId: string,
  channelId: string,
): Promise<{ created: boolean }> {
  const existing = await db.discordActiveDay.findUnique({
    where: { badgeId_day: { badgeId, day } },
    select: { id: true },
  });
  if (existing) return { created: false };

  await db.discordActiveDay.create({
    data: { badgeId, day, discordHandle, guildId, channelId },
  });

  await recalculateDiscordForBadge(badgeId);

  return { created: true };
}

export async function processDiscordMessage(
  db: PrismaClient,
  event: MessageEvent,
): Promise<{ skipped: boolean; reason?: string; created?: boolean }> {
  if (event.authorBot) {
    return { skipped: true, reason: 'bot' };
  }
  if (event.authorWebhookId) {
    return { skipped: true, reason: 'webhook' };
  }
  if (!event.guildId) {
    return { skipped: true, reason: 'dm' };
  }

  const handle = normalizeHandle(event.authorUsername);
  const badge  = await findBadgeByDiscordHandle(db, handle);
  if (!badge) {
    return { skipped: true, reason: 'no_badge' };
  }

  // Day in UTC (Date-only)
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const { created } = await recordActiveDay(
    db,
    badge.id,
    day,
    handle,
    event.guildId,
    event.channelId,
  );

  return { skipped: false, created };
}
