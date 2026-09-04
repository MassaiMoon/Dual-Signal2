/**
 * POST /api/cron/process-events
 *
 * M4 Rules Engine trigger. Picks up PENDING events, routes them through the
 * rules engine, and returns a processing summary.
 *
 * Call on a schedule (e.g. Railway cron every minute) or trigger ad-hoc via:
 *   curl -X POST https://<host>/api/cron/process-events \
 *        -H "Authorization: Bearer $ADMIN_TOKEN"
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processDualEvent } from '@/lib/rules-engine';
import { runPendingUpdates } from '@/lib/update-worker';
import { EventSource, EventStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pending = await db.event.findMany({
    where: {
      status: EventStatus.PENDING,
      source: { in: [EventSource.DUAL] },
    },
    orderBy: { occurredAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, rejected: 0, errors: 0, message: 'no pending events' });
  }

  let processed = 0;
  let rejected  = 0;
  let errors    = 0;

  for (const event of pending) {
    try {
      let result: 'processed' | 'rejected';

      if (event.source === EventSource.DUAL) {
        result = await processDualEvent(event);
      } else {
        result = 'rejected';
      }

      if (result === 'processed') processed++;
      else rejected++;
    } catch (err) {
      errors++;
      console.error(`[process-events] Error on event ${event.id}:`, err);
    }
  }

  console.log(`[process-events] processed=${processed} rejected=${rejected} errors=${errors}`);

  // Auto-flush badge updates to DUAL if write credentials are present
  if (processed > 0 && process.env.DUAL_EMAIL && process.env.DUAL_PASSWORD) {
    runPendingUpdates().catch((err) =>
      console.error('[process-events] flush-updates error:', err),
    );
  }

  return NextResponse.json({ processed, rejected, errors, total: pending.length });
}

// Support GET for simple cron pings that don't send a body
export async function GET(req: NextRequest) {
  return POST(req);
}
