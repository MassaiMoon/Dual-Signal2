// ── X API pricing constants (pay-per-use, isolated so they can change without rewriting logic)
export const X_API_PRICING = {
  postReadUsd:    0.005,  // $ per post resource returned (GET /2/users/:id/tweets, GET /2/tweets)
  userLookupUsd:  0.010,  // $ per user resource returned (GET /2/users/by/username/:username)
} as const;

// Internal safety budget — stop syncing before reaching the X console's $10 hard cap
export const X_INTERNAL_BUDGET_USD = 8.00;

// Posts must contain at least one of these keywords (case-insensitive) to qualify.
// More specific entries must come before shorter/generic ones so the first match
// returns the most precise keyword (e.g. '$DUAL' before 'DUAL').
export const X_QUALIFYING_KEYWORDS = [
  '$DUAL',
  'dual.org',
  '@dualnetwork',
  '@DUAL',
  'DUAL',
] as const;

// Billing cycle anchor day-of-month (X console shows Sep 5 – Oct 5; anchor = 5)
export const X_BILLING_ANCHOR_DAY = 5;

export const achievementConfig = {
  xSignal: [
    { level: 1, name: 'FIRST_SIGNAL',  qualifyingPosts: 1, publicViews: 0,         points: 50  },
    { level: 2, name: 'SPARK',         publicViews: 1_000,                          points: 100 },
    { level: 3, name: 'PULSE',         publicViews: 10_000,                         points: 150 },
    { level: 4, name: 'WAVE',          publicViews: 100_000,                        points: 200 },
    { level: 5, name: 'IMPACT',        publicViews: 1_000_000,                      points: 250 },
  ],

  telegramPresence: [
    { level: 1, name: 'FIRST_CONTACT', activeDays: 1,   points: 50  },
    { level: 2, name: 'REGULAR',       activeDays: 7,   points: 100 },
    { level: 3, name: 'CONNECTED',     activeDays: 30,  points: 150 },
    { level: 4, name: 'CORE_MEMBER',   activeDays: 90,  points: 200 },
    { level: 5, name: 'PILLAR',        activeDays: 180, points: 250 },
  ],

  discord: [
    { level: 1, name: 'FIRST_CONTACT', activeDays: 1,   points: 50  },
    { level: 2, name: 'REGULAR',       activeDays: 7,   points: 100 },
    { level: 3, name: 'CONNECTED',     activeDays: 30,  points: 150 },
    { level: 4, name: 'CORE_MEMBER',   activeDays: 90,  points: 200 },
    { level: 5, name: 'PILLAR',        activeDays: 180, points: 250 },
  ],

  governance: [
    { level: 1, name: 'FIRST_VOICE',   participations: 1,  points: 50  },
    { level: 2, name: 'CONTRIBUTOR',   participations: 3,  points: 100 },
    { level: 3, name: 'PARTICIPANT',   participations: 10, points: 150 },
    { level: 4, name: 'GOVERNOR',      participations: 25, points: 200 },
    { level: 5, name: 'STEWARD',       participations: 50, points: 250 },
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
