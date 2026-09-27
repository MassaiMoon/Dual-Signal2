/**
 * POST /api/admin/reset-failed-updates
 *
 * Resets FAILED (and optionally PROCESSING-stuck) badge_updates back to PENDING
 * so the update worker retries them with the fixed Event Bus approach.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UpdateStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await db.badgeUpdate.updateMany({
    where: { status: { in: [UpdateStatus.FAILED, UpdateStatus.PROCESSING] } },
    data:  { status: UpdateStatus.PENDING, attempts: 0, errorMessage: null },
  });

  return NextResponse.json({ reset: result.count });
}
