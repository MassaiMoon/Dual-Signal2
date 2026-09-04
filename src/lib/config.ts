export const achievementConfig = {
  xSignal: [
    { level: 1, name: 'FIRST_SIGNAL',  qualifyingPosts: 1, impressions: 0,       points: 50  },
    { level: 2, name: 'SPARK',         impressions: 1_000,                        points: 100 },
    { level: 3, name: 'PULSE',         impressions: 10_000,                       points: 150 },
    { level: 4, name: 'WAVE',          impressions: 100_000,                      points: 200 },
    { level: 5, name: 'IMPACT',        impressions: 1_000_000,                    points: 250 },
  ],

  telegramPresence: [
    { level: 1, name: 'FIRST_CONTACT', activeDays: 1,   points: 50  },
    { level: 2, name: 'REGULAR',       activeDays: 7,   points: 100 },
    { level: 3, name: 'CONNECTED',     activeDays: 30,  points: 150 },
    { level: 4, name: 'CORE_MEMBER',   activeDays: 90,  points: 200 },
    { level: 5, name: 'PILLAR',        activeDays: 180, points: 250 },
  ],

  governance: [
    { level: 1, name: 'FIRST_VOTE',   votes: 1,  points: 50  },
    { level: 2, name: 'VOTER',         votes: 3,  points: 100 },
    { level: 3, name: 'PARTICIPANT',   votes: 10, points: 150 },
    { level: 4, name: 'GOVERNOR',      votes: 25, points: 200 },
    { level: 5, name: 'STEWARD',       votes: 50, points: 250 },
  ],

  holderStaking: [
    { level: 1, name: 'HOLDER',        qualifyingDays: 0,   points: 50  },
    { level: 2, name: 'COMMITTED',     qualifyingDays: 30,  points: 100 },
    { level: 3, name: 'DEDICATED',     qualifyingDays: 90,  points: 150 },
    { level: 4, name: 'BELIEVER',      qualifyingDays: 180, points: 200 },
    { level: 5, name: 'DIAMOND_WINGS', qualifyingDays: 365, points: 250 },
  ],

  butterflyTiers: [
    { name: 'INITIATE',    minScore: 0   },
    { name: 'EXPLORER',    minScore: 150 },
    { name: 'BUILDER',     minScore: 350 },
    { name: 'STAKEHOLDER', minScore: 550 },
    { name: 'GENESIS',     minScore: 750 },
    { name: 'LEGEND',      minScore: 900 },
  ],

  ogCutoff: '2017-12-31T23:59:59Z',
  maxSignalScore: 1000,
} as const;

export function calculateTier(score: number): string {
  if (score >= 900) return 'LEGEND';
  if (score >= 750) return 'GENESIS';
  if (score >= 550) return 'STAKEHOLDER';
  if (score >= 350) return 'BUILDER';
  if (score >= 150) return 'EXPLORER';
  return 'INITIATE';
}
