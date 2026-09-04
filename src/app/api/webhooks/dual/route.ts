/**
 * POST /api/webhooks/dual
 *
 * Production webhook receiver for DUAL Network events.
 *
 * Security: HMAC-SHA256 over the raw request body, compared with
 * timing-safe equality. The signature header name is configurable via
 * DUAL_WEBHOOK_SIGNATURE_HEADER (default: x-dual-signature) so we can
 * adjust once DUAL confirms their exact header.
 *
 * On first deployment, set DUAL_WEBHOOK_DEBUG=1 to log the full request
 * headers and body — this reveals the exact header DUAL uses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { EventSource, EventStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET  = process.env.DUAL_WEBHOOK_SECRET ?? '';
const SIG_HEADER      = (process.env.DUAL_WEBHOOK_SIGNATURE_HEADER ?? 'x-dual-signature').toLowerCase();
const DEBUG           = process.env.DUAL_WEBHOOK_DEBUG === '1';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: Buffer, sigHeader: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('[dual-webhook] DUAL_WEBHOOK_SECRET is not set');
    return false;
  }
  // Support both plain hex and "sha256=<hex>" prefixed formats
  const sig = sigHeader.replace(/^sha256=/, '').toLowerCase();
  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

// ─── Payload types ────────────────────────────────────────────────────────────

interface DualWebhookPayload {
  event_type?: string;   // e.g. "mint", "update", "transfer"
  type?:       string;   // alternate key some APIs use
  object_id?:  string;
  id?:         string;
  template_id?: string;
  custom?:     Record<string, string>;
  metadata?:   Record<string, string>;
  owner?:      string;
  occurred_at?: string;
  [key: string]: unknown;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read raw bytes first — signature is computed over the raw body
  const rawBody = Buffer.from(await req.arrayBuffer());

  // Debug mode: log all headers and body so we can confirm DUAL's exact format
  if (DEBUG) {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    console.log('[dual-webhook] DEBUG headers:', JSON.stringify(headers, null, 2));
    console.log('[dual-webhook] DEBUG body:', rawBody.toString('utf8'));
  }

  // Verify signature
  const sigHeader = req.headers.get(SIG_HEADER) ?? '';
  if (!sigHeader) {
    console.warn(`[dual-webhook] Missing signature header "${SIG_HEADER}"`);
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }
  if (!verifySignature(rawBody, sigHeader)) {
    console.warn('[dual-webhook] Signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse payload
  let payload: DualWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = (payload.event_type ?? payload.type ?? 'unknown').toLowerCase();
  const objectId  = payload.object_id ?? payload.id ?? '';

  console.log(`[dual-webhook] Received event_type="${eventType}" object_id="${objectId}"`);

  // Deduplicated source event ID
  const sourceEventId = `dual:${objectId}:${eventType}:${payload.occurred_at ?? Date.now()}`;

  const existing = await db.event.findUnique({
    where: { source_sourceEventId: { source: EventSource.DUAL, sourceEventId } },
  });
  if (existing) {
    console.log(`[dual-webhook] Duplicate — already stored as event ${existing.id}`);
    return NextResponse.json({ status: 'duplicate', eventId: existing.id });
  }

  // Store raw event; rules engine (M4) processes PENDING rows
  const event = await db.event.create({
    data: {
      source:        EventSource.DUAL,
      sourceEventId,
      contentId:     objectId,
      type:          eventType,
      status:        EventStatus.PENDING,
      payload:       payload as object,
      occurredAt:    payload.occurred_at ? new Date(payload.occurred_at) : new Date(),
    },
  });

  console.log(`[dual-webhook] Stored event ${event.id}`);

  // Respond immediately — processing happens async (M4 rules engine)
  return NextResponse.json({ status: 'received', eventId: event.id });
}
