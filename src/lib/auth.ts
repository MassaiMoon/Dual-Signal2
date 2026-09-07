/**
 * Authentication utilities.
 *
 * - Session cookie: ds_session (HttpOnly, Secure in prod, SameSite=Lax)
 * - Tokens are stored as SHA-256 hashes — the raw token only ever lives in
 *   the user's email/cookie, never in the database.
 */

import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';

export const SESSION_COOKIE = 'ds_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;    // seconds

export const LOGIN_TOKEN_TTL_MS  = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX      = 5;               // max magic links per hour per email
export const RATE_LIMIT_WINDOW   = 60 * 60 * 1000;

// ── Crypto ────────────────────────────────────────────────────────────────────

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Session from route handler (req.cookies) ──────────────────────────────────

export type AuthedSession = Awaited<ReturnType<typeof getSessionFromRequest>> & {};

export async function getSessionFromRequest(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const tokenHash = hashToken(raw);
  const session = await db.memberSession.findUnique({
    where: { tokenHash },
    include: {
      memberAuth: {
        include: {
          user: {
            include: { badge: true },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.memberSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  return session;
}

// ── Create session + attach cookie to response ────────────────────────────────

export async function createSession(memberAuthId: string): Promise<string> {
  const token     = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MS);

  await db.memberSession.create({
    data: { memberAuthId, tokenHash, expiresAt },
  });

  return token;
}

export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name:     SESSION_COOKIE,
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name:     SESSION_COOKIE,
    value:    '',
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  });
}

// ── Rate-limit check (DB-based, count recent LoginTokens) ─────────────────────

export async function checkRateLimit(memberAuthId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW);
  const count = await db.loginToken.count({
    where: { memberAuthId, createdAt: { gte: since } },
  });
  return count < RATE_LIMIT_MAX;
}
