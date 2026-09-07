/**
 * POST /api/auth/logout
 *
 * Destroys the current session and clears the session cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashToken, clearSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;

  if (raw) {
    const tokenHash = hashToken(raw);
    await db.memberSession.deleteMany({ where: { tokenHash } }).catch(() => null);
  }

  const appUrl   = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const response = NextResponse.redirect(`${appUrl}/login`);
  clearSessionCookie(response);
  return response;
}
