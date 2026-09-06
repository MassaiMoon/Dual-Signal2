/**
 * X API budget ledger and $8 internal safety guard.
 *
 * Pricing (pay-per-use, credit-based — isolated here so changes require
 * editing only this file + config.ts):
 *   Posts:        $0.005 per resource
 *   User lookups: $0.010 per resource
 *   Deduplication: within 24-hour UTC windows (same post read twice = charged once)
 *
 * Internal limit: $8.00 per billing cycle (X console hard cap = $10.00).
 *
 * Billing cycle is computed from a configurable anchor day-of-month.
 * Current cycle: Sep 5 – Oct 5, 2026.
 */

import { db } from './db';
import { X_API_PRICING, X_INTERNAL_BUDGET_USD, X_BILLING_ANCHOR_DAY } from './config';

// ── Billing cycle helpers ─────────────────────────────────────────────────────

/**
 * Returns the billing cycle start date (YYYY-MM-DD) for a given date.
 * Cycle starts on X_BILLING_ANCHOR_DAY of each month.
 * Example: anchor=5, date=Sep 20 → "2026-09-05"
 *          anchor=5, date=Sep 4  → "2026-08-05"
 */
export function getBillingCycleKey(now = new Date()): string {
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-indexed
  const day   = now.getUTCDate();

  let cycleYear  = year;
  let cycleMonth = month;

  if (day < X_BILLING_ANCHOR_DAY) {
    // Still in the previous cycle
    cycleMonth -= 1;
    if (cycleMonth === 0) { cycleMonth = 12; cycleYear -= 1; }
  }

  const mm = String(cycleMonth).padStart(2, '0');
  const dd = String(X_BILLING_ANCHOR_DAY).padStart(2, '0');
  return `${cycleYear}-${mm}-${dd}`;
}

// ── Cost estimation ───────────────────────────────────────────────────────────

export function estimatePostReadCost(postCount: number): number {
  return postCount * X_API_PRICING.postReadUsd;
}

export function estimateUserLookupCost(userCount: number): number {
  return userCount * X_API_PRICING.userLookupUsd;
}

// ── Ledger reads ──────────────────────────────────────────────────────────────

export async function getEstimatedCycleSpend(cycleKey: string): Promise<number> {
  const rows = await db.xApiUsage.findMany({ where: { billingCycle: cycleKey } });
  return rows.reduce((sum, r) => sum + r.estimatedCost, 0);
}

// ── Budget guard ──────────────────────────────────────────────────────────────

export interface BudgetCheck {
  ok:            boolean;
  currentSpend:  number;
  addedCost:     number;
  projectedSpend: number;
  limit:         number;
  message?:      string;
}

/**
 * Returns { ok: false } if adding estimatedAdditionalCost would breach $8.
 * Call this BEFORE making any API request batch.
 */
export async function checkBudget(estimatedAdditionalCost: number): Promise<BudgetCheck> {
  const cycleKey     = getBillingCycleKey();
  const currentSpend = await getEstimatedCycleSpend(cycleKey);
  const projected    = currentSpend + estimatedAdditionalCost;

  if (projected > X_INTERNAL_BUDGET_USD) {
    return {
      ok: false,
      currentSpend,
      addedCost:      estimatedAdditionalCost,
      projectedSpend: projected,
      limit:          X_INTERNAL_BUDGET_USD,
      message: `INTERNAL_BUDGET_LIMIT_REACHED: projected $${projected.toFixed(4)} would exceed $${X_INTERNAL_BUDGET_USD.toFixed(2)} cycle limit (current spend $${currentSpend.toFixed(4)})`,
    };
  }

  return { ok: true, currentSpend, addedCost: estimatedAdditionalCost, projectedSpend: projected, limit: X_INTERNAL_BUDGET_USD };
}

// ── Ledger writes ─────────────────────────────────────────────────────────────

export async function recordUsage(opts: {
  endpoint:      string;
  resourceCount: number;
  estimatedCost: number;
}): Promise<void> {
  const cycleKey = getBillingCycleKey();
  await db.xApiUsage.create({
    data: {
      billingCycle:  cycleKey,
      endpoint:      opts.endpoint,
      resourceCount: opts.resourceCount,
      estimatedCost: opts.estimatedCost,
    },
  });
}
