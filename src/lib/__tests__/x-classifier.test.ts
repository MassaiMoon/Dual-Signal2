import { describe, it, expect } from 'vitest';
import { classifyPost, matchesDualKeyword } from '../x-classifier';
import type { XPost } from '../x-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<XPost> = {}): XPost {
  return {
    id: '123',
    text: 'Hello world',
    created_at: '2026-09-01T12:00:00Z',
    public_metrics: {
      repost_count: 0,
      reply_count: 0,
      like_count: 0,
      quote_count: 0,
      bookmark_count: 0,
      impression_count: 100,
    },
    ...overrides,
  };
}

// ── matchesDualKeyword ────────────────────────────────────────────────────────

describe('matchesDualKeyword', () => {
  it('matches DUAL (case-insensitive)', () => {
    expect(matchesDualKeyword('excited about dual governance')).toBe('DUAL');
    expect(matchesDualKeyword('DUAL protocol is live')).toBe('DUAL');
    // 'Dual.org is great' matches the 'dual.org' keyword (not null — dual.org IS a keyword)
    expect(matchesDualKeyword('Dual.org is great')).toBe('dual.org');
  });

  it('matches $DUAL', () => {
    expect(matchesDualKeyword('Bought some $DUAL today')).toBe('$DUAL');
    expect(matchesDualKeyword('$dual to the moon')).toBe('$DUAL');
  });

  it('matches dual.org', () => {
    expect(matchesDualKeyword('check out dual.org for more')).toBe('dual.org');
    expect(matchesDualKeyword('Visit DUAL.ORG today')).toBe('dual.org');
  });

  it('matches @dualnetwork', () => {
    expect(matchesDualKeyword('shoutout to @dualnetwork')).toBe('@dualnetwork');
    expect(matchesDualKeyword('@DUALNETWORK rocks')).toBe('@dualnetwork');
  });

  it('returns null for unrelated text', () => {
    expect(matchesDualKeyword('just a normal tweet about nothing')).toBeNull();
    expect(matchesDualKeyword('ethereum, bitcoin, solana')).toBeNull();
  });
});

// ── classifyPost ─────────────────────────────────────────────────────────────

describe('classifyPost', () => {
  it('qualifies a post containing DUAL keyword', () => {
    const result = classifyPost(makePost({ text: 'Just staked my $DUAL tokens!' }));
    expect(result.qualifies).toBe(true);
    expect(result.matchedKeyword).toBe('$DUAL');
    expect(result.reason).toBe('keyword_match');
  });

  it('does not qualify a plain repost (retweeted)', () => {
    const result = classifyPost(makePost({
      text: 'RT @user: $DUAL is amazing',
      referenced_tweets: [{ type: 'retweeted', id: '999' }],
    }));
    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe('repost');
  });

  it('qualifies a quote-post where user text contains keyword', () => {
    const result = classifyPost(makePost({
      text: 'Great thread on dual.org governance! QT:',
      referenced_tweets: [{ type: 'quoted', id: '888' }],
    }));
    expect(result.qualifies).toBe(true);
    expect(result.matchedKeyword).toBe('dual.org');
  });

  it('does not qualify a reply that lacks any keyword', () => {
    const result = classifyPost(makePost({
      text: 'Totally agree with you!',
      referenced_tweets: [{ type: 'replied_to', id: '777' }],
    }));
    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe('no_keyword');
  });

  it('qualifies a reply that contains a keyword', () => {
    const result = classifyPost(makePost({
      text: 'Yes, $DUAL governance is live now',
      referenced_tweets: [{ type: 'replied_to', id: '777' }],
    }));
    expect(result.qualifies).toBe(true);
  });

  it('does not qualify a non-DUAL post', () => {
    const result = classifyPost(makePost({ text: 'BTC hitting new ATH today!' }));
    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe('no_keyword');
  });
});
