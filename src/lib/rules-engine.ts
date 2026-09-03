/**
 * Rules engine — decides whether an event counts toward achievements
 * and which achievements to unlock.
 *
 * All thresholds are defined here (not in the DUAL template).
 * Change numbers here; no migration needed.
 */

import { AchievementType } from '@prisma/client';

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const THRESHOLDS: Record<AchievementType, number> = {
  FIRST_SIGNAL:  1,
  AMPLIFIER_I:   5,
  AMPLIFIER_II:  25,
  BROADCASTER:   100,
  ADVOCATE:      1,    // manual approval gate — progress checked separately
  EDUCATOR:      1,    // manual
  RESEARCHER:    1,    // manual
  BUG_HUNTER:    1,    // manual
  EVENT_PASS:    1,    // event attendance — manual
};

// Achievements that require manual approval (rules engine won't auto-unlock)
export const MANUAL_ACHIEVEMENTS = new Set<AchievementType>([
  AchievementType.ADVOCATE,
  AchievementType.EDUCATOR,
  AchievementType.RESEARCHER,
  AchievementType.BUG_HUNTER,
  AchievementType.EVENT_PASS,
]);

// Achievements that stack from signal_count (auto-awarded in order)
export const SIGNAL_ACHIEVEMENTS: AchievementType[] = [
  AchievementType.FIRST_SIGNAL,
  AchievementType.AMPLIFIER_I,
  AchievementType.AMPLIFIER_II,
  AchievementType.BROADCASTER,
];

// ─── Event qualification ───────────────────────────────────────────────────────

export type IncomingEvent = {
  source: string;
  type: string;          // POST_CREATED, REPLY, etc.
  externalUserId: string;
  contentId: string;     // unique ID of the piece of content
  payload: Record<string, unknown>;
};

/**
 * Returns true if this event type counts toward signal_count.
 * Extend this list as real sources are added.
 */
export function qualifiesForSignal(event: IncomingEvent): boolean {
  const qualifyingTypes = ['POST_CREATED', 'SHARE', 'REPLY', 'THREAD'];
  return qualifyingTypes.includes(event.type.toUpperCase());
}

// ─── Achievement resolution ───────────────────────────────────────────────────

export type AchievementChange = {
  achievementType: AchievementType;
  newLevel: number;
  newProgress: number;
};

/**
 * Given the current signal_count (after incrementing by 1),
 * returns which achievements just crossed their threshold and should be
 * written to the DUAL object.
 */
export function resolveSignalAchievements(
  signalCount: number,
  currentLevels: Map<AchievementType, number>
): AchievementChange[] {
  const changes: AchievementChange[] = [];

  for (const type of SIGNAL_ACHIEVEMENTS) {
    const threshold = THRESHOLDS[type];
    const currentLevel = currentLevels.get(type) ?? 0;
    if (signalCount >= threshold && currentLevel === 0) {
      changes.push({ achievementType: type, newLevel: 1, newProgress: signalCount });
    }
  }

  return changes;
}

// ─── DUAL custom property builder ─────────────────────────────────────────────

/**
 * Translates local achievement state into the DUAL object's custom properties.
 * All values must be strings (DUAL custom fields are stringly-typed).
 */
export function buildDualCustomState(
  signalCount: number,
  unlockedAchievements: Set<AchievementType>,
  identityTier: string,
  flags: { isGenesis: boolean; isStakeholder: boolean; isGovernor: boolean }
): Record<string, string> {
  // Highest unlocked signal achievement becomes the badge's displayed level
  let achievementLevel = '';
  for (const type of [...SIGNAL_ACHIEVEMENTS].reverse()) {
    if (unlockedAchievements.has(type)) { achievementLevel = type; break; }
  }

  return {
    identity_tier:    identityTier,
    signal_count:     String(signalCount),
    achievement_level: achievementLevel,
    is_genesis:       String(flags.isGenesis),
    is_stakeholder:   String(flags.isStakeholder),
    is_governor:      String(flags.isGovernor),
    advocate_approved: String(unlockedAchievements.has(AchievementType.ADVOCATE)),
  };
}
