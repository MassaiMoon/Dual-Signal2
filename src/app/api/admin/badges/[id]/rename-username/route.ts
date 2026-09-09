/**
 * POST /api/admin/badges/[id]/rename-username
 *
 * Change a member's public SIGNAL username.
 * Updates User.username + User.usernameNormalized locally,
 * then attempts to update custom.username on the DUAL Object via Event Bus.
 *
 * metadata.name ("DUAL // SIGNAL — username") cannot be updated via current
 * DUAL mechanisms; only custom.username is synced.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { renameUsername } from '@/lib/admin-actions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: badgeId } = await params;

  let body: { newUsername?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.newUsername) {
    return NextResponse.json({ error: 'newUsername is required' }, { status: 400 });
  }

  try {
    const result = await renameUsername(badgeId, body.newUsername);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === 'Passport not found' ? 404 : 422;
    return NextResponse.json({ error: msg }, { status });
  }
}
