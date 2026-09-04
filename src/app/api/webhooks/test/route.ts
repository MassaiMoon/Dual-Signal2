/**
 * POST /api/webhooks/test
 *
 * Simulated webhook endpoint — accepts a test payload and drives the
 * event → rules → achievement pipeline without any real social source.
 *
 * Protected by a shared secret in the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventSource, EventStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { secret: string; externalUserId: string; source: string; eventType: string; contentId: string; payload?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.secret !== process.env.WEBHOOK_TEST_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const { externalUserId, source, eventType, contentId, payload } = body;
  if (!externalUserId || !source || !eventType || !contentId) {
    return NextResponse.json({ error: 'externalUserId, source, eventType, contentId required' }, { status: 400 });
  }

  const eventSource = source as EventSource;
  const sourceEventId = `${source}:${externalUserId}:${contentId}`;

  // Idempotency
  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: eventSource, sourceEventId } },
  });
  if (existing) return NextResponse.json({ status: 'duplicate', eventId: existing.id });

  // Resolve linked account
  const account = await db.externalAccount.findUnique({
    where: { source_externalUserId: { source: eventSource, externalUserId } },
  });

  const event = await db.event.create({
    data: {
      source: eventSource,
      sourceEventId,
      contentId,
      externalAccountId: account?.id,
      type: eventType,
      status: EventStatus.PENDING,
      payload: (payload ?? {}) as object,
      occurredAt: new Date(),
    },
  });

  await db.event.update({
    where: { id: event.id },
    data: { status: EventStatus.PROCESSED, processedAt: new Date() },
  });

  return NextResponse.json({ status: 'received', eventId: event.id, linked: !!account });
}
