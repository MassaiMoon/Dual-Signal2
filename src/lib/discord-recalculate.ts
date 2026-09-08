/**
 * Discord Active-Day Recalculation
 *
 * After the bot records a new DiscordActiveDay row, call this to
 * recount days from evidence, resolve the new level/score/tier, persist
 * badge state, and enqueue a DUAL update if anything changed.
 *
 * Architecture: DiscordActiveDay rows are the source of truth.
 * Badge.discordActiveDays is a cached counter derived from that table.
 */

import { db } from './db';
import { calculateTier } from './config';
import {
  resolveDiscordLevel,
  resolveXSignalLevel,
  resolveTelegramLevel,
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
 * Recount DiscordActiveDay rows for a badge, update badge state, and
 * queue a DUAL update if the level or score changed.
 */
export async function recalculateDiscordForBadge(
  badgeId: string,
): Promise<RecalcResult> {
  const badge = await db.badge.findUnique({ where: { id: badgeId } });
  if (!badge) throw new Error(`Badge not found: ${badgeId}`);

  const dayCount = await db.discordActiveDay.count({ where: { badgeId } });

  const newDcLvl  = resolveDiscordLevel(dayCount);
  const newXLvl   = resolveXSignalLevel(badge.xSignalPublicViews, badge.xQualifyingPosts);
  const newTgLvl  = resolveTelegramLevel(badge.telegramActiveDays);
  const newGovLvl = resolveGovernanceLevel(badge.governanceActivityPoints);
  const newScore  = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
  const newTier   = calculateTier(newScore);

  const stateChanged =
    dayCount  !== badge.discordActiveDays ||
    newDcLvl  !== badge.discordLevel      ||
    newScore  !== badge.signalScore;

  if (stateChanged) {
    await db.$transaction(async (tx) => {
      await tx.badge.update({
        where: { id: badgeId },
        data: {
          discordActiveDays: dayCount,
          discordLevel:      newDcLvl,
          xSignalLevel:      newXLvl,
          telegramLevel:     newTgLvl,
          governanceLevel:   newGovLvl,
          signalScore:       newScore,
          cachedTier:        newTier as never,
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

    if (process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
      runPendingUpdates().catch((err) =>
        console.error('[dc-recalc] DUAL flush error:', err),
      );
    }
  } else {
    if (dayCount !== badge.discordActiveDays) {
      await db.badge.update({
        where: { id: badgeId },
        data: { discordActiveDays: dayCount },
      });
    }
  }

  console.log(
    `[dc-recalc] badge=${badgeId} days=${badge.discordActiveDays}→${dayCount}` +
    ` lvl=${badge.discordLevel}→${newDcLvl} score=${badge.signalScore}→${newScore}` +
    ` changed=${stateChanged}`,
  );

  return {
    badgeId,
    previousDays:  badge.discordActiveDays,
    newDays:       dayCount,
    previousLevel: badge.discordLevel,
    newLevel:      newDcLvl,
    previousScore: badge.signalScore,
    newScore,
    stateChanged,
  };
}
