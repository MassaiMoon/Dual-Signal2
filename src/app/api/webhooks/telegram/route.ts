/**
 * POST /api/webhooks/telegram
 *
 * Receives Telegram Bot API updates for the community group.
 * Tracks one "active day" event per user per calendar day, then
 * increments telegramActiveDays on their badge and queues a DUAL write.
 *
 * Security: Telegram signs every request with the secret_token set via setWebhook.
 * We verify the X-Telegram-Bot-Api-Secret-Token header.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN       — bot token from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET  — arbitrary secret set when calling setWebhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventSource, EventStatus } from '@prisma/client';
import {
  resolveXSignalLevel,
  resolveTelegramLevel,
  resolveGovernanceLevel,
  resolveHolderLevel,
  computeSignalScore,
  buildRequestedState,
} from '@/lib/rules-engine';
import { calculateTier } from '@/lib/config';
import { runPendingUpdates } from '@/lib/update-worker';

export const dynamic = 'force-dynamic';

// Telegram always expects HTTP 200, even on errors — returning non-200 causes retries.
const ok = () => NextResponse.json({ ok: true }, { status: 200 });

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat:  { id: number; type: string };
    date:  number;
    text?: string;
  };
}

export async function POST(req: NextRequest) {
  // ── Verify secret ─────────────────────────────────────────────────────────
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn('[telegram-webhook] Invalid or missing secret token');
    return ok(); // always 200 so Telegram doesn't retry
  }

  let update: TelegramUpdate;
  try { update = await req.json(); }
  catch { return ok(); }

  const msg = update.message;

  // Only handle messages from real users with a Telegram username
  if (!msg || !msg.from || !msg.from.username) return ok();

  const telegramUserId = msg.from.id;
  const username       = msg.from.username.toLowerCase();
  const msgDate        = new Date(msg.date * 1000);
  const dateStr        = msgDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const sourceEventId  = `${telegramUserId}:${dateStr}`;    // one per user per day

  // ── Idempotency — already counted today ──────────────────────────────────
  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: EventSource.TELEGRAM, sourceEventId } },
  });
  if (existing) return ok();

  // ── Find badge by telegram handle ────────────────────────────────────────
  const badge = await db.badge.findFirst({
    where: { telegramHandle: { equals: username, mode: 'insensitive' } },
  });

  // ── Record event (regardless of badge match) ──────────────────────────────
  await db.event.create({
    data: {
      source:         EventSource.TELEGRAM,
      sourceEventId,
      contentId:      username,
      type:           'MESSAGE_DAY',
      status:         badge ? EventStatus.PROCESSED : EventStatus.REJECTED,
      rejectionReason: badge ? null : `no badge linked to @${username}`,
      payload:        {
        telegramUserId,
        username,
        date:   dateStr,
        chatId: msg.chat.id,
        chatType: msg.chat.type,
      },
      occurredAt:     msgDate,
      processedAt:    badge ? new Date() : null,
    },
  });

  if (!badge) {
    console.log(`[telegram-webhook] @${username} sent a message but has no linked badge`);
    return ok();
  }

  // ── Increment active days + recompute score ───────────────────────────────
  const newTgDays = (badge.telegramActiveDays ?? 0) + 1;

  const newXLvl   = resolveXSignalLevel(badge.xSignalImpressions);
  const newTgLvl  = resolveTelegramLevel(newTgDays);
  const newGovLvl = resolveGovernanceLevel(badge.governanceVotes);
  const newHldLvl = resolveHolderLevel(badge.holderQualDays);
  const newScore  = computeSignalScore(newXLvl, newTgLvl, newGovLvl, newHldLvl);
  const newTier   = calculateTier(newScore);

  const stateChanged =
    newTgLvl  !== badge.telegramLevel ||
    newScore  !== badge.signalScore;

  await db.$transaction(async (tx) => {
    await tx.badge.update({
      where: { id: badge.id },
      data: {
        telegramActiveDays: newTgDays,
        telegramLevel:      newTgLvl,
        xSignalLevel:       newXLvl,
        governanceLevel:    newGovLvl,
        holderLevel:        newHldLvl,
        signalScore:        newScore,
        cachedTier:         newTier as any,
      },
    });

    if (stateChanged) {
      await tx.badgeUpdate.create({
        data: {
          badgeId:        badge.id,
          requestedState: buildRequestedState(newScore, newTier, newXLvl, newTgLvl, newGovLvl, newHldLvl),
          status:         'PENDING',
        },
      });
    }
  });

  console.log(
    `[telegram-webhook] @${username} day=${newTgDays} tgLvl=${newTgLvl} score=${newScore} tier=${newTier} stateChanged=${stateChanged}`,
  );

  // Auto-flush to DUAL if write credentials present
  if (stateChanged && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
    runPendingUpdates().catch(err =>
      console.error('[telegram-webhook] flush error:', err),
    );
  }

  return ok();
}
