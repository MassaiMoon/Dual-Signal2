// ── X API pricing constants (pay-per-use, isolated so they can change without rewriting logic)
export const X_API_PRICING = {
  postReadUsd:    0.005,  // $ per post resource returned (GET /2/users/:id/tweets, GET /2/tweets)
  userLookupUsd:  0.010,  // $ per user resource returned (GET /2/users/by/username/:username)
} as const;

// Internal safety budget — stop syncing before reaching the X console's $10 hard cap
export const X_INTERNAL_BUDGET_USD = 8.00;

// Only posts on or after this date qualify for DUAL signal points.
// Override with X_POST_CUTOFF_DATE env var (ISO 8601, e.g. "2026-09-06T00:00:00Z").
// Posts already in the DB before this date are retroactively disqualified on the next sync.
export const X_POST_CUTOFF_DATE: string =
  process.env.X_POST_CUTOFF_DATE ?? '2026-09-06T00:00:00.000Z';

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

// ── Governance Forum ───────────────────────────────────────────────────────────

// Discourse category IDs that qualify for governance signal.
// 6 = Ecosystem Direction, 7 = Protocol Improvements, 8 = Treasury Grants
export const GOVERNANCE_QUALIFYING_CATEGORY_IDS = [6, 7, 8] as const;

// Discourse category IDs whose topics count as FORMAL_PROPOSAL (+20 pts) not TOPIC_CREATED (+10 pts).
// 8 = Treasury Grants (grant/spending proposals)
export const GOVERNANCE_PROPOSAL_CATEGORY_IDS = [8] as const;

// Activity point values — change here, nowhere else.
export const GOVERNANCE_ACTIVITY_POINTS = {
  pollParticipation:  5,  // manual-only in V1
  firstComment:       3,
  additionalComment:  1,
  topicCreated:       10,
  formalProposal:     20,
} as const;

// Maximum comment activity points a user can earn from a single topic.
// (3 first + 1 additional, capped at 5 total)
export const GOVERNANCE_COMMENT_POINTS_CAP = 5;

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
    { level: 1, name: 'FIRST_VOICE',   activityPoints: 10,  points: 50  },
    { level: 2, name: 'CONTRIBUTOR',   activityPoints: 30,  points: 100 },
    { level: 3, name: 'PARTICIPANT',   activityPoints: 75,  points: 150 },
    { level: 4, name: 'GOVERNOR',      activityPoints: 150, points: 200 },
    { level: 5, name: 'STEWARD',       activityPoints: 300, points: 250 },
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
