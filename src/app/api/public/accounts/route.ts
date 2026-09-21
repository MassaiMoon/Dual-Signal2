/**
 * /api/public/accounts — REMOVED
 *
 * The unauthenticated POST handler that added handles by dualObjectId was removed.
 * dualObjectId is public (appears in badge URLs), making this a trivial takeover vector.
 * Handle management goes through the session-authenticated /api/me/accounts/[provider] route.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({ error: 'This endpoint has been removed. Use /api/me/accounts/[provider] instead.' }, { status: 410 });
}
