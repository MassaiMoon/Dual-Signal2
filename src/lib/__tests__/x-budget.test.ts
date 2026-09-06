import { describe, it, expect } from 'vitest';
import { getBillingCycleKey, estimatePostReadCost, estimateUserLookupCost } from '../x-budget';

// ── getBillingCycleKey ────────────────────────────────────────────────────────

describe('getBillingCycleKey', () => {
  it('returns current cycle start when date is on anchor day', () => {
    const date = new Date('2026-09-05T10:00:00Z'); // Sep 5 = cycle start
    expect(getBillingCycleKey(date)).toBe('2026-09-05');
  });

  it('returns current cycle when date is after anchor day', () => {
    const date = new Date('2026-09-20T10:00:00Z'); // Sep 20, cycle started Sep 5
    expect(getBillingCycleKey(date)).toBe('2026-09-05');
  });

  it('returns previous cycle when date is before anchor day', () => {
    const date = new Date('2026-09-04T10:00:00Z'); // Sep 4, still in Aug 5 cycle
    expect(getBillingCycleKey(date)).toBe('2026-08-05');
  });

  it('handles January → December rollover', () => {
    const date = new Date('2026-01-03T10:00:00Z'); // Jan 3, before anchor=5 → Dec 5
    expect(getBillingCycleKey(date)).toBe('2025-12-05');
  });

  it('handles end-of-cycle on Oct 4 (one day before next cycle)', () => {
    const date = new Date('2026-10-04T23:59:00Z');
    expect(getBillingCycleKey(date)).toBe('2026-09-05');
  });

  it('new cycle starts on Oct 5', () => {
    const date = new Date('2026-10-05T00:01:00Z');
    expect(getBillingCycleKey(date)).toBe('2026-10-05');
  });
});

// ── Cost estimates ────────────────────────────────────────────────────────────

describe('estimatePostReadCost', () => {
  it('returns $0.005 per post', () => {
    expect(estimatePostReadCost(1)).toBeCloseTo(0.005);
    expect(estimatePostReadCost(100)).toBeCloseTo(0.50);
    expect(estimatePostReadCost(0)).toBe(0);
  });
});

describe('estimateUserLookupCost', () => {
  it('returns $0.010 per user', () => {
    expect(estimateUserLookupCost(1)).toBeCloseTo(0.010);
    expect(estimateUserLookupCost(30)).toBeCloseTo(0.30);
  });
});
