/**
 * GET /api/admin/dashboard
 *
 * Aggregated data for the admin dashboard.
 * Returns stats, full badge list, recent events, and pending update queue.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventStatus, UpdateStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [badges, pendingEventsCount, pendingUpdatesCount, recentEvents, pendingUpdates] =
    await Promise.all([
      db.badge.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id:             true,
          dualObjectId:   true,
          walletAddress:  true,
          cachedTier:     true,
          signalScore:    true,
          memberSince:    true,
          discordHandle:  true,
          telegramHandle: true,
          xHandle:        true,
          isOG:           true,
          createdAt:      true,
          xSignalLevel:    true,
          telegramLevel:   true,
          governanceLevel: true,
          discordLevel:    true,
        },
      }),
      db.event.count({ where: { status: EventStatus.PENDING } }),
      db.badgeUpdate.count({ where: { status: UpdateStatus.PENDING } }),
      db.event.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id:           true,
          source:       true,
          type:         true,
          status:       true,
          occurredAt:   true,
          createdAt:    true,
          rejectionReason: true,
        },
      }),
      db.badgeUpdate.findMany({
        where: { status: UpdateStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: {
          id:             true,
          badgeId:        true,
          status:         true,
          attempts:       true,
          requestedState: true,
          createdAt:      true,
          badge: { select: { walletAddress: true, dualObjectId: true } },
        },
      }),
    ]);

  const byTier = badges.reduce<Record<string, number>>((acc, b) => {
    acc[b.cachedTier] = (acc[b.cachedTier] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    stats: {
      totalBadges:    badges.length,
      byTier,
      pendingEvents:  pendingEventsCount,
      pendingUpdates: pendingUpdatesCount,
    },
    badges,
    recentEvents,
    pendingUpdates,
  });
}
