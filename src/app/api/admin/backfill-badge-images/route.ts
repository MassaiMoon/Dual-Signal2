/**
 * POST /api/admin/backfill-badge-images
 *
 * Sets metadata.image on every DUAL Object that lacks one,
 * pointing to our OG image endpoint.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 * Safe to run multiple times — only updates objects with dualObjectId set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ebus } from '@/lib/dual-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 500 });
  }

  const badges = await db.badge.findMany({
    where: { dualObjectId: { not: 'MOCK-OBJECT-ID' } },
    select: { id: true, dualObjectId: true },
  });

  const results: Array<{ badgeId: string; dualObjectId: string; status: string; error?: string }> = [];

  for (const badge of badges) {
    const imageUrl = `${appUrl}/api/og/${badge.dualObjectId}`;
    try {
      await ebus.execute({
        update: {
          id:   badge.dualObjectId,
          data: { metadata: { image: imageUrl } },
        },
      });
      results.push({ badgeId: badge.id, dualObjectId: badge.dualObjectId, status: 'updated' });
      console.log(`[backfill-badge-images] Set metadata.image on ${badge.dualObjectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ badgeId: badge.id, dualObjectId: badge.dualObjectId, status: 'failed', error: msg });
      console.error(`[backfill-badge-images] Failed for ${badge.dualObjectId}: ${msg}`);
    }
  }

  const updated = results.filter(r => r.status === 'updated').length;
  const failed  = results.filter(r => r.status === 'failed').length;

  return NextResponse.json({ updated, failed, results });
}
