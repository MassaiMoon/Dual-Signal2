/**
 * X API v2 client — read-only, app-only Bearer Token auth.
 *
 * Only contains HTTP transport and type definitions.
 * No scoring logic, no budget tracking, no DB access here.
 *
 * Endpoints used:
 *   GET /2/users/by/username/:username  — resolve handle → immutable user ID
 *   GET /2/users/:id/tweets             — user timeline (since_id, exclude=retweets)
 *   GET /2/tweets                       — batch post lookup by IDs (up to 100)
 *
 * All three endpoints return public_metrics.impression_count (public view count)
 * with app-only Bearer Token auth.
 *
 * SECURITY: Bearer Token is passed in at call time from process.env.
 * It is NEVER logged, stored, or returned in responses.
 */

export const X_API_BASE = 'https://api.twitter.com/2';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface XPublicMetrics {
  repost_count:    number;
  reply_count:     number;
  like_count:      number;
  quote_count:     number;
  bookmark_count:  number;
  impression_count: number; // public view count shown on the post
}

export interface XPost {
  id:               string;
  text:             string;
  created_at:       string;
  public_metrics:   XPublicMetrics;
  // Present when the post is a retweet / quote / reply
  referenced_tweets?: Array<{ type: 'retweeted' | 'quoted' | 'replied_to'; id: string }>;
}

export interface XUser {
  id:       string; // immutable numeric string
  name:     string;
  username: string; // current @handle (can change)
}

export interface XApiError {
  status:  number;
  message: string;
  code?:   number;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function xGet<T>(
  path: string,
  bearer: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${X_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${bearer}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { detail?: string; errors?: Array<{ message: string }> };
      message = body.detail ?? body.errors?.[0]?.message ?? message;
    } catch { /* ignore parse error */ }
    const err: XApiError = { status: res.status, message };
    throw err;
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a @username to an immutable X user ID.
 * Cost: $0.010 per user resource returned.
 */
export async function getUserByUsername(
  username: string,
  bearer: string,
): Promise<XUser | null> {
  const clean = username.replace(/^@/, '');
  try {
    const data = await xGet<{ data?: XUser }>(
      `/users/by/username/${encodeURIComponent(clean)}`,
      bearer,
    );
    return data.data ?? null;
  } catch (err) {
    const apiErr = err as XApiError;
    if (apiErr.status === 404) return null; // user not found
    throw err;
  }
}

export interface TimelineOptions {
  sinceId?:    string; // only return posts newer than this ID
  maxResults?: number; // 5–100, default 10
  startTime?:  string; // ISO 8601 — only return posts at or after this time
}

export interface TimelineResult {
  posts:      XPost[];
  newestId:   string | null; // use as sinceId on the next call
  oldestId:   string | null;
}

/**
 * Fetch the most recent posts for a user.
 * We do NOT use the `exclude=retweets` API filter because on some X API
 * tiers it also excludes quote tweets, which should qualify if the user's
 * own text contains a DUAL keyword. Plain repost exclusion is handled
 * client-side in x-classifier.ts (referenced_tweets[].type === 'retweeted').
 * Cost: $0.005 per post resource returned.
 */
export async function getUserTimeline(
  xUserId:  string,
  bearer:   string,
  opts:     TimelineOptions = {},
): Promise<TimelineResult> {
  const params: Record<string, string> = {
    'tweet.fields': 'created_at,public_metrics,referenced_tweets,text',
    'max_results':  String(Math.min(100, Math.max(5, opts.maxResults ?? 100))),
  };
  if (opts.sinceId)   params['since_id']   = opts.sinceId;
  if (opts.startTime) params['start_time'] = opts.startTime;

  const data = await xGet<{
    data?: XPost[];
    meta?: { newest_id?: string; oldest_id?: string };
  }>(`/users/${xUserId}/tweets`, bearer, params);

  return {
    posts:    data.data ?? [],
    newestId: data.meta?.newest_id ?? null,
    oldestId: data.meta?.oldest_id ?? null,
  };
}

/**
 * Batch-fetch public_metrics for up to 100 post IDs.
 * Use to refresh view counts for due posts without re-fetching the timeline.
 * Cost: $0.005 per post resource returned.
 */
export async function getPostsById(
  postIds: string[],
  bearer:  string,
): Promise<Map<string, XPost>> {
  if (postIds.length === 0) return new Map();

  const chunks: string[][] = [];
  for (let i = 0; i < postIds.length; i += 100) {
    chunks.push(postIds.slice(i, i + 100));
  }

  const result = new Map<string, XPost>();
  for (const chunk of chunks) {
    const data = await xGet<{ data?: XPost[] }>('/tweets', bearer, {
      'ids':          chunk.join(','),
      'tweet.fields': 'created_at,public_metrics,referenced_tweets,text',
    });
    for (const post of data.data ?? []) {
      result.set(post.id, post);
    }
  }
  return result;
}
