/**
 * X ingestion orchestrator.
 *
 * Pipeline:
 *   X API → XPost evidence → cumulative public views → rules engine → DUAL update queue
 *
 * Separation of concerns:
 *   x-client.ts    — HTTP transport only
 *   x-classifier.ts — qualifying-post detection
 *   x-budget.ts    — cost estimation + $8 guard
 *   x-sync.ts      — this file: orchestration, DB, rules engine integration
 *
 * Architecture notes:
 *   - X user ID is stored in ExternalAccount (immutable).
 *   - Timeline cursor (lastXPostId) is stored on ExternalAccount.
 *   - Only qualifying posts are persisted in XPost.
 *   - Non-qualifying posts: counted for cost but not stored.
 *   - Cumulative views = SUM(publicViews) for qualifying XPosts per badge.
 *   - nextCheckAt drives view-refresh schedule (age-based).
 */

import { db } from './db';
import { Provider, XPostStatus } from '@prisma/client';
import {
  getUserByUsername,
  getUserTimeline,
  getPostsById,
  type XPost as XApiPost,
} from './x-client';
import { classifyPost } from './x-classifier';
import {
  checkBudget,
  recordUsage,
  estimatePostReadCost,
  estimateUserLookupCost,
  getBillingCycleKey,
  getEstimatedCycleSpend,
} from './x-budget';
import { X_POST_CUTOFF_DATE } from './config';
import {
  resolveXSignalLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveGovernanceLevel,
  computeSignalScore,
  buildRequestedState,
} from './rules-engine';
import { calculateTier } from './config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BadgeSyncResult {
  badgeId:          string;
  handle:           string;
  xUserId:          string | null;
  newPosts:         number;
  qualifyingPosts:  number;
  postsRefreshed:   number;
  cumulativeViews:  number;
  xLevel:           number;
  signalScore:      number;
  tier:             string;
  stateChanged:     boolean;
  error:            string | null;
}

export interface SyncSummary {
  cycleKey:              string;
  accountsConsidered:    number;
  newAccountsResolved:   number;
  newPostsDiscovered:    number;
  qualifyingPosts:       number;
  postsRefreshed:        number;
  usersWithStateChanges: number;
  dualUpdatesQueued:     number;
  estimatedCostThisSync: number;
  estimatedCycleTotal:   number;
  budgetLimit:           number;
  budgetLimitReached:    boolean;
  results:               BadgeSyncResult[];
  errors:                Array<{ handle: string; error: string }>;
}

export interface SyncOptions {
  /** Limit sync to one X handle (for safe single-account testing). */
  testHandle?: string;
  /** If true, skip timeline fetch but still refresh due posts. */
  skipDiscovery?: boolean;
}

// ── next-check scheduling ─────────────────────────────────────────────────────

function nextCheckAt(postedAt: Date, now = new Date()): Date | null {
  const ageMs   = now.getTime() - postedAt.getTime();
  const ageDays = ageMs / 86_400_000;

  if (ageDays > 90) return null;       // stop auto-refresh
  if (ageDays > 30) {
    return new Date(now.getTime() + 30 * 86_400_000);  // monthly
  }
  if (ageDays > 7) {
    return new Date(now.getTime() + 7 * 86_400_000);   // weekly
  }
  if (ageDays > 2) {
    return new Date(now.getTime() + 2 * 86_400_000);   // every 2 days
  }
  return new Date(now.getTime() + 86_400_000);          // daily
}

// ── cumulative views ──────────────────────────────────────────────────────────

async function computeCumulativeViews(badgeId: string): Promise<number> {
  const agg = await db.xPost.aggregate({
    where:  { badgeId, qualifies: true, status: { not: XPostStatus.DELETED } },
    _sum:   { publicViews: true },
  });
  // publicViews is BigInt; safe to convert since Number handles up to 2^53
  const raw = agg._sum.publicViews ?? BigInt(0);
  return Number(raw);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True only when the stored value is a real X numeric user ID, not a handle. */
function isResolvedXId(externalUserId: string): boolean {
  return /^\d+$/.test(externalUserId);
}

// ── ExternalAccount helpers ───────────────────────────────────────────────────

async function getOrCreateXAccount(badge: {
  id: string;
  userId: string;
  xHandle: string;
}) {
  const handle = badge.xHandle.replace(/^@/, '').trim();

  // Try to find existing ExternalAccount for this user with TWITTER source
  const existing = await db.externalAccount.findFirst({
    where: { userId: badge.userId, source: Provider.TWITTER },
  });
  if (existing) return existing;

  // Create placeholder — externalUserId will be filled in during resolution
  return db.externalAccount.create({
    data: {
      userId:         badge.userId,
      source:         Provider.TWITTER,
      externalUserId: `unresolved_${handle}`,
      handle,
    },
  });
}

// ── Discovery: fetch new posts for one account ────────────────────────────────

interface DiscoveryResult {
  newPosts:        number;
  qualifyingPosts: number;
  costUsd:         number;
  newestId:        string | null;
  resolvedUserId:  string | null;
  wasResolved:     boolean;
}

async function discoverNewPosts(opts: {
  badge:    { id: string; userId: string; xHandle: string };
  acct:     { id: string; externalUserId: string; handle: string; lastXPostId: string | null; xResolvedAt: Date | null };
  bearer:   string;
}): Promise<DiscoveryResult> {
  const { badge, acct, bearer } = opts;
  // Treat any non-numeric externalUserId as unresolved (handles stored by old code paths
  // will be numeric like "944480690324987904"; plain strings like "panconmanteca29" are not).
  let xUserId    = isResolvedXId(acct.externalUserId) ? acct.externalUserId : null;
  let wasResolved = false;
  let lookupCost  = 0;

  // Resolve X user ID if missing
  if (!xUserId) {
    const budget = await checkBudget(estimateUserLookupCost(1));
    if (!budget.ok) throw new Error(budget.message!);

    const user = await getUserByUsername(acct.handle, bearer);
    await recordUsage({ endpoint: 'GET /2/users/by/username/:username', resourceCount: 1, estimatedCost: estimateUserLookupCost(1) });
    lookupCost = estimateUserLookupCost(1);

    if (!user) {
      // Suspended / renamed / deleted handle
      return { newPosts: 0, qualifyingPosts: 0, costUsd: lookupCost, newestId: null, resolvedUserId: null, wasResolved: false };
    }

    xUserId = user.id;
    wasResolved = true;

    // Update handle in case it changed, store immutable user ID.
    // P2002 = unique constraint: this X ID is already owned by another ExternalAccount row.
    // In that case, skip this account rather than crashing the whole sync.
    try {
      await db.externalAccount.update({
        where: { id: acct.id },
        data: { externalUserId: xUserId, handle: user.username, xResolvedAt: new Date() },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        console.warn(`[x-sync] @${acct.handle} X ID ${xUserId} already claimed by another account — skipping`);
        return { newPosts: 0, qualifyingPosts: 0, costUsd: lookupCost, newestId: null, resolvedUserId: null, wasResolved: false };
      }
      throw e;
    }

    // Update badge xHandle to match canonical casing
    if (user.username.toLowerCase() !== acct.handle.toLowerCase()) {
      await db.badge.update({ where: { id: badge.id }, data: { xHandle: user.username } });
    }
  }

  // Estimate cost for timeline fetch (max 100 posts)
  const timelineCostEstimate = estimatePostReadCost(100);
  const budget = await checkBudget(timelineCostEstimate);
  if (!budget.ok) throw new Error(budget.message!);

  // Fetch new posts since last cursor, bounded by the cutoff date.
  // start_time is ignored by the API when since_id is set to something more recent,
  // but it prevents fetching ancient history on the very first sync for an account.
  const timeline = await getUserTimeline(xUserId, bearer, {
    sinceId:    acct.lastXPostId ?? undefined,
    maxResults: 100,
    startTime:  X_POST_CUTOFF_DATE,
  });

  const actualPostCount = timeline.posts.length;
  const actualCost      = estimatePostReadCost(actualPostCount);
  if (actualPostCount > 0) {
    await recordUsage({ endpoint: 'GET /2/users/:id/tweets', resourceCount: actualPostCount, estimatedCost: actualCost });
  }

  // Classify and persist qualifying posts
  let qualifyingPosts = 0;
  const now = new Date();

  const cutoff = new Date(X_POST_CUTOFF_DATE);

  for (const post of timeline.posts) {
    // Skip posts before the cutoff date (safety net — API start_time should already exclude them)
    if (new Date(post.created_at) < cutoff) continue;

    const classification = classifyPost(post);
    if (!classification.qualifies) continue;

    qualifyingPosts++;
    const postedAt   = new Date(post.created_at);
    const views      = BigInt(post.public_metrics.impression_count);
    const nextCheck  = nextCheckAt(postedAt, now);

    await db.xPost.upsert({
      where: { badgeId_postId: { badgeId: badge.id, postId: post.id } },
      create: {
        badgeId:            badge.id,
        postId:             post.id,
        authorXUserId:      xUserId!,
        authorHandle:       acct.handle,
        qualifies:          true,
        matchedKeyword:     classification.matchedKeyword,
        publicViews:        views,
        firstObservedViews: views,
        postedAt,
        firstSeenAt:        now,
        lastCheckedAt:      now,
        nextCheckAt:        nextCheck,
        checkCount:         1,
        status:             XPostStatus.ACTIVE,
      },
      update: {
        // Post was already known but didn't qualify — reclassify (shouldn't happen but safe)
        qualifies:      true,
        matchedKeyword: classification.matchedKeyword,
        publicViews:    views,
        lastCheckedAt:  now,
        nextCheckAt:    nextCheck,
        checkCount:     { increment: 1 },
      },
    });
  }

  // Advance timeline cursor
  if (timeline.newestId) {
    await db.externalAccount.update({
      where: { id: acct.id },
      data:  { lastXPostId: timeline.newestId },
    });
  }

  return {
    newPosts:        actualPostCount,
    qualifyingPosts,
    costUsd:         lookupCost + actualCost,
    newestId:        timeline.newestId,
    resolvedUserId:  xUserId,
    wasResolved,
  };
}

// ── Refresh: update view counts for due posts ─────────────────────────────────

interface RefreshResult {
  postsRefreshed: number;
  costUsd:        number;
}

async function refreshDuePosts(badgeId: string, bearer: string): Promise<RefreshResult> {
  const now  = new Date();
  const due  = await db.xPost.findMany({
    where: {
      badgeId,
      qualifies: true,
      status:    XPostStatus.ACTIVE,
      nextCheckAt: { lte: now },
    },
  });

  if (due.length === 0) return { postsRefreshed: 0, costUsd: 0 };

  // Budget check before batch fetch
  const costEstimate = estimatePostReadCost(due.length);
  const budget       = await checkBudget(costEstimate);
  if (!budget.ok) throw new Error(budget.message!);

  const postIds  = due.map(p => p.postId);
  const fetched  = await getPostsById(postIds, bearer);
  const actualCount = fetched.size;

  if (actualCount > 0) {
    await recordUsage({ endpoint: 'GET /2/tweets', resourceCount: actualCount, estimatedCost: estimatePostReadCost(actualCount) });
  }

  let postsRefreshed = 0;
  for (const dbPost of due) {
    const fresh = fetched.get(dbPost.postId);

    if (!fresh) {
      // Post no longer accessible — preserve last views, flag for review
      await db.xPost.update({
        where: { id: dbPost.id },
        data:  { status: XPostStatus.UNAVAILABLE, nextCheckAt: null },
      });
      continue;
    }

    const views     = BigInt(fresh.public_metrics.impression_count);
    const nextCheck = nextCheckAt(dbPost.postedAt, now);

    await db.xPost.update({
      where: { id: dbPost.id },
      data: {
        publicViews:   views,
        lastCheckedAt: now,
        nextCheckAt:   nextCheck,
        checkCount:    { increment: 1 },
        status:        XPostStatus.ACTIVE,
      },
    });
    postsRefreshed++;
  }

  return { postsRefreshed, costUsd: estimatePostReadCost(actualCount) };
}

// ── Per-badge sync ────────────────────────────────────────────────────────────

async function syncBadge(
  badge: {
    id:             string;
    userId:         string;
    xHandle:        string;
    xSignalLevel:   number;
    xSignalPublicViews: number;
    xQualifyingPosts:   number;
    telegramActiveDays: number;
    discordActiveDays:  number;
    governanceVotes:    number;
    signalScore:        number;
    cachedTier:         string;
  },
  bearer:  string,
  opts:    SyncOptions,
): Promise<BadgeSyncResult & { costUsd: number; wasResolved: boolean }> {
  const handle = badge.xHandle.replace(/^@/, '');

  try {
    const acct = await getOrCreateXAccount(badge);

    let discovery: DiscoveryResult = { newPosts: 0, qualifyingPosts: 0, costUsd: 0, newestId: null, resolvedUserId: null, wasResolved: false };
    if (!opts.skipDiscovery) {
      discovery = await discoverNewPosts({ badge, acct, bearer });
    }

    const refresh = await refreshDuePosts(badge.id, bearer);

    // Retroactively disqualify any posts that predate the cutoff (handles posts ingested
    // before the cutoff was introduced, or by a previous sync without start_time).
    await db.xPost.updateMany({
      where: { badgeId: badge.id, postedAt: { lt: new Date(X_POST_CUTOFF_DATE) }, qualifies: true },
      data:  { qualifies: false },
    });

    // Recompute from DB (source of truth)
    const cumulativeViews = await computeCumulativeViews(badge.id);
    const qualCount       = await db.xPost.count({ where: { badgeId: badge.id, qualifies: true } });

    const newXLvl   = resolveXSignalLevel(cumulativeViews, qualCount);
    const newTgLvl  = resolveTelegramLevel(badge.telegramActiveDays);
    const newDcLvl  = resolveDiscordLevel(badge.discordActiveDays);
    const newGovLvl = resolveGovernanceLevel(badge.governanceVotes);
    const newScore  = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
    const newTier   = calculateTier(newScore);

    const stateChanged =
      newXLvl  !== badge.xSignalLevel          ||
      newScore  !== badge.signalScore           ||
      cumulativeViews !== badge.xSignalPublicViews ||
      qualCount       !== badge.xQualifyingPosts;

    await db.$transaction(async tx => {
      await tx.badge.update({
        where: { id: badge.id },
        data: {
          xSignalPublicViews: cumulativeViews,
          xQualifyingPosts:   qualCount,
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

    console.log(
      `[x-sync] @${handle} views=${cumulativeViews} quals=${qualCount} xLvl=${newXLvl} score=${newScore} tier=${newTier} changed=${stateChanged}`,
    );

    return {
      badgeId:         badge.id,
      handle,
      xUserId:         discovery.resolvedUserId ?? (isResolvedXId(acct.externalUserId) ? acct.externalUserId : null),
      newPosts:        discovery.newPosts,
      qualifyingPosts: discovery.qualifyingPosts,
      postsRefreshed:  refresh.postsRefreshed,
      cumulativeViews,
      xLevel:          newXLvl,
      signalScore:     newScore,
      tier:            newTier,
      stateChanged,
      error:           null,
      costUsd:         discovery.costUsd + refresh.costUsd,
      wasResolved:     discovery.wasResolved,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[x-sync] @${handle} error:`, msg);
    return {
      badgeId:         badge.id,
      handle,
      xUserId:         null,
      newPosts:        0,
      qualifyingPosts: 0,
      postsRefreshed:  0,
      cumulativeViews: badge.xSignalPublicViews,
      xLevel:          badge.xSignalLevel,
      signalScore:     badge.signalScore,
      tier:            badge.cachedTier,
      stateChanged:    false,
      error:           msg,
      costUsd:         0,
      wasResolved:     false,
    };
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runXSync(opts: SyncOptions = {}): Promise<SyncSummary> {
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) throw new Error('X_BEARER_TOKEN not configured');

  const cycleKey = getBillingCycleKey();
  const spendBefore = await getEstimatedCycleSpend(cycleKey);
  console.log(`[x-sync] Starting. Cycle ${cycleKey}, spend so far $${spendBefore.toFixed(4)}`);

  // Load badges with xHandle
  const whereClause = opts.testHandle
    ? { xHandle: { in: [opts.testHandle, `@${opts.testHandle}`, opts.testHandle.replace(/^@/, '')] } }
    : { xHandle: { not: '' } };

  const badges = await db.badge.findMany({
    where: whereClause,
    include: { user: true },
  });

  console.log(`[x-sync] Accounts considered: ${badges.length}`);

  const results:    (BadgeSyncResult & { costUsd: number; wasResolved: boolean })[] = [];
  const errors:     Array<{ handle: string; error: string }> = [];
  let totalCost     = 0;
  let newResolved   = 0;
  let stateChanges  = 0;
  let dualQueued    = 0;
  let totalNewPosts = 0;
  let totalQual     = 0;
  let totalRefreshed = 0;
  let budgetReached = false;

  for (const badge of badges) {
    const result = await syncBadge(badge as any, bearer, opts);
    results.push(result);
    totalCost     += result.costUsd;
    totalNewPosts += result.newPosts;
    totalQual     += result.qualifyingPosts;
    totalRefreshed += result.postsRefreshed;

    if (result.wasResolved) newResolved++;
    if (result.stateChanged) { stateChanges++; dualQueued++; }
    if (result.error) errors.push({ handle: result.handle, error: result.error });
    if (result.error?.startsWith('INTERNAL_BUDGET_LIMIT_REACHED')) {
      budgetReached = true;
      break;
    }

    // Small delay to be a good API citizen
    await new Promise(r => setTimeout(r, 200));
  }

  const spendAfter = await getEstimatedCycleSpend(cycleKey);

  console.log(
    `[x-sync] Done. new=${totalNewPosts} qual=${totalQual} refreshed=${totalRefreshed} ` +
    `changes=${stateChanges} cost=$${totalCost.toFixed(4)} cycleTot=$${spendAfter.toFixed(4)}`,
  );

  return {
    cycleKey,
    accountsConsidered:    badges.length,
    newAccountsResolved:   newResolved,
    newPostsDiscovered:    totalNewPosts,
    qualifyingPosts:       totalQual,
    postsRefreshed:        totalRefreshed,
    usersWithStateChanges: stateChanges,
    dualUpdatesQueued:     dualQueued,
    estimatedCostThisSync: totalCost,
    estimatedCycleTotal:   spendAfter,
    budgetLimit:           8.00,
    budgetLimitReached:    budgetReached,
    results,
    errors,
  };
}
