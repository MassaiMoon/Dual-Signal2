/**
 * POST /api/admin/update-score
 *
 * Set absolute signal data for a badge and propagate to DUAL.
 *
 * Accepts raw counters (absolute values, not deltas). Resolves levels,
 * computes score + tier, updates the DB, and queues a DUAL badge write.
 * Auto-fires flush-updates if DUAL write credentials are present.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateTier } from '@/lib/config';
import {
  resolveXSignalLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveGovernanceLevel,
  computeSignalScore,
  buildRequestedState,
} from '@/lib/rules-engine';
import { runPendingUpdates } from '@/lib/update-worker';

export const dynamic = 'force-dynamic';

interface UpdateScoreBody {
  walletAddress:       string;
  xPublicViews?:       number;
  xQualifyingPosts?:   number;
  telegramActiveDays?: number;
  discordActiveDays?:  number;
  governanceVotes?:    number;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: UpdateScoreBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { walletAddress, xPublicViews, xQualifyingPosts, telegramActiveDays, discordActiveDays, governanceVotes } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
  }

  const badge = await db.badge.findFirst({ where: { walletAddress } });
  if (!badge) {
    return NextResponse.json({ error: 'No badge found for this wallet' }, { status: 404 });
  }

  const newViews = xPublicViews       ?? badge.xSignalPublicViews;
  const newPosts = xQualifyingPosts   ?? badge.xQualifyingPosts;
  const newTg    = telegramActiveDays ?? badge.telegramActiveDays;
  const newDc    = discordActiveDays  ?? badge.discordActiveDays;
  const newGov   = governanceVotes    ?? badge.governanceVotes;

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

  console.log(`[update-score] badge=${badge.id} score=${newScore} tier=${newTier} stateChanged=${stateChanged}`);

  if (stateChanged && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
    runPendingUpdates().catch((err) =>
      console.error('[update-score] flush error:', err),
    );
  }

  return NextResponse.json({
    status:       stateChanged ? 'updated' : 'no_change',
    badgeId:      badge.id,
    dualObjectId: badge.dualObjectId,
    walletAddress,
    signalScore:  newScore,
    tier:         newTier,
    levels: {
      xSignal:    newXLvl,
      telegram:   newTgLvl,
      discord:    newDcLvl,
      governance: newGovLvl,
    },
    rawCounters: {
      xPublicViews: newViews,
      xQualifyingPosts: newPosts,
      telegramActiveDays: newTg,
      discordActiveDays: newDc,
      governanceVotes: newGov,
    },
    dualUpdateQueued: stateChanged,
  });
}
