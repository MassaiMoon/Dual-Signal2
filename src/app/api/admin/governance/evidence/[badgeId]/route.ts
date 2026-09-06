/**
 * GET /api/admin/governance/evidence/[badgeId]
 *
 * Returns all governance activities (evidence) for a specific badge.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req:     NextRequest,
  { params }: { params: { badgeId: string } },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { badgeId } = params;

  const [badge, activities] = await Promise.all([
    db.badge.findUnique({
      where: { id: badgeId },
      select: {
        id:                       true,
        governanceActivityPoints: true,
        governanceLevel:          true,
        user: { select: { username: true } },
      },
    }),
    db.governanceActivity.findMany({
      where:   { badgeId },
      orderBy: { occurredAt: 'desc' },
    }),
  ]);

  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  return NextResponse.json({ badge, activities });
}
