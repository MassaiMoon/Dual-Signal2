/**
 * GET /api/me
 *
 * Returns the authenticated member's profile data.
 * Session is read from the ds_session cookie.
 *
 * 401 if not authenticated.
 * Email is NEVER exposed via public Passport or leaderboard endpoints —
 * this endpoint is session-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberAuth = session.memberAuth;
  const user       = memberAuth.user;
  const badge      = user?.badge ?? null;

  // Fetch ExternalAccounts if user exists
  const accounts = user
    ? await db.externalAccount.findMany({
        where:   { userId: user.id },
        select: {
          id:             true,
          source:         true,
          handle:         true,
          externalUserId: true,
          xResolvedAt:    true,
          requiresReview: true,
          verifiedAt:     true,
        },
      })
    : [];

  return NextResponse.json({
    email:    memberAuth.email,
    username: user?.username ?? null,
    badge: badge ? {
      id:                badge.id,
      dualObjectId:      badge.dualObjectId,
      signalScore:       badge.signalScore,
      cachedTier:        badge.cachedTier,
      memberSince:       badge.memberSince,
      xHandle:           badge.xHandle,
      telegramHandle:    badge.telegramHandle,
      discordHandle:     badge.discordHandle,
      xSignalLevel:      badge.xSignalLevel,
      telegramLevel:     badge.telegramLevel,
      governanceLevel:   badge.governanceLevel,
      discordLevel:      badge.discordLevel,
      discordActiveDays: badge.discordActiveDays,
      isOG:              badge.isOG,
      createdAt:         badge.createdAt,
    } : null,
    accounts,
  });
}
