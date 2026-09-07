/**
 * GET /api/auth/verify?token=xxx
 *
 * Verifies a magic-link token, creates a session, sets the session cookie,
 * and redirects the user to the appropriate destination:
 *
 *   - Has passport   → /me
 *   - No passport    → /join
 *   - Invalid token  → /login?error=invalid
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashToken, createSession, attachSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const token  = req.nextUrl.searchParams.get('token') ?? '';

  if (!token || token.length !== 64) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid`);
  }

  const tokenHash = hashToken(token);

  // Look up the token
  const loginToken = await db.loginToken.findUnique({
    where: { tokenHash },
    include: { memberAuth: { include: { user: { include: { badge: true } } } } },
  });

  const now = new Date();

  // Invalid, expired, or already used
  if (!loginToken || loginToken.used || loginToken.expiresAt < now) {
    if (loginToken && !loginToken.used) {
      // Mark expired token as used to prevent further attempts
      await db.loginToken.update({ where: { id: loginToken.id }, data: { used: true } }).catch(() => null);
    }
    return NextResponse.redirect(`${appUrl}/login?error=expired`);
  }

  // Mark token used (single-use)
  await db.loginToken.update({ where: { id: loginToken.id }, data: { used: true } });

  // Mark email verified on first successful login
  const memberAuth = loginToken.memberAuth;
  const updates: Record<string, unknown> = { lastLoginAt: now };
  if (!memberAuth.emailVerifiedAt) updates.emailVerifiedAt = now;
  await db.memberAuth.update({ where: { id: memberAuth.id }, data: updates });

  // Create session
  const sessionToken = await createSession(memberAuth.id);

  // Decide redirect destination
  const hasBadge = !!(memberAuth.user?.badge);
  const dest     = hasBadge ? `${appUrl}/me` : `${appUrl}/join`;

  const response = NextResponse.redirect(dest);
  attachSessionCookie(response, sessionToken);
  return response;
}
