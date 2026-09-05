/**
 * POST /api/public/profile
 *
 * Public endpoint — allows a badge holder to update their own social handles.
 * Authenticated by wallet address ownership (social handles are non-sensitive).
 *
 * GET /api/public/profile?wallet=0x... — look up badge by wallet (public info only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const badge = await db.badge.findFirst({ where: { walletAddress: wallet } });
  if (!badge) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  return NextResponse.json({
    found:          true,
    dualObjectId:   badge.dualObjectId,
    tier:           badge.cachedTier,
    signalScore:    badge.signalScore,
    memberSince:    badge.memberSince,
    xHandle:        badge.xHandle,
    telegramHandle: badge.telegramHandle,
    discordHandle:  badge.discordHandle,
    badgeUrl:       `${appUrl}/badge/${badge.dualObjectId}`,
  });
}

export async function POST(req: NextRequest) {
  let body: { walletAddress: string; xHandle?: string; telegramHandle?: string; discordHandle?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { walletAddress, xHandle, telegramHandle, discordHandle } = body;
  if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });

  const badge = await db.badge.findFirst({ where: { walletAddress } });
  if (!badge) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const data: Record<string, string> = {};
  if (xHandle        !== undefined) data.xHandle        = xHandle.replace(/^@/, '').trim();
  if (telegramHandle !== undefined) data.telegramHandle = telegramHandle.replace(/^@/, '').trim();
  if (discordHandle  !== undefined) data.discordHandle  = discordHandle.replace(/^@/, '').trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await db.badge.update({ where: { id: badge.id }, data });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  return NextResponse.json({
    updated:      true,
    dualObjectId: badge.dualObjectId,
    badgeUrl:     `${appUrl}/badge/${badge.dualObjectId}`,
  });
}
