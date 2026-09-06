/**
 * X post classifier — determines if a post qualifies as DUAL-related.
 *
 * Rules (V1, deterministic, no AI):
 *   - Plain reposts (type=retweeted) never qualify.
 *   - Replies qualify only if the user's own text contains a DUAL keyword.
 *   - Quote posts qualify if the user's own text contains a DUAL keyword.
 *   - Classification uses configurable X_QUALIFYING_KEYWORDS (case-insensitive).
 *
 * No API calls, no DB access — pure functions only.
 */

import { X_QUALIFYING_KEYWORDS } from './config';
import type { XPost } from './x-client';

export interface ClassificationResult {
  qualifies:      boolean;
  matchedKeyword: string | null;
  reason:         string;
}

/**
 * Check if post text contains at least one qualifying DUAL keyword (case-insensitive).
 */
export function matchesDualKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of X_QUALIFYING_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

/**
 * Classify an XPost from the API.
 * Returns qualifies=false with a reason string for non-qualifying posts.
 */
export function classifyPost(post: XPost): ClassificationResult {
  // Plain repost — never counts
  const isRepost = post.referenced_tweets?.some(r => r.type === 'retweeted') ?? false;
  if (isRepost) {
    return { qualifies: false, matchedKeyword: null, reason: 'repost' };
  }

  const matchedKeyword = matchesDualKeyword(post.text);
  if (!matchedKeyword) {
    return { qualifies: false, matchedKeyword: null, reason: 'no_keyword' };
  }

  return { qualifies: true, matchedKeyword, reason: 'keyword_match' };
}
