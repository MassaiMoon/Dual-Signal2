/**
 * POST /api/admin/update-score
 *
 * M8 — Set absolute signal data for a badge and propagate to DUAL.
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
  resolveGovernanceLevel,
  resolveHolderLevel,
  computeSignalScore,
  buildRequestedState,
} from '@/lib/rules-engine';
import { runPendingUpdates } from '@/lib/update-worker';

export const dynamic = 'force-dynamic';

interface UpdateScoreBody {
  walletAddress:      string;
  xImpressions?:     number;
  telegramActiveDays?: number;
  governanceVotes?:  number;
  holderQualDays?:   number;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: UpdateScoreBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { walletAddress, xImpressions, telegramActiveDays, governanceVotes, holderQualDays } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
  }

  const badge = await db.badge.findFirst({ where: { walletAddress } });
  if (!badge) {
    return NextResponse.json({ error: 'No badge found for this wallet' }, { status: 404 });
  }

  // Use provided values; fall back to existing DB values so partial updates work
  const newX   = xImpressions       ?? badge.xSignalImpressions;
  const newTg  = telegramActiveDays ?? badge.telegramActiveDays;
  const newGov = governanceVotes    ?? badge.governanceVotes;
  const newHld = holderQualDays     ?? badge.holderQualDays;

  const newXLvl   = resolveXSignalLevel(newX);
  const newTgLvl  = resolveTelegramLevel(newTg);
  const newGovLvl = resolveGovernanceLevel(newGov);
  const newHldLvl = resolveHolderLevel(newHld);
  const newScore  = computeSignalScore(newXLvl, newTgLvl, newGovLvl, newHldLvl);
  const newTier   = calculateTier(newScore);

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

  console.log(`[update-score] badge=${badge.id} score=${newScore} tier=${newTier} stateChanged=${stateChanged}`);

  // Auto-flush to DUAL if write credentials are present
  if (stateChanged && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
    runPendingUpdates().catch((err) =>
      console.error('[update-score] flush error:', err),
    );
  }

  return NextResponse.json({
    status:          stateChanged ? 'updated' : 'no_change',
    badgeId:         badge.id,
    dualObjectId:    badge.dualObjectId,
    walletAddress,
    signalScore:     newScore,
    tier:            newTier,
    levels: {
      xSignal:      newXLvl,
      telegram:     newTgLvl,
      governance:   newGovLvl,
      holderStaking: newHldLvl,
    },
    rawCounters: { xImpressions: newX, telegramActiveDays: newTg, governanceVotes: newGov, holderQualDays: newHld },
    dualUpdateQueued: stateChanged,
  });
}
