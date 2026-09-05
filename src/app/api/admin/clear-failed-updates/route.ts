/**
 * POST /api/admin/clear-failed-updates
 *
 * Marks all BadgeUpdate records that have exceeded max attempts as FAILED,
 * stopping the update-worker from retrying them indefinitely.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UpdateStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await db.badgeUpdate.updateMany({
    where: {
      status:   UpdateStatus.PENDING,
      attempts: { gte: MAX_ATTEMPTS },
    },
    data: {
      status:       UpdateStatus.FAILED,
      errorMessage: `Exceeded ${MAX_ATTEMPTS} attempts — marked failed by admin`,
    },
  });

  console.log(`[clear-failed-updates] Marked ${result.count} stuck updates as FAILED`);

  return NextResponse.json({ cleared: result.count });
}
