/**
 * GET /api/admin/x
 *
 * Returns per-badge X signal data for the admin X Review page.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider } from '@prisma/client';
import { getBillingCycleKey, getEstimatedCycleSpend } from '@/lib/x-budget';
import { X_INTERNAL_BUDGET_USD } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const badges = await db.badge.findMany({
    where:   { xHandle: { not: '' } },
    include: {
      xPosts: { where: { qualifies: true }, orderBy: { postedAt: 'desc' } },
      user: {
        include: {
          externalAccounts: { where: { source: Provider.TWITTER } },
        },
      },
    },
    orderBy: { xSignalPublicViews: 'desc' },
  });

  const cycleKey    = getBillingCycleKey();
  const cycleSpend  = await getEstimatedCycleSpend(cycleKey);

  const rows = badges.map(b => {
    const xAcct      = b.user.externalAccounts[0] ?? null;
    const qualifying = b.xPosts;
    const lastPost   = qualifying[0] ?? null;
    const lastCheck  = qualifying.reduce<Date | null>((max, p) => {
      if (!p.lastCheckedAt) return max;
      return max === null || p.lastCheckedAt > max ? p.lastCheckedAt : max;
    }, null);

    return {
      badgeId:          b.id,
      username:         b.user.username ?? '—',
      xHandle:          b.xHandle,
      xUserId:          (xAcct && /^\d+$/.test(xAcct.externalUserId)) ? xAcct.externalUserId : null,
      resolvedAt:       xAcct?.xResolvedAt ?? null,
      lastXPostId:      xAcct?.lastXPostId ?? null,
      qualifyingPosts:  qualifying.length,
      cumulativeViews:  b.xSignalPublicViews,
      xLevel:           b.xSignalLevel,
      xPoints:          b.xSignalLevel > 0 ? [50, 100, 150, 200, 250][b.xSignalLevel - 1] : 0,
      signalScore:      b.signalScore,
      cachedTier:       b.cachedTier,
      lastDiscovery:    xAcct?.lastXPostId ? lastPost?.firstSeenAt ?? null : null,
      lastRefresh:      lastCheck,
      syncStatus:       xAcct ? (/^\d+$/.test(xAcct.externalUserId) ? 'resolved' : 'handle_only') : 'no_account',
    };
  });

  return NextResponse.json({
    badges:      rows,
    budget: {
      cycleKey,
      estimatedSpend: cycleSpend,
      limit:          X_INTERNAL_BUDGET_USD,
      remaining:      Math.max(0, X_INTERNAL_BUDGET_USD - cycleSpend),
    },
  });
}
