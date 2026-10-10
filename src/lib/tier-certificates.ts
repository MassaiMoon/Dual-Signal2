/**
 * Tier certificates — wallet-owned DUAL objects recording each tier a member
 * reaches. The live Passport stays org-owned so it can keep updating.
 *
 * queueOwedCertificates(): adds a row for every tier a member has reached but
 *   has no certificate for (cumulative, so existing members are backfilled).
 * issueCertificates(): for queued rows whose owner has a DUAL wallet in our
 *   org (matched by email), mints the certificate and transfers it to them.
 *   Rows wait in AWAITING_WALLET until the member creates a wallet.
 *
 * DUAL writes run one at a time — DUAL uses per-account nonces.
 */

import { CertificateStatus, Tier } from '@prisma/client';
import { db } from './db';
import { ebus, org, type DualOrgWallet } from './dual-client';
import { achievementConfig } from './config';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE   = 10;

const TIERS = achievementConfig.butterflyTiers;

/** Every tier up to and including `current`. */
export function owedTiers(current: Tier): Tier[] {
  const idx = TIERS.findIndex(t => t.name === current);
  return TIERS.slice(0, idx + 1).map(t => t.name as Tier);
}

/** Real score for the tier just reached; the threshold for tiers passed on the way. */
export function scoreForTier(tier: Tier, currentTier: Tier, currentScore: number): number {
  if (tier === currentTier) return currentScore;
  return TIERS.find(t => t.name === tier)?.minScore ?? 0;
}

const normEmail = (e: string) => e.trim().toLowerCase();

/** Usable wallets keyed by lower-cased email. */
export function indexWallets(wallets: DualOrgWallet[]): Map<string, DualOrgWallet> {
  const byEmail = new Map<string, DualOrgWallet>();
  for (const w of wallets) {
    if (w.email && w.activated && !w.disabled && w.account?.address) byEmail.set(normEmail(w.email), w);
  }
  return byEmail;
}

async function fetchAllOrgWallets(): Promise<DualOrgWallet[]> {
  const all: DualOrgWallet[] = [];
  let next: string | undefined;
  for (let page = 0; page < 200; page++) {
    const res = await org.listWallets(next);
    all.push(...(res.wallets ?? []));
    if (!res.next || (res.wallets ?? []).length === 0) break;
    next = res.next;
  }
  return all;
}

export async function queueOwedCertificates(): Promise<number> {
  const badges = await db.badge.findMany({
    where:  { user: { memberAuth: { isNot: null } } },
    select: {
      id: true, cachedTier: true, signalScore: true, createdAt: true,
      tierCertificates: { select: { tier: true } },
    },
  });

  const now  = new Date();
  const rows = badges.flatMap(b => {
    const have = new Set(b.tierCertificates.map(c => c.tier));
    return owedTiers(b.cachedTier)
      .filter(t => !have.has(t))
      .map(tier => ({
        badgeId:            b.id,
        tier,
        scoreAtAchievement: scoreForTier(tier, b.cachedTier, b.signalScore),
        // INITIATE is reached on joining; later tiers are dated when first seen.
        achievedAt:         tier === Tier.INITIATE ? b.createdAt : now,
      }));
  });

  if (rows.length === 0) return 0;
  const { count } = await db.tierCertificate.createMany({ data: rows, skipDuplicates: true });
  return count;
}

let running: Promise<void> | null = null;

/**
 * Queue + issue, at most one run at a time. Callers fire the update worker
 * without awaiting, so overlapping runs would otherwise mint the same row twice.
 */
export function runCertificates(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const queued = await queueOwedCertificates();
      const { transferred, failed } = await issueCertificates();
      if (queued || transferred || failed) {
        console.log(`[tier-certs] queued=${queued} transferred=${transferred} failed=${failed}`);
      }
    } catch (err) {
      console.error('[tier-certs] Run failed:', err instanceof Error ? err.message : err);
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function issueCertificates(): Promise<{ transferred: number; failed: number }> {
  const templateId = process.env.DUAL_TIER_CERT_TEMPLATE_ID;
  if (!templateId) return { transferred: 0, failed: 0 };

  const rows = await db.tierCertificate.findMany({
    where:   { status: { in: [CertificateStatus.AWAITING_WALLET, CertificateStatus.MINTED] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    include: { badge: { include: { user: { include: { memberAuth: { select: { email: true } } } } } } },
  });
  if (rows.length === 0) return { transferred: 0, failed: 0 };

  // Mint/transfer fail with an opaque "internal error" when the org has no VEE.
  const { amount } = await org.balance();
  if (!(Number(amount) > 0)) {
    console.warn('[tier-certs] Org VEE balance is empty — skipping issuance');
    return { transferred: 0, failed: 0 };
  }

  const walletByEmail = indexWallets(await fetchAllOrgWallets());
  let transferred = 0, failed = 0, processed = 0;

  for (const row of rows) {
    if (processed >= BATCH_SIZE) break;
    const email  = row.badge.user?.memberAuth?.email;
    const wallet = email ? walletByEmail.get(normEmail(email)) : undefined;
    if (!wallet) continue;

    processed++;
    try {
      let objectId = row.dualObjectId;

      if (!objectId) {
        // Reserve the serial before minting so a DB conflict can't orphan a minted object.
        let serial = row.serial;
        if (!serial) {
          const { _max } = await db.tierCertificate.aggregate({ where: { tier: row.tier }, _max: { serial: true } });
          serial = (_max.serial ?? 0) + 1;
          await db.tierCertificate.update({ where: { id: row.id }, data: { serial } });
        }

        const username = row.badge.user?.username ?? '';
        const result = await ebus.mint(
          templateId,
          {
            tier:                 row.tier,
            username,
            score_at_achievement: String(row.scoreAtAchievement),
            achieved_at:          row.achievedAt.toISOString().slice(0, 10),
            member_since:         row.badge.memberSince,
            serial:               String(serial),
            passport_object_id:   row.badge.dualObjectId,
          },
          { name: `DUAL // SIGNAL ${row.tier} — ${username}` },
        );
        objectId = result.steps?.[0]?.output?.ids?.[0] ?? null;
        if (!objectId) throw new Error(`Mint returned no object ID: ${JSON.stringify(result)}`);

        await db.tierCertificate.update({
          where: { id: row.id },
          data:  { status: CertificateStatus.MINTED, dualObjectId: objectId },
        });
      }

      await ebus.transfer(objectId, wallet.account.address);
      await db.tierCertificate.update({
        where: { id: row.id },
        data:  { status: CertificateStatus.TRANSFERRED, walletAddress: wallet.account.address, errorMessage: null },
      });
      transferred++;
      console.log(`[tier-certs] ${row.tier} certificate ${objectId} sent to ${wallet.account.address}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const giveUp = row.attempts + 1 >= MAX_ATTEMPTS;
      await db.tierCertificate.update({
        where: { id: row.id },
        data:  {
          attempts:     { increment: 1 },
          errorMessage: msg,
          ...(giveUp ? { status: CertificateStatus.FAILED } : {}),
        },
      });
      if (giveUp) failed++;
      console.error(`[tier-certs] ${row.tier} for badge ${row.badgeId} failed (attempt ${row.attempts + 1}): ${msg}`);
    }
  }

  return { transferred, failed };
}
