/**
 * POST /api/auth/send-login-link
 *
 * Accepts { email } and sends a magic-link if the address is valid.
 * Never reveals whether the email exists (anti-enumeration).
 *
 * Rate limit: max 5 magic links per email per hour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateToken,
  hashToken,
  normalizeEmail,
  checkRateLimit,
  LOGIN_TOKEN_TTL_MS,
} from '@/lib/auth';
import { sendMagicLink } from '@/lib/email';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const rawEmail = (body.email ?? '').trim();

  // Basic format validation
  if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 422 });
  }

  const emailNormalized = normalizeEmail(rawEmail);

  // Upsert MemberAuth — silently create if first-time, never reveal whether it existed
  let memberAuth = await db.memberAuth.findUnique({
    where: { emailNormalized },
  });

  if (!memberAuth) {
    memberAuth = await db.memberAuth.create({
      data: { email: rawEmail, emailNormalized },
    });
  }

  // Rate limit
  const allowed = await checkRateLimit(memberAuth.id);
  if (!allowed) {
    // Respond same as success to avoid enumeration, but log
    console.warn(`[send-login-link] Rate limit hit for ${emailNormalized}`);
    return NextResponse.json({ sent: true });
  }

  // Create single-use token
  const token     = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);

  await db.loginToken.create({
    data: { memberAuthId: memberAuth.id, tokenHash, expiresAt },
  });

  // Send email — errors are swallowed so we never expose internals
  try {
    await sendMagicLink(rawEmail, token);
  } catch (err) {
    console.error('[send-login-link] Email delivery failed:', (err as Error).message);
    // Still return success to avoid leaking info, but log the error
  }

  return NextResponse.json({ sent: true });
}
