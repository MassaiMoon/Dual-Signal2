/**
 * GET /api/badges/lookup
 *
 * Find a badge by Discord handle, Telegram handle, or wallet address.
 * Used by the Discord bot to resolve member identities.
 *
 * Query params (one required):
 *   ?discord=username
 *   ?telegram=username
 *   ?wallet=0x...
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const discord  = searchParams.get('discord')?.replace(/^@/, '').toLowerCase();
  const telegram = searchParams.get('telegram')?.replace(/^@/, '').toLowerCase();
  const wallet   = searchParams.get('wallet');

  if (!discord && !telegram && !wallet) {
    return NextResponse.json(
      { error: 'Provide at least one of: discord, telegram, wallet' },
      { status: 400 },
    );
  }

  const badge = await db.badge.findFirst({
    where: discord  ? { discordHandle:  { equals: discord,  mode: 'insensitive' } }
         : telegram ? { telegramHandle: { equals: telegram, mode: 'insensitive' } }
         : { walletAddress: wallet! },
  });

  if (!badge) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  return NextResponse.json({
    id:             badge.id,
    dualObjectId:   badge.dualObjectId,
    walletAddress:  badge.walletAddress,
    discordHandle:  badge.discordHandle,
    telegramHandle: badge.telegramHandle,
    signalScore:    badge.signalScore,
    tier:           badge.cachedTier,
    memberSince:    badge.memberSince,
    isOG:           badge.isOG,
    xSignalLevel:   badge.xSignalLevel,
    telegramLevel:  badge.telegramLevel,
    governanceLevel: badge.governanceLevel,
    holderLevel:    badge.holderLevel,
    telegramActiveDays: badge.telegramActiveDays,
    badgeUrl:       `${appUrl}/badge/${badge.dualObjectId}`,
    faceUrl:        `${appUrl}/faces/badge?id=${badge.dualObjectId}`,
  });
}
