import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const badge = await db.badge.findUnique({ where: { id } });

  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  return NextResponse.json({
    id:             badge.id,
    dualObjectId:   badge.dualObjectId,
    signalScore:    badge.signalScore,
    tier:           badge.cachedTier,
    xSignalLevel:   badge.xSignalLevel,
    telegramLevel:  badge.telegramLevel,
    governanceLevel:badge.governanceLevel,
    discordLevel:   badge.discordLevel,
    isOG:           badge.isOG,
    walletAddress:  badge.walletAddress,
    memberSince:    badge.memberSince,
  });
}
