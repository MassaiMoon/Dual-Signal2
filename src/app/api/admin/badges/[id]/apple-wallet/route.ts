/**
 * GET /api/admin/badges/[id]/apple-wallet
 *
 * ADMIN-ONLY. Fetches the DUAL-generated .pkpass for the member's Passport
 * and proxies the binary to the admin browser for download/testing.
 *
 * Security:
 *   - ADMIN_TOKEN bearer auth required — normal members cannot call this.
 *   - dualObjectId is resolved server-side from the DB; the browser cannot
 *     supply an arbitrary objectId.
 *   - DUAL credentials and JWTs are never exposed to the client.
 *   - Read-only: no mint, update, burn, transfer, or metadata change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchPkpassResponse } from '@/lib/dual-client';

export const dynamic = 'force-dynamic';

/** Only [A-Za-z0-9_-] — safe for Content-Disposition filename parameter. */
function sanitizeFilename(raw: string): string {
  return (raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) || 'passport';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: badgeId } = await params;

  // Resolve member from DB — browser cannot supply the objectId
  const badge = await db.badge.findUnique({
    where:   { id: badgeId },
    include: { user: { select: { username: true } } },
  });

  if (!badge) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 });
  }

  const { dualObjectId } = badge;

  if (!dualObjectId || dualObjectId === 'MOCK-OBJECT-ID') {
    return NextResponse.json(
      { error: 'This Passport has no valid DUAL Object ID' },
      { status: 422 },
    );
  }

  // Fetch pkpass from DUAL using existing org-JWT auth flow (read-only)
  let dualRes: Response;
  try {
    dualRes = await fetchPkpassResponse(dualObjectId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[apple-wallet] DUAL auth/fetch error for badge=${badgeId}:`, msg);
    return NextResponse.json({ error: `DUAL request failed: ${msg}` }, { status: 502 });
  }

  if (!dualRes.ok) {
    const body = await dualRes.text().catch(() => '');
    console.error(`[apple-wallet] DUAL ${dualRes.status} for badge=${badgeId} object=${dualObjectId}: ${body}`);
    const status = dualRes.status === 404 ? 404 : dualRes.status === 401 || dualRes.status === 403 ? 502 : 502;
    return NextResponse.json(
      { error: `DUAL returned ${dualRes.status}${body ? `: ${body}` : ''}` },
      { status },
    );
  }

  const contentType = dualRes.headers.get('content-type') ?? 'application/vnd.apple.pkpass';
  const buffer      = await dualRes.arrayBuffer();

  const slug     = sanitizeFilename(badge.user?.username ?? '');
  const filename = `dual-signal-${slug}.pkpass`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buffer.byteLength),
      // Prevent browser caching of the credential-bearing download
      'Cache-Control':       'no-store',
    },
  });
}
