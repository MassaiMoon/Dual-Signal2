import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dualObjectId: string }> }
) {
  const { dualObjectId } = await params;

  const badge = await db.badge.findFirst({
    where: { dualObjectId },
    include: {
      user: {
        select: {
          username:        true,
          externalAccounts: { select: { source: true } },
        },
      },
    },
  });

  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  const connectedProviders = new Set(badge.user?.externalAccounts.map(a => a.source) ?? []);

  // Fall back to handle fields on Badge for passports created before ExternalAccount records existed.
  const xConnected          = connectedProviders.has(Provider.TWITTER)    || badge.xHandle        !== '';
  const telegramConnected   = connectedProviders.has(Provider.TELEGRAM)   || badge.telegramHandle !== '';
  const discordConnected    = connectedProviders.has(Provider.DISCORD)    || badge.discordHandle  !== '';
  const governanceConnected = connectedProviders.has(Provider.DUAL_FORUM);

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
    username:        badge.user?.username ?? '',
    memberSince:     badge.memberSince,
    // Connected flags — true when account is linked (not necessarily verified)
    xConnected,
    telegramConnected,
    discordConnected,
    governanceConnected,
    // Progress counters
    xSignalPublicViews: badge.xSignalPublicViews,
    xQualifyingPosts:   badge.xQualifyingPosts,
    telegramActiveDays: badge.telegramActiveDays,
    discordActiveDays:  badge.discordActiveDays,
    governanceVotes:    badge.governanceVotes,
  });
}
