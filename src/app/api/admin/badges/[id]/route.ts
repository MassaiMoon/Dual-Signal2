/**
 * PATCH /api/admin/badges/[id]
 *
 * Update display/identity fields on a badge.
 * Accepts: discordHandle, telegramHandle
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface PatchBody {
  discordHandle?:  string;
  telegramHandle?: string;
  xHandle?:        string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: PatchBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const data: Record<string, string> = {};
  if (body.discordHandle  !== undefined) data.discordHandle  = body.discordHandle.replace(/^@/, '').trim();
  if (body.telegramHandle !== undefined) data.telegramHandle = body.telegramHandle.replace(/^@/, '').trim();
  if (body.xHandle        !== undefined) data.xHandle        = body.xHandle.replace(/^@/, '').trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const badge = await db.badge.update({ where: { id }, data });

  return NextResponse.json({
    id:             badge.id,
    discordHandle:  badge.discordHandle,
    telegramHandle: badge.telegramHandle,
    xHandle:        badge.xHandle,
  });
}
