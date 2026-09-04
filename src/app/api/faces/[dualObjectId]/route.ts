import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateTier } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dualObjectId: string }> }
) {
  const { dualObjectId } = await params;

  const badge = await db.badge.findFirst({ where: { dualObjectId } });

  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  return NextResponse.json({
    badgeId:        badge.id,
    dualObjectId:   badge.dualObjectId,
    signalScore:    badge.signalScore,
    tier:           badge.cachedTier,
    xSignalLevel:   badge.xSignalLevel,
    telegramLevel:  badge.telegramLevel,
    governanceLevel:badge.governanceLevel,
    holderLevel:    badge.holderLevel,
    isOG:           badge.isOG,
    walletAddress:  badge.walletAddress,
    memberSince:    badge.memberSince,
    // Progress counters
    xSignalImpressions: badge.xSignalImpressions,
    telegramActiveDays: badge.telegramActiveDays,
    governanceVotes:    badge.governanceVotes,
    holderQualDays:     badge.holderQualDays,
  });
}
