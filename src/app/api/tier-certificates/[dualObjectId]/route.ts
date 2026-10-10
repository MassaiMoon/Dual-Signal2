/**
 * GET /api/tier-certificates/:dualObjectId
 *
 * Reads a tier certificate straight from DUAL — certificates are immutable,
 * so the on-chain object is the source of truth and no DB lookup is needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { objects } from '@/lib/dual-client';
import type { TierCertificateData } from '@/components/TierCertificate';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dualObjectId: string }> },
) {
  const { dualObjectId } = await params;
  const templateId = process.env.DUAL_TIER_CERT_TEMPLATE_ID;
  if (!templateId) {
    return NextResponse.json({ error: 'DUAL_TIER_CERT_TEMPLATE_ID not configured' }, { status: 500, headers: CORS });
  }

  let obj;
  try {
    obj = await objects.getPublic(dualObjectId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const notFound = / → (400|404):/.test(msg);
    if (!notFound) console.error(`[tier-certificates] DUAL read failed for ${dualObjectId}:`, msg);
    return NextResponse.json(
      { error: notFound ? 'Certificate not found' : 'Could not reach DUAL' },
      { status: notFound ? 404 : 502, headers: CORS },
    );
  }

  if (obj.template_id !== templateId) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404, headers: CORS });
  }

  const c = obj.custom ?? {};
  const data: TierCertificateData = {
    tier:               c.tier ?? 'INITIATE',
    username:           c.username ?? '',
    scoreAtAchievement: Number(c.score_at_achievement) || 0,
    achievedAt:         c.achieved_at ?? '',
    memberSince:        c.member_since ?? '',
    serial:             Number(c.serial) || undefined,
  };

  return NextResponse.json(data, {
    headers: { ...CORS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
