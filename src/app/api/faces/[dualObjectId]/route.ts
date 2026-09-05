import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    badgeId:         badge.id,
    dualObjectId:    badge.dualObjectId,
    signalScore:     badge.signalScore,
    tier:            badge.cachedTier,
    xSignalLevel:    badge.xSignalLevel,
    telegramLevel:   badge.telegramLevel,
    discordLevel:    badge.discordLevel,
    governanceLevel: badge.governanceLevel,
    isOG:            badge.isOG,
    walletAddress:   badge.walletAddress,
    memberSince:     badge.memberSince,
    // Progress counters
    xSignalPublicViews: badge.xSignalPublicViews,
    xQualifyingPosts:   badge.xQualifyingPosts,
    telegramActiveDays: badge.telegramActiveDays,
    discordActiveDays:  badge.discordActiveDays,
    governanceVotes:    badge.governanceVotes,
  });
}
