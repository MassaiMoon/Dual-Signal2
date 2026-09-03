/**
 * GET /api/badges/:id
 *
 * Read a badge's current local state (DB mirror of the DUAL object).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { BadgeResponse, ApiError } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const badge = await db.badge.findUnique({
    where: { id: params.id },
    include: { achievementProgress: { orderBy: { achievementType: 'asc' } } },
  });

  if (!badge) {
    return NextResponse.json<ApiError>({ error: 'Badge not found' }, { status: 404 });
  }

  // Derive signal_count from FIRST_SIGNAL progress row
  const signalProgress = badge.achievementProgress.find(
    (p) => p.achievementType === 'FIRST_SIGNAL'
  );

  const achievementLevel =
    badge.achievementProgress
      .filter((p) => p.level > 0 && ['FIRST_SIGNAL', 'AMPLIFIER_I', 'AMPLIFIER_II', 'BROADCASTER'].includes(p.achievementType))
      .sort((a, b) => b.progress - a.progress)[0]?.achievementType ?? '';

  return NextResponse.json<BadgeResponse>({
    id: badge.id,
    dualObjectId: badge.dualObjectId,
    identityTier: badge.identityTier,
    signalCount: signalProgress?.progress ?? 0,
    achievementLevel,
    achievements: badge.achievementProgress.map((p) => ({
      type: p.achievementType,
      level: p.level,
      progress: p.progress,
    })),
  });
}
