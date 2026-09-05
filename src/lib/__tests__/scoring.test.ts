import { describe, it, expect } from 'vitest';
import {
  resolveXSignalLevel,
  resolveTelegramLevel,
  resolveDiscordLevel,
  resolveGovernanceLevel,
  computeSignalScore,
} from '../rules-engine';
import { calculateTier } from '../config';

// ─── X Signal ─────────────────────────────────────────────────────────────────

describe('resolveXSignalLevel', () => {
  it('returns 0 when no posts', () => {
    expect(resolveXSignalLevel(0, 0)).toBe(0);
    expect(resolveXSignalLevel(999999, 0)).toBe(0); // views without posts = nothing
  });

  it('returns 1 (FIRST_SIGNAL) when ≥1 qualifying post', () => {
    expect(resolveXSignalLevel(0, 1)).toBe(1);
    expect(resolveXSignalLevel(500, 1)).toBe(1);
  });

  it('returns 2 (SPARK) at 1,000+ public views with ≥1 post', () => {
    expect(resolveXSignalLevel(999, 1)).toBe(1);
    expect(resolveXSignalLevel(1_000, 1)).toBe(2);
    expect(resolveXSignalLevel(9_999, 3)).toBe(2);
  });

  it('returns 3 (PULSE) at 10,000+ public views', () => {
    expect(resolveXSignalLevel(10_000, 1)).toBe(3);
  });

  it('returns 4 (WAVE) at 100,000+ public views', () => {
    expect(resolveXSignalLevel(100_000, 1)).toBe(4);
  });

  it('returns 5 (IMPACT) at 1,000,000+ public views', () => {
    expect(resolveXSignalLevel(1_000_000, 1)).toBe(5);
  });
});

// ─── Telegram ─────────────────────────────────────────────────────────────────

describe('resolveTelegramLevel', () => {
  it('returns 0 when no active days', () => {
    expect(resolveTelegramLevel(0)).toBe(0);
  });

  it('returns 1 (FIRST_CONTACT) at 1 active day', () => {
    expect(resolveTelegramLevel(1)).toBe(1);
    expect(resolveTelegramLevel(6)).toBe(1);
  });

  it('returns 2 (REGULAR) at 7 active days', () => {
    expect(resolveTelegramLevel(7)).toBe(2);
    expect(resolveTelegramLevel(29)).toBe(2);
  });

  it('returns 3 (CONNECTED) at 30 active days', () => {
    expect(resolveTelegramLevel(30)).toBe(3);
  });

  it('returns 4 (CORE_MEMBER) at 90 active days', () => {
    expect(resolveTelegramLevel(90)).toBe(4);
  });

  it('returns 5 (PILLAR) at 180 active days', () => {
    expect(resolveTelegramLevel(180)).toBe(5);
    expect(resolveTelegramLevel(365)).toBe(5);
  });
});

// ─── Discord ──────────────────────────────────────────────────────────────────

describe('resolveDiscordLevel', () => {
  it('returns 0 when no active days', () => {
    expect(resolveDiscordLevel(0)).toBe(0);
  });

  it('mirrors telegram thresholds exactly', () => {
    expect(resolveDiscordLevel(1)).toBe(1);
    expect(resolveDiscordLevel(7)).toBe(2);
    expect(resolveDiscordLevel(30)).toBe(3);
    expect(resolveDiscordLevel(90)).toBe(4);
    expect(resolveDiscordLevel(180)).toBe(5);
  });
});

// ─── Governance ───────────────────────────────────────────────────────────────

describe('resolveGovernanceLevel', () => {
  it('returns 0 with no participations', () => {
    expect(resolveGovernanceLevel(0)).toBe(0);
  });

  it('returns 1 (FIRST_VOICE) at 1 participation', () => {
    expect(resolveGovernanceLevel(1)).toBe(1);
    expect(resolveGovernanceLevel(2)).toBe(1);
  });

  it('returns 2 (CONTRIBUTOR) at 3 participations', () => {
    expect(resolveGovernanceLevel(3)).toBe(2);
  });

  it('returns 3 (PARTICIPANT) at 10 participations', () => {
    expect(resolveGovernanceLevel(10)).toBe(3);
  });

  it('returns 4 (GOVERNOR) at 25 participations', () => {
    expect(resolveGovernanceLevel(25)).toBe(4);
  });

  it('returns 5 (STEWARD) at 50 participations', () => {
    expect(resolveGovernanceLevel(50)).toBe(5);
  });
});

// ─── Score computation ────────────────────────────────────────────────────────

describe('computeSignalScore', () => {
  it('returns 0 for all-zero levels', () => {
    expect(computeSignalScore(0, 0, 0, 0)).toBe(0);
  });

  it('caps at 1000 at full level 5 across all tracks', () => {
    expect(computeSignalScore(5, 5, 5, 5)).toBe(1000);
  });

  it('each track contributes correctly at level 1 (50pts each)', () => {
    expect(computeSignalScore(1, 0, 0, 0)).toBe(50);
    expect(computeSignalScore(0, 1, 0, 0)).toBe(50);
    expect(computeSignalScore(0, 0, 1, 0)).toBe(50);
    expect(computeSignalScore(0, 0, 0, 1)).toBe(50);
  });

  it('each track at level 5 contributes 250pts', () => {
    expect(computeSignalScore(5, 0, 0, 0)).toBe(250);
    expect(computeSignalScore(0, 5, 0, 0)).toBe(250);
    expect(computeSignalScore(0, 0, 5, 0)).toBe(250);
    expect(computeSignalScore(0, 0, 0, 5)).toBe(250);
  });

  it('mixed levels sum correctly', () => {
    // x=2(100) + tg=3(150) + dc=1(50) + gov=0(0) = 300
    expect(computeSignalScore(2, 3, 1, 0)).toBe(300);
  });
});

// ─── Tier calculation ─────────────────────────────────────────────────────────

describe('calculateTier', () => {
  it('INITIATE from 0', () => expect(calculateTier(0)).toBe('INITIATE'));
  it('EXPLORER from 150', () => expect(calculateTier(150)).toBe('EXPLORER'));
  it('BUILDER from 350', () => expect(calculateTier(350)).toBe('BUILDER'));
  it('STAKEHOLDER from 550', () => expect(calculateTier(550)).toBe('STAKEHOLDER'));
  it('GENESIS from 750', () => expect(calculateTier(750)).toBe('GENESIS'));
  it('LEGEND from 900', () => expect(calculateTier(900)).toBe('LEGEND'));

  it('boundary: 149 is still INITIATE', () => expect(calculateTier(149)).toBe('INITIATE'));
  it('boundary: 349 is still EXPLORER', () => expect(calculateTier(349)).toBe('EXPLORER'));
  it('boundary: 1000 is LEGEND', () => expect(calculateTier(1000)).toBe('LEGEND'));
});

// ─── End-to-end score scenarios ───────────────────────────────────────────────

describe('full scoring scenarios', () => {
  it('EXPLORER: x=1, tg=1, dc=0, gov=1 → 150pts', () => {
    const x   = resolveXSignalLevel(0, 1);    // L1
    const tg  = resolveTelegramLevel(1);       // L1
    const dc  = resolveDiscordLevel(0);        // L0
    const gov = resolveGovernanceLevel(1);     // L1
    const score = computeSignalScore(x, tg, dc, gov);
    expect(score).toBe(150);
    expect(calculateTier(score)).toBe('EXPLORER');
  });

  it('LEGEND: all tracks L5 → 1000pts', () => {
    const score = computeSignalScore(5, 5, 5, 5);
    expect(score).toBe(1000);
    expect(calculateTier(score)).toBe('LEGEND');
  });

  it('X Level 1 bug: 0 posts cannot unlock L1 even with views', () => {
    expect(resolveXSignalLevel(1_000_000, 0)).toBe(0);
  });
});
