/**
 * Governance Forum sync orchestrator.
 *
 * Pipeline:
 *   Discourse public API → GovernanceActivity evidence → governanceActivityPoints
 *   → resolveGovernanceLevel → DUAL update queue
 *
 * Strategy: category-scan (not user-scan)
 *   - GET /c/{slug}/{id}.json → topic list
 *   - GET /t/{id}.json → posts
 *   - Match posts by user_id to badge ExternalAccount (Provider.DUAL_FORUM)
 *   - Dedup by @@unique([badgeId, postId, activityType])
 */

import { db } from './db';
import { Provider, GovernanceActivityType, GovernanceActivityStatus, GovernanceActivitySource } from '@prisma/client';
import { getCategoryTopics, getTopicPosts, getTopicPostsPage, getForumUserByUsername } from './forum-client';
import { classifyPost } from './forum-classifier';
import {
  resolveGovernanceLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveXSignalLevel,
  computeSignalScore,
  buildRequestedState,
} from './rules-engine';
import { calculateTier } from './config';
import { GOVERNANCE_QUALIFYING_CATEGORY_IDS } from './config';

// ── Category metadata (slug required for Discourse URL) ───────────────────────

const QUALIFYING_CATEGORIES: Array<{ id: number; slug: string }> = [
  { id: 6, slug: 'ecosystem-direction' },
  { id: 7, slug: 'protocol-improvements' },
  { id: 8, slug: 'treasury-grants' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GovernanceSyncOptions {
  /** Limit sync to one forum username (for safe single-user testing). */
  testForumUsername?: string;
  /** How many pages of topics to scan per category (default 3). */
  topicPages?: number;
}

export interface GovernanceBadgeResult {
  badgeId:         string;
  forumUsername:   string;
  newActivities:   number;
  totalPoints:     number;
  governanceLevel: number;
  signalScore:     number;
  stateChanged:    boolean;
  error:           string | null;
}

export interface GovernanceSyncSummary {
  usersConsidered:  number;
  newActivities:    number;
  stateChanges:     number;
  dualUpdatesQueued: number;
  results:          GovernanceBadgeResult[];
  errors:           Array<{ forumUsername: string; error: string }>;
}

// ── Build a user_id → badge mapping for all connected forum accounts ──────────

async function buildUserIdMap(testForumUsername?: string): Promise<Map<number, { badgeId: string; userId: string; forumUsername: string }>> {
  const where = testForumUsername
    ? { source: Provider.DUAL_FORUM, handle: testForumUsername }
    : { source: Provider.DUAL_FORUM };

  const accounts = await db.externalAccount.findMany({
    where,
    include: { user: { include: { badge: { select: { id: true } } } } },
  });

  const map = new Map<number, { badgeId: string; userId: string; forumUsername: string }>();
  for (const acct of accounts) {
    const badgeId = acct.user.badge?.id;
    if (!badgeId) continue;
    const forumUserId = parseInt(acct.externalUserId, 10);
    if (isNaN(forumUserId)) continue;
    map.set(forumUserId, { badgeId, userId: acct.userId, forumUsername: acct.handle });
  }
  return map;
}

// ── Resolve and upsert a DUAL_FORUM ExternalAccount for a badge ───────────────

export async function resolveForumAccount(badgeId: string, forumUsername: string): Promise<{ forumUserId: number } | null> {
  const badge = await db.badge.findUnique({ where: { id: badgeId }, select: { userId: true } });
  if (!badge) return null;

  const existing = await db.externalAccount.findFirst({
    where: { userId: badge.userId, source: Provider.DUAL_FORUM },
  });

  if (existing) {
    const id = parseInt(existing.externalUserId, 10);
    return isNaN(id) ? null : { forumUserId: id };
  }

  // Resolve via Discourse API
  const forumUser = await getForumUserByUsername(forumUsername);
  if (!forumUser) return null;

  await db.externalAccount.create({
    data: {
      userId:         badge.userId,
      source:         Provider.DUAL_FORUM,
      externalUserId: String(forumUser.id),
      handle:         forumUser.username,
      verifiedAt:     new Date(),
    },
  });

  return { forumUserId: forumUser.id };
}

// ── Per-topic scan ────────────────────────────────────────────────────────────

async function scanTopic(
  topicId:     number,
  categoryId:  number,
  topicUrl:    string,
  userIdMap:   Map<number, { badgeId: string; userId: string; forumUsername: string }>,
): Promise<number> {
  let newActivities = 0;

  // Fetch all post pages until exhausted
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const topicData = page === 0
      ? await getTopicPosts(topicId)
      : await getTopicPostsPage(topicId, page);

    const posts = topicData.post_stream?.posts ?? [];
    if (posts.length === 0) break;

    for (const post of posts) {
      const match = userIdMap.get(post.user_id);
      if (!match) continue;

      // How many comment points has this user already earned in this topic?
      const existingCommentPoints = await db.governanceActivity.aggregate({
        where: {
          badgeId:      match.badgeId,
          topicId,
          activityType: GovernanceActivityType.COMMENT,
          status:       { not: GovernanceActivityStatus.DELETED },
        },
        _sum: { pointsAwarded: true },
      });
      const commentPts = existingCommentPoints._sum.pointsAwarded ?? 0;

      const classification = classifyPost(post.post_number, categoryId, commentPts);
      if (!classification) continue;

      // Dedup: @@unique([badgeId, postId, activityType])
      try {
        await db.governanceActivity.create({
          data: {
            badgeId:      match.badgeId,
            forumUserId:  post.user_id,
            forumUsername: post.username,
            topicId,
            postId:       String(post.id),
            activityType: classification.activityType as GovernanceActivityType,
            pointsAwarded: classification.pointsAwarded,
            occurredAt:   new Date(post.created_at),
            topicUrl,
            status:       GovernanceActivityStatus.ACTIVE,
            source:       GovernanceActivitySource.AUTOMATED,
          },
        });
        newActivities++;
      } catch (e: unknown) {
        // P2002 = unique constraint — already recorded, skip
        if ((e as { code?: string })?.code !== 'P2002') throw e;
      }
    }

    // Discourse returns ~20 posts per page; if fewer than 20 returned, we're done
    hasMore = posts.length >= 20;
    page++;
    if (page > 50) break; // safety cap
  }

  return newActivities;
}

// ── Update badge governance counters + signal score ───────────────────────────

async function updateBadgeGovernance(badgeId: string): Promise<{
  totalPoints: number;
  governanceLevel: number;
  signalScore: number;
  stateChanged: boolean;
}> {
  const badge = await db.badge.findUnique({
    where: { id: badgeId },
    select: {
      governanceActivityPoints: true,
      governanceLevel:          true,
      signalScore:              true,
      telegramActiveDays:       true,
      discordActiveDays:        true,
      xSignalPublicViews:       true,
      xQualifyingPosts:         true,
      xSignalLevel:             true,
      cachedTier:               true,
    },
  });
  if (!badge) throw new Error(`Badge ${badgeId} not found`);

  // Sum all active governance activity points from DB
  const agg = await db.governanceActivity.aggregate({
    where:  { badgeId, status: { not: GovernanceActivityStatus.DELETED } },
    _sum:   { pointsAwarded: true },
  });
  const totalPoints = agg._sum.pointsAwarded ?? 0;

  const newGovLvl  = resolveGovernanceLevel(totalPoints);
  const newTgLvl   = resolveTelegramLevel(badge.telegramActiveDays);
  const newDcLvl   = resolveDiscordLevel(badge.discordActiveDays);
  const newXLvl    = resolveXSignalLevel(badge.xSignalPublicViews, badge.xQualifyingPosts);
  const newScore   = computeSignalScore(newXLvl, newTgLvl, newDcLvl, newGovLvl);
  const newTier    = calculateTier(newScore);

  const stateChanged =
    totalPoints     !== badge.governanceActivityPoints ||
    newGovLvl       !== badge.governanceLevel          ||
    newScore        !== badge.signalScore;

  await db.$transaction(async tx => {
    await tx.badge.update({
      where: { id: badgeId },
      data: {
        governanceActivityPoints: totalPoints,
        governanceLevel:          newGovLvl,
        telegramLevel:            newTgLvl,
        discordLevel:             newDcLvl,
        xSignalLevel:             newXLvl,
        signalScore:              newScore,
        cachedTier:               newTier as any,
      },
    });

    if (stateChanged) {
      await tx.badgeUpdate.create({
        data: {
          badgeId,
          requestedState: buildRequestedState(newScore, newTier, newXLvl, newTgLvl, newDcLvl, newGovLvl),
          status: 'PENDING',
        },
      });
    }
  });

  return { totalPoints, governanceLevel: newGovLvl, signalScore: newScore, stateChanged };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runGovernanceSync(opts: GovernanceSyncOptions = {}): Promise<GovernanceSyncSummary> {
  const topicPages = opts.topicPages ?? 3;

  // Build user_id → badge map
  const userIdMap = await buildUserIdMap(opts.testForumUsername);
  console.log(`[gov-sync] Forum accounts mapped: ${userIdMap.size}`);

  if (userIdMap.size === 0) {
    return {
      usersConsidered:  0,
      newActivities:    0,
      stateChanges:     0,
      dualUpdatesQueued: 0,
      results:          [],
      errors:           [],
    };
  }

  // Scan all qualifying categories
  let totalNewActivities = 0;

  for (const cat of QUALIFYING_CATEGORIES) {
    for (let page = 0; page < topicPages; page++) {
      let catResult: Awaited<ReturnType<typeof getCategoryTopics>>;
      try {
        catResult = await getCategoryTopics(cat.slug, cat.id, page);
      } catch (err) {
        console.error(`[gov-sync] Error fetching category ${cat.id} page ${page}:`, err);
        break;
      }

      const topics = catResult.topic_list?.topics ?? [];
      if (topics.length === 0) break;

      for (const topic of topics) {
        const topicUrl = `https://forum.dual.org/t/${topic.slug}/${topic.id}`;
        try {
          const added = await scanTopic(topic.id, cat.id, topicUrl, userIdMap);
          totalNewActivities += added;
        } catch (err) {
          console.error(`[gov-sync] Error scanning topic ${topic.id}:`, err);
        }
        // Small delay — be a polite citizen
        await new Promise(r => setTimeout(r, 150));
      }

      // No more pages if the API doesn't return a next URL
      if (!catResult.topic_list.more_topics_url) break;
    }
  }

  // Update each badge's governance counters
  const results: GovernanceBadgeResult[] = [];
  const errors:  Array<{ forumUsername: string; error: string }> = [];
  let stateChanges    = 0;
  let dualUpdatesQueued = 0;

  const badgeIds = [...new Set([...userIdMap.values()].map(v => v.badgeId))];

  for (const badgeId of badgeIds) {
    const info = [...userIdMap.values()].find(v => v.badgeId === badgeId)!;
    try {
      const update = await updateBadgeGovernance(badgeId);
      if (update.stateChanged) { stateChanges++; dualUpdatesQueued++; }
      results.push({
        badgeId,
        forumUsername:   info.forumUsername,
        newActivities:   0, // per-badge count tracked in scanTopic; use total below
        totalPoints:     update.totalPoints,
        governanceLevel: update.governanceLevel,
        signalScore:     update.signalScore,
        stateChanged:    update.stateChanged,
        error:           null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ forumUsername: info.forumUsername, error: msg });
      results.push({
        badgeId,
        forumUsername:   info.forumUsername,
        newActivities:   0,
        totalPoints:     0,
        governanceLevel: 0,
        signalScore:     0,
        stateChanged:    false,
        error:           msg,
      });
    }
  }

  // Update ExternalAccount forumSyncedAt for all synced accounts
  await db.externalAccount.updateMany({
    where:  { source: Provider.DUAL_FORUM, userId: { in: [...userIdMap.values()].map(v => v.userId) } },
    data:   { forumSyncedAt: new Date() },
  });

  console.log(
    `[gov-sync] Done. newActivities=${totalNewActivities} stateChanges=${stateChanges} errors=${errors.length}`,
  );

  return {
    usersConsidered:  userIdMap.size,
    newActivities:    totalNewActivities,
    stateChanges,
    dualUpdatesQueued,
    results,
    errors,
  };
}
