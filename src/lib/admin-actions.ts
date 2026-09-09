/**
 * Admin action helpers — username rename and member reset.
 *
 * All functions import db and ebus directly; test files vi.mock both modules.
 * No real DUAL API calls or DB access in tests.
 */

import { db } from './db';
import { ebus } from './dual-client';

// ─── Validation ───────────────────────────────────────────────────────────────

const USERNAME_RE = /^[A-Za-z0-9_-]{3,24}$/;

export function validateUsername(raw: string): string | null {
  const u = (raw ?? '').trim();
  if (u.length === 0) return 'Username is required';
  if (u.length < 3)   return 'Username must be at least 3 characters';
  if (u.length > 24)  return 'Username must be 24 characters or fewer';
  if (!USERNAME_RE.test(u)) return 'Username may only contain letters, numbers, underscores, and hyphens';
  return null;
}

// ─── Username rename ──────────────────────────────────────────────────────────

export interface RenameResult {
  oldUsername:         string;
  newUsername:         string;
  dualCustomUpdated:   boolean;
  dualNote:            string;
}

export async function renameUsername(
  badgeId:     string,
  newUsername: string,
): Promise<RenameResult> {
  const trimmed    = newUsername.trim();
  const normalized = trimmed.toLowerCase();

  const validErr = validateUsername(trimmed);
  if (validErr) throw new Error(validErr);

  // Load badge + user (single query)
  const badge = await db.badge.findUnique({
    where:   { id: badgeId },
    include: { user: true },
  });
  if (!badge)       throw new Error('Passport not found');
  if (!badge.user)  throw new Error('Passport has no linked user');

  const oldUsername   = badge.user.username ?? '';
  const oldNormalized = badge.user.usernameNormalized ?? '';

  // No-op check
  if (normalized === oldNormalized) throw new Error('New username is the same as the current one');

  // Uniqueness check (case-insensitive)
  const conflict = await db.user.findUnique({ where: { usernameNormalized: normalized } });
  if (conflict && conflict.id !== badge.user.id) {
    throw new Error('Username is already taken');
  }

  // Update DB
  await db.user.update({
    where: { id: badge.user.id },
    data:  { username: trimmed, usernameNormalized: normalized },
  });

  console.log(`[admin-actions] ADMIN_USERNAME_CHANGED badge=${badgeId} "${oldUsername}" → "${trimmed}"`);

  // Attempt DUAL custom.username update via Event Bus
  // metadata.name ("DUAL // SIGNAL — <username>") cannot be updated via Event Bus;
  // only custom.username is updated here.
  let dualCustomUpdated = false;
  let dualNote = 'metadata.name not updatable via Event Bus (custom.username updated only)';

  if (badge.dualObjectId && badge.dualObjectId !== 'MOCK-OBJECT-ID') {
    try {
      await ebus.execute({
        update: {
          id:   badge.dualObjectId,
          data: { custom: { username: trimmed } },
        },
      });
      dualCustomUpdated = true;
      dualNote = 'custom.username updated on DUAL Object; metadata.name not updatable via Event Bus';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dualNote = `DUAL custom.username update failed: ${msg} — DB is updated; DUAL Object may need manual review`;
      console.error(`[admin-actions] DUAL username update failed for badge=${badgeId} objectId=${badge.dualObjectId}:`, msg);
    }
  } else {
    dualNote = 'MOCK object — DUAL update skipped';
  }

  return { oldUsername, newUsername: trimmed, dualCustomUpdated, dualNote };
}

// ─── Member reset ─────────────────────────────────────────────────────────────

export interface ResetResult {
  deletedBadgeId:    string;
  deletedUserId:     string;
  deletedMemberAuthId: string | null;
  oldDualObjectId:   string;
  dualBurned:        boolean;
}

export async function resetMember(
  badgeId:        string,
  burnDualObject: boolean,
): Promise<ResetResult> {
  // Load full member context before any mutations
  const badge = await db.badge.findUnique({
    where:   { id: badgeId },
    include: {
      user: {
        include: {
          memberAuth:       true,
          externalAccounts: { select: { id: true } },
        },
      },
    },
  });

  if (!badge)      throw new Error('Passport not found');
  if (!badge.user) throw new Error('Passport has no linked user');

  const userId         = badge.user.id;
  const memberAuthId   = badge.user.memberAuth?.id ?? null;
  const extAccountIds  = badge.user.externalAccounts.map(a => a.id);
  const dualObjectId   = badge.dualObjectId;

  // ── Optional DUAL burn (before any DB deletion) ───────────────────────────

  let dualBurned = false;

  if (burnDualObject && dualObjectId && dualObjectId !== 'MOCK-OBJECT-ID') {
    try {
      await ebus.execute({ burn: { id: dualObjectId } });
      dualBurned = true;
      console.log(`[admin-actions] Burned DUAL Object ${dualObjectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`DUAL burn failed — reset aborted to prevent inconsistency. Error: ${msg}`);
    }
  }

  // ── DB deletion (in a single transaction) ────────────────────────────────

  await db.$transaction(async (tx) => {
    // 1. Badge evidence — order matters for FK constraints
    await tx.badgeUpdate.deleteMany({ where: { badgeId } });
    await tx.xPost.deleteMany({ where: { badgeId } });
    await tx.discordActiveDay.deleteMany({ where: { badgeId } });
    await tx.telegramActiveDay.deleteMany({ where: { badgeId } });
    await tx.governanceParticipation.deleteMany({ where: { badgeId } });
    await tx.governanceActivity.deleteMany({ where: { badgeId } });

    // 2. Badge itself
    await tx.badge.delete({ where: { id: badgeId } });

    // 3. External account events + accounts (events first — nullable FK)
    if (extAccountIds.length > 0) {
      await tx.event.deleteMany({ where: { externalAccountId: { in: extAccountIds } } });
      await tx.externalAccount.deleteMany({ where: { id: { in: extAccountIds } } });
    }

    // 4. Null out TelegramImportIdentity match references (plain strings, no FK)
    //    so those identities can be re-matched to a new account later.
    await tx.telegramImportIdentity.updateMany({
      where: {
        OR: [
          { matchedUserId:  userId },
          { matchedBadgeId: badgeId },
        ],
      },
      data: {
        matchedUserId:  null,
        matchedBadgeId: null,
        matchReason:    null,
        status:         'UNMATCHED',
      },
    });

    // 5. Disconnect MemberAuth from User (clears FK before User delete)
    if (memberAuthId) {
      await tx.memberAuth.update({ where: { id: memberAuthId }, data: { userId: null } });
    }

    // 6. Delete User
    await tx.user.delete({ where: { id: userId } });

    // 7. Delete MemberAuth — cascades MemberSession + LoginToken
    if (memberAuthId) {
      await tx.memberAuth.delete({ where: { id: memberAuthId } });
    }
  });

  console.log(
    `[admin-actions] ADMIN_MEMBER_RESET badgeId=${badgeId} userId=${userId} ` +
    `memberAuthId=${memberAuthId ?? 'none'} oldDualObjectId=${dualObjectId} burned=${dualBurned}`,
  );

  return {
    deletedBadgeId:     badgeId,
    deletedUserId:      userId,
    deletedMemberAuthId: memberAuthId,
    oldDualObjectId:    dualObjectId,
    dualBurned,
  };
}
