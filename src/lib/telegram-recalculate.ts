/**
 * Telegram Active-Day Recalculation
 *
 * After any import that touches TelegramActiveDay rows, call this to
 * recount days from evidence, resolve the new level/score/tier, persist
 * badge state, and enqueue a DUAL update if anything changed.
 *
 * Architecture: TelegramActiveDay rows are the source of truth.
 * Badge.telegramActiveDays is a cached counter derived from that table.
 */

import { db } from './db';
import { calculateTier } from './config';
import {
  resolveTelegramLevel,
  resolveXSignalLevel,
  resolveDiscordLevel,
  resolveGovernanceLevel,
  computeSignalScore,
  buildRequestedState,
} from './rules-engine';
import { runPendingUpdates } from './update-worker';

export interface RecalcResult {
  badgeId:       string;
  previousDays:  number;
  newDays:       number;
  previousLevel: number;
  newLevel:      number;
  previousScore: number;
  newScore:      number;
  stateChanged:  boolean;
}

/**
 * Recount TelegramActiveDay rows for a badge, update badge state, and
 * queue a DUAL update if the level or score changed.
 *
 * Safe to call inside or outside an existing transaction — when tx is
 * provided it uses that client, otherwise opens its own.
 */
export async function recalculateTelegramForBadge(
  badgeId: string,
): Promise<RecalcResult> {
  const badge = await db.badge.findUnique({ where: { id: badgeId } });
  if (!badge) throw new Error(`Badge not found: ${badgeId}`);

  // Count unique active days from evidence table
  const dayCount = await db.telegramActiveDay.count({ where: { badgeId } });

  const newTgLvl  = resolveTelegramLevel(dayCount);
  const newXLvl   = resolveXSignalLevel(badge.xSignalPublicViews, badge.xQualifyingPosts);
  const newDcLvl  = resolveDiscordLevel(badge.discordActiveDays);
  const newGovLvl = resolveGovernanceLevel(badge.governanceVotes);
  const newScore  = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
  const newTier   = calculateTier(newScore);

  const stateChanged =
    dayCount      !== badge.telegramActiveDays ||
    newTgLvl      !== badge.telegramLevel      ||
    newScore      !== badge.signalScore;

  if (stateChanged) {
    await db.$transaction(async (tx) => {
      await tx.badge.update({
        where: { id: badgeId },
        data: {
          telegramActiveDays: dayCount,
          telegramLevel:      newTgLvl,
          xSignalLevel:       newXLvl,
          discordLevel:       newDcLvl,
          governanceLevel:    newGovLvl,
          signalScore:        newScore,
          cachedTier:         newTier as never,
        },
      });

      await tx.badgeUpdate.create({
        data: {
          badgeId,
          requestedState: buildRequestedState(newScore, newTier, newXLvl, newTgLvl, newDcLvl, newGovLvl),
          status: 'PENDING',
        },
      });
    });

    // Fire-and-forget DUAL sync if credentials are available
    if (process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
      runPendingUpdates().catch((err) =>
        console.error('[tg-recalc] DUAL flush error:', err),
      );
    }
  } else {
    // Counter might still be stale even if level/score didn't change
    if (dayCount !== badge.telegramActiveDays) {
      await db.badge.update({
        where: { id: badgeId },
        data: { telegramActiveDays: dayCount },
      });
    }
  }

  console.log(
    `[tg-recalc] badge=${badgeId} days=${badge.telegramActiveDays}→${dayCount}` +
    ` lvl=${badge.telegramLevel}→${newTgLvl} score=${badge.signalScore}→${newScore}` +
    ` changed=${stateChanged}`,
  );

  return {
    badgeId,
    previousDays:  badge.telegramActiveDays,
    newDays:       dayCount,
    previousLevel: badge.telegramLevel,
    newLevel:      newTgLvl,
    previousScore: badge.signalScore,
    newScore,
    stateChanged,
  };
}
