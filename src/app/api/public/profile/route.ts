/**
 * GET /api/public/profile?wallet=0x...&username=...&id=... — look up badge by wallet/username/id (public info only)
 *
 * NOTE: The POST handler that updated handles via walletAddress was removed.
 * walletAddress is never populated, so the "auth" check matched any badge.
 * Handle updates go through the session-authenticated /api/me/accounts/[provider] route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const wallet   = req.nextUrl.searchParams.get('wallet')?.trim();
  const username = req.nextUrl.searchParams.get('username')?.trim();
  const objectId = req.nextUrl.searchParams.get('id')?.trim();

  if (!wallet && !username && !objectId) {
    return NextResponse.json({ error: 'Provide wallet, username, or id' }, { status: 400 });
  }

  let badge = null;
  if (objectId) {
    badge = await db.badge.findFirst({ where: { dualObjectId: objectId } });
  } else if (username) {
    badge = await db.badge.findFirst({
      where: { user: { usernameNormalized: username.toLowerCase() } },
    });
  } else if (wallet) {
    badge = await db.badge.findFirst({ where: { walletAddress: wallet } });
  }

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
    walletAddress:  badge.walletAddress,
    badgeUrl:       `${appUrl}/badge/${badge.dualObjectId}`,
  });
}

