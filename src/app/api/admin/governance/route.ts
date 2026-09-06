/**
 * GET /api/admin/governance
 *
 * Returns per-badge governance data for the admin Governance page.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider, GovernanceActivityStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const badges = await db.badge.findMany({
    include: {
      user: {
        include: {
          externalAccounts: { where: { source: Provider.DUAL_FORUM } },
        },
      },
      governanceActivities: {
        where:   { status: { not: GovernanceActivityStatus.DELETED } },
        orderBy: { occurredAt: 'desc' },
        take:    5, // preview for listing; full list via evidence endpoint
      },
    },
    orderBy: { governanceActivityPoints: 'desc' },
  });

  const rows = badges.map(b => {
    const forumAcct = b.user.externalAccounts[0] ?? null;
    return {
      badgeId:                b.id,
      username:               b.user.username ?? '—',
      forumUsername:          forumAcct?.handle ?? null,
      forumUserId:            forumAcct ? parseInt(forumAcct.externalUserId, 10) || null : null,
      forumSyncedAt:          forumAcct?.forumSyncedAt ?? null,
      governanceActivityPoints: b.governanceActivityPoints,
      governanceLevel:        b.governanceLevel,
      signalScore:            b.signalScore,
      cachedTier:             b.cachedTier,
      recentActivities:       b.governanceActivities,
    };
  });

  return NextResponse.json({ badges: rows });
}
