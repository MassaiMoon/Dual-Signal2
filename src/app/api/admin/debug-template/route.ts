/**
 * GET /api/admin/debug-template
 * Returns the raw DUAL template so we can see if a face is already attached.
 */
import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/lib/dual-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = process.env.DUAL_SIGNAL_TEMPLATE_ID ?? '';
  try {
    const t = await templates.get(id);
    return NextResponse.json(t);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
