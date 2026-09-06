import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyPost, isTopicOpener, sumActivityPoints } from '../forum-classifier';
import { resolveGovernanceLevel } from '../rules-engine';

// ── forum-classifier: isTopicOpener ──────────────────────────────────────────

describe('isTopicOpener', () => {
  it('returns true for post_number 1', () => {
    expect(isTopicOpener(1)).toBe(true);
  });

  it('returns false for post_number > 1', () => {
    expect(isTopicOpener(2)).toBe(false);
    expect(isTopicOpener(10)).toBe(false);
  });
});

// ── forum-classifier: classifyPost ───────────────────────────────────────────

describe('classifyPost — topic openers', () => {
  it('classifies cat-6 topic opener as TOPIC_CREATED (+10)', () => {
    const r = classifyPost(1, 6, 0);
    expect(r).not.toBeNull();
    expect(r!.activityType).toBe('TOPIC_CREATED');
    expect(r!.pointsAwarded).toBe(10);
  });

  it('classifies cat-7 topic opener as TOPIC_CREATED (+10)', () => {
    const r = classifyPost(1, 7, 0);
    expect(r?.activityType).toBe('TOPIC_CREATED');
    expect(r?.pointsAwarded).toBe(10);
  });

  it('classifies cat-8 topic opener as FORMAL_PROPOSAL (+20)', () => {
    const r = classifyPost(1, 8, 0);
    expect(r?.activityType).toBe('FORMAL_PROPOSAL');
    expect(r?.pointsAwarded).toBe(20);
  });
});

describe('classifyPost — comments', () => {
  it('first comment yields +3', () => {
    const r = classifyPost(2, 6, 0);
    expect(r?.activityType).toBe('COMMENT');
    expect(r?.pointsAwarded).toBe(3);
  });

  it('second comment yields +1 when existing=3', () => {
    const r = classifyPost(3, 6, 3);
    expect(r?.activityType).toBe('COMMENT');
    expect(r?.pointsAwarded).toBe(1);
  });

  it('third comment yields +1 when existing=4', () => {
    const r = classifyPost(4, 6, 4);
    expect(r?.activityType).toBe('COMMENT');
    expect(r?.pointsAwarded).toBe(1);
  });

  it('returns null when cap already reached (existing=5)', () => {
    expect(classifyPost(5, 6, 5)).toBeNull();
  });

  it('returns null when cap exceeded (existing=6)', () => {
    expect(classifyPost(5, 6, 6)).toBeNull();
  });

  it('clamps award so total never exceeds cap', () => {
    // existing=4, additional=1 → 4+1=5 = cap (ok, not exceeded)
    const r = classifyPost(3, 6, 4);
    expect(r?.pointsAwarded).toBe(1);
  });
});

// ── forum-classifier: sumActivityPoints ──────────────────────────────────────

describe('sumActivityPoints', () => {
  it('returns 0 for empty array', () => {
    expect(sumActivityPoints([])).toBe(0);
  });

  it('sums correctly', () => {
    expect(sumActivityPoints([
      { pointsAwarded: 10 },
      { pointsAwarded: 3 },
      { pointsAwarded: 1 },
    ])).toBe(14);
  });
});

// ── resolveGovernanceLevel ────────────────────────────────────────────────────

describe('resolveGovernanceLevel', () => {
  it('returns 0 below threshold', () => {
    expect(resolveGovernanceLevel(0)).toBe(0);
    expect(resolveGovernanceLevel(9)).toBe(0);
  });

  it('level 1 at 10 pts', () => {
    expect(resolveGovernanceLevel(10)).toBe(1);
    expect(resolveGovernanceLevel(29)).toBe(1);
  });

  it('level 2 at 30 pts', () => {
    expect(resolveGovernanceLevel(30)).toBe(2);
    expect(resolveGovernanceLevel(74)).toBe(2);
  });

  it('level 3 at 75 pts', () => {
    expect(resolveGovernanceLevel(75)).toBe(3);
    expect(resolveGovernanceLevel(149)).toBe(3);
  });

  it('level 4 at 150 pts', () => {
    expect(resolveGovernanceLevel(150)).toBe(4);
    expect(resolveGovernanceLevel(299)).toBe(4);
  });

  it('level 5 at 300 pts', () => {
    expect(resolveGovernanceLevel(300)).toBe(5);
    expect(resolveGovernanceLevel(9999)).toBe(5);
  });
});
