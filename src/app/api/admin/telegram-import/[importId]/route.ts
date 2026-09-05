/**
 * GET /api/admin/telegram-import/[importId]
 *
 * Returns a single import record plus its identity list (matched + unmatched).
 * Protected by ADMIN_TOKEN.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { importId } = await params;

  const record = await db.telegramImport.findUnique({
    where: { id: importId },
    include: {
      identities: {
        orderBy: [{ status: 'asc' }, { uniqueDays: 'desc' }],
        select: {
          id: true, telegramUserId: true, handle: true, displayName: true,
          messageCount: true, uniqueDays: true, firstSeenDate: true, lastSeenDate: true,
          matchedUserId: true, matchedBadgeId: true, matchReason: true, status: true,
          activeDates: true,
        },
      },
    },
  });

  if (!record) return NextResponse.json({ error: 'Import not found' }, { status: 404 });

  return NextResponse.json({ import: record });
}
