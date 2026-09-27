/**
 * GET /api/admin/debug-dual-object?id=<dualObjectId>
 *
 * Returns the raw DUAL Object from the API so we can inspect metadata.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { objects } from '@/lib/dual-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const obj = await objects.getPublic(id);
    return NextResponse.json({ metadata: obj.metadata, custom: obj.custom, version: obj.version });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
