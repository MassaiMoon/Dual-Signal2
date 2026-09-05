/**
 * POST /api/admin/sync-x
 *
 * Fetches tweet impression data for all badges that have an xHandle set,
 * then updates xSignalImpressions + recalculates score/tier.
 *
 * Uses X API v2 with app-only Bearer token (no user OAuth needed).
 * Fetches up to 100 recent tweets per user, sums impression_count
 * from public_metrics. Falls back to an engagement-weighted estimate
 * if impression_count is unavailable.
 *
 * Required env var:
 *   TWITTER_BEARER_TOKEN  — X API v2 app-only Bearer token
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

const X_API = 'https://api.twitter.com/2';

// ── X API helpers ─────────────────────────────────────────────────────────────

async function xGet(path: string, bearerToken: string) {
  const res = await fetch(`${X_API}${path}`, {
    headers: { authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function getUserId(username: string, bearer: string): Promise<string | null> {
  try {
    const data = await xGet(`/users/by/username/${encodeURIComponent(username)}`, bearer);
    return data?.data?.id ?? null;
  } catch (err) {
    console.warn(`[sync-x] getUserId @${username}:`, (err as Error).message);
    return null;
  }
}

interface PublicMetrics {
  impression_count?: number;
  retweet_count:     number;
  reply_count:       number;
  like_count:        number;
  quote_count:       number;
  bookmark_count?:   number;
}

// Engagement-weighted proxy when impression_count is unavailable
function estimateImpressions(m: PublicMetrics): number {
  return (
    (m.impression_count ?? 0) ||
    (m.retweet_count * 25 + m.quote_count * 20 + m.reply_count * 5 + m.like_count * 2 + (m.bookmark_count ?? 0) * 3)
  );
}

async function getTotalImpressions(userId: string, bearer: string): Promise<number> {
  try {
    const data = await xGet(
      `/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics`,
      bearer,
    );
    const tweets: { public_metrics: PublicMetrics }[] = data?.data ?? [];
    return tweets.reduce((sum, t) => sum + estimateImpressions(t.public_metrics), 0);
  } catch (err) {
    console.warn(`[sync-x] getTotalImpressions userId=${userId}:`, (err as Error).message);
    return 0;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) {
    return NextResponse.json({ error: 'TWITTER_BEARER_TOKEN not set' }, { status: 500 });
  }

  // Only sync badges that have an X handle
  const badges = await db.badge.findMany({
    where: { xHandle: { not: '' } },
  });

  if (badges.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No badges with xHandle set' });
  }

  const results: { handle: string; impressions: number; tier: string; score: number; changed: boolean }[] = [];
  let updated = 0;

  for (const badge of badges) {
    const handle = badge.xHandle.replace(/^@/, '');

    // Resolve X user ID
    const userId = await getUserId(handle, bearer);
    if (!userId) {
      results.push({ handle, impressions: 0, tier: badge.cachedTier, score: badge.signalScore, changed: false });
      continue;
    }

    // Fetch total impressions from their timeline
    const impressions = await getTotalImpressions(userId, bearer);

    // Only update if impressions increased (never decrease the count)
    const newImpressions = Math.max(impressions, badge.xSignalImpressions);
    if (newImpressions === badge.xSignalImpressions) {
      results.push({ handle, impressions: newImpressions, tier: badge.cachedTier, score: badge.signalScore, changed: false });
      continue;
    }

    // Recompute score
    const newXLvl   = resolveXSignalLevel(newImpressions);
    const newTgLvl  = resolveTelegramLevel(badge.telegramActiveDays);
    const newGovLvl = resolveGovernanceLevel(badge.governanceVotes);
    const newHldLvl = resolveHolderLevel(badge.holderQualDays);
    const newScore  = computeSignalScore(newXLvl, newTgLvl, newGovLvl, newHldLvl);
    const newTier   = calculateTier(newScore);

    const stateChanged = newXLvl !== badge.xSignalLevel || newScore !== badge.signalScore;

    await db.$transaction(async (tx) => {
      await tx.badge.update({
        where: { id: badge.id },
        data: {
          xSignalImpressions: newImpressions,
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

    updated++;
    results.push({ handle, impressions: newImpressions, tier: newTier, score: newScore, changed: stateChanged });
    console.log(`[sync-x] @${handle} impressions=${newImpressions} xLvl=${newXLvl} score=${newScore} tier=${newTier}`);

    // Small delay between users to respect rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  // Flush all queued DUAL writes
  if (updated > 0 && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
    runPendingUpdates().catch(err => console.error('[sync-x] flush error:', err));
  }

  return NextResponse.json({ synced: updated, total: badges.length, results });
}
