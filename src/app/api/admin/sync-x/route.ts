/**
 * POST /api/admin/sync-x
 *
 * Triggers a controlled X Views sync.
 *
 * Body (all optional):
 *   testHandle    — if set, limits sync to that one X account only
 *   skipDiscovery — if true, skips timeline fetch and only refreshes due posts
 *
 * Required env var (server-side only):
 *   X_BEARER_TOKEN  — X API v2 app-only Bearer Token
 *
 * Protected by ADMIN_TOKEN bearer auth.
 * Bearer Token is NEVER returned in the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runXSync } from '@/lib/x-sync';
import { runPendingUpdates } from '@/lib/update-worker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.X_BEARER_TOKEN) {
    return NextResponse.json({ error: 'X_BEARER_TOKEN not configured on server' }, { status: 500 });
  }

  let body: { testHandle?: string; skipDiscovery?: boolean } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  try {
    const summary = await runXSync({
      testHandle:    body.testHandle,
      skipDiscovery: body.skipDiscovery,
    });

    // Flush DUAL updates in background if any were queued
    if (summary.dualUpdatesQueued > 0 && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
      runPendingUpdates().catch(err =>
        console.error('[sync-x] DUAL flush error:', (err as Error).message),
      );
    }

    return NextResponse.json(summary);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[sync-x] Fatal:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
