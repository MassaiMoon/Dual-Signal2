/**
 * POST /api/admin/sync-x
 *
 * Fetches tweet public view data for all badges that have an xHandle set,
 * then updates xSignalPublicViews + recalculates score/tier.
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
  resolveDiscordLevel,
  resolveGovernanceLevel,
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

function estimatePublicViews(m: PublicMetrics): number {
  return (
    (m.impression_count ?? 0) ||
    (m.retweet_count * 25 + m.quote_count * 20 + m.reply_count * 5 + m.like_count * 2 + (m.bookmark_count ?? 0) * 3)
  );
}

async function getTotalPublicViews(userId: string, bearer: string): Promise<{ views: number; postCount: number }> {
  try {
    const data = await xGet(
      `/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics,text`,
      bearer,
    );
    const tweets: { text: string; public_metrics: PublicMetrics }[] = data?.data ?? [];
    const dualTweets = tweets.filter(t => /\$DUAL/i.test(t.text));
    const views = dualTweets.reduce((sum, t) => sum + estimatePublicViews(t.public_metrics), 0);
    return { views, postCount: dualTweets.length };
  } catch (err) {
    console.warn(`[sync-x] getTotalPublicViews userId=${userId}:`, (err as Error).message);
    return { views: 0, postCount: 0 };
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

  const badges = await db.badge.findMany({
    where: { xHandle: { not: '' } },
  });

  if (badges.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No badges with xHandle set' });
  }

  const results: { handle: string; publicViews: number; tier: string; score: number; changed: boolean }[] = [];
  let updated = 0;

  for (const badge of badges) {
    const handle = badge.xHandle.replace(/^@/, '');

    const userId = await getUserId(handle, bearer);
    if (!userId) {
      results.push({ handle, publicViews: 0, tier: badge.cachedTier, score: badge.signalScore, changed: false });
      continue;
    }

    const { views, postCount } = await getTotalPublicViews(userId, bearer);

    const newViews = Math.max(views, badge.xSignalPublicViews);
    const newPosts = Math.max(postCount, badge.xQualifyingPosts);
    if (newViews === badge.xSignalPublicViews && newPosts === badge.xQualifyingPosts) {
      results.push({ handle, publicViews: newViews, tier: badge.cachedTier, score: badge.signalScore, changed: false });
      continue;
    }

    const newXLvl   = resolveXSignalLevel(newViews, newPosts);
    const newTgLvl  = resolveTelegramLevel(badge.telegramActiveDays);
    const newDcLvl  = resolveDiscordLevel(badge.discordActiveDays);
    const newGovLvl = resolveGovernanceLevel(badge.governanceVotes);
    const newScore  = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
    const newTier   = calculateTier(newScore);

    const stateChanged = newXLvl !== badge.xSignalLevel || newScore !== badge.signalScore;

    await db.$transaction(async (tx) => {
      await tx.badge.update({
        where: { id: badge.id },
        data: {
          xSignalPublicViews: newViews,
          xQualifyingPosts:   newPosts,
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

    updated++;
    results.push({ handle, publicViews: newViews, tier: newTier, score: newScore, changed: stateChanged });
    console.log(`[sync-x] @${handle} publicViews=${newViews} posts=${newPosts} xLvl=${newXLvl} score=${newScore} tier=${newTier}`);

    await new Promise(r => setTimeout(r, 300));
  }

  if (updated > 0 && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
    runPendingUpdates().catch(err => console.error('[sync-x] flush error:', err));
  }

  return NextResponse.json({ synced: updated, total: badges.length, results });
}
