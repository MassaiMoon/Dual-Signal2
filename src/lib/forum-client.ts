/**
 * Discourse HTTP transport for forum.dual.org.
 *
 * Only public JSON endpoints — no auth required.
 * No scoring, no DB, no side effects.
 */

const FORUM_BASE = 'https://forum.dual.org';
const TIMEOUT_MS = 15_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ForumUser {
  id:       number;
  username: string;
  name:     string;
}

export interface ForumPost {
  id:           number;
  topic_id:     number;
  post_number:  number;
  user_id:      number;
  username:     string;
  created_at:   string;
  updated_at:   string;
  cooked?:      string;
  raw?:         string;
}

export interface ForumTopic {
  id:          number;
  title:       string;
  slug:        string;
  category_id: number;
  created_at:  string;
  posts_count: number;
  fancy_title?: string;
}

export interface ForumCategoryTopicsResult {
  topic_list: {
    topics:   ForumTopic[];
    more_topics_url?: string | null;
  };
}

export interface ForumTopicPostsResult {
  id:           number;
  title:        string;
  category_id:  number;
  created_at:   string;
  post_stream: {
    posts: ForumPost[];
  };
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function forumGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${FORUM_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
    signal:  AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Discourse API HTTP ${res.status} for ${path}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a Discourse username to a user object (includes immutable user ID).
 */
export async function getForumUserByUsername(username: string): Promise<ForumUser | null> {
  try {
    const data = await forumGet<{ user: ForumUser }>(`/u/${encodeURIComponent(username)}.json`);
    return data.user ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('HTTP 404') || msg.includes('HTTP 403')) return null;
    throw err;
  }
}

/**
 * Fetch the topic list for a category (one page).
 * page 0 = most recent topics; use page param for older ones.
 */
export async function getCategoryTopics(
  categorySlug: string,
  categoryId:   number,
  page          = 0,
): Promise<ForumCategoryTopicsResult> {
  return forumGet<ForumCategoryTopicsResult>(
    `/c/${encodeURIComponent(categorySlug)}/${categoryId}.json`,
    page > 0 ? { page: String(page) } : undefined,
  );
}

/**
 * Fetch all posts in a topic.
 * Returns the first ~20 posts; for longer topics we iterate post_ids.
 */
export async function getTopicPosts(topicId: number): Promise<ForumTopicPostsResult> {
  return forumGet<ForumTopicPostsResult>(`/t/${topicId}.json`);
}

/**
 * Fetch a specific page of posts for a topic (0-indexed).
 */
export async function getTopicPostsPage(topicId: number, page: number): Promise<ForumTopicPostsResult> {
  return forumGet<ForumTopicPostsResult>(`/t/${topicId}.json`, { page: String(page) });
}
