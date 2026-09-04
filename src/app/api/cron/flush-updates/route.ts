/**
 * POST /api/cron/flush-updates
 *
 * M5: Triggers the BadgeUpdate worker — writes PENDING badge state changes
 * to DUAL Network via PATCH /objects/:id.
 *
 * Requires DUAL_EMAIL, DUAL_PASSWORD, DUAL_ORG_ID in env for JWT auth.
 * Protected by ADMIN_TOKEN bearer auth.
 *
 * Call after process-events, or on a schedule (e.g. every 30 seconds).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPendingUpdates } from '@/lib/update-worker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const missing: string[] = [];
  if (!process.env.DUAL_EMAIL)    missing.push('DUAL_EMAIL');
  if (!process.env.DUAL_PASSWORD) missing.push('DUAL_PASSWORD');
  if (!process.env.DUAL_ORG_ID)  missing.push('DUAL_ORG_ID');
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing env vars: ${missing.join(', ')}` }, { status: 500 });
  }

  try {
    await runPendingUpdates();
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[flush-updates] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
