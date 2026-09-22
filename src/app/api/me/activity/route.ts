/**
 * GET /api/me/activity
 *
 * Returns the authenticated member's activity history — a merged, date-sorted
 * list of qualifying X posts, Telegram active days, Discord active days,
 * and governance forum activity.
 *
 * Used to power the "How you earned points" history on /me.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface ActivityItem {
  id:      string;
  source:  'X' | 'TELEGRAM' | 'DISCORD' | 'GOV_ACTIVITY';
  date:    string;
  label:   string;
  detail?: string;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const badge = session.memberAuth.user?.badge;
  if (!badge) return NextResponse.json({ activities: [] });

  const badgeId = badge.id;

  const [xPosts, tgDays, dcDays, govActivities] = await Promise.all([
    db.xPost.findMany({
      where:   { badgeId, qualifies: true },
      orderBy: { postedAt: 'desc' },
      take:    50,
      select:  { id: true, postId: true, postedAt: true, publicViews: true, matchedKeyword: true, authorHandle: true },
    }),
    db.telegramActiveDay.findMany({
      where:   { badgeId },
      orderBy: { day: 'desc' },
      take:    100,
      select:  { id: true, day: true },
    }),
    db.discordActiveDay.findMany({
      where:   { badgeId },
      orderBy: { day: 'desc' },
      take:    100,
      select:  { id: true, day: true },
    }),
    db.governanceActivity.findMany({
      where:   { badgeId, status: 'ACTIVE' },
      orderBy: { occurredAt: 'desc' },
      take:    50,
      select:  { id: true, occurredAt: true, activityType: true, pointsAwarded: true, topicUrl: true },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const p of xPosts) {
    const views = Number(p.publicViews);
    items.push({
      id:     `x-${p.id}`,
      source: 'X',
      date:   p.postedAt.toISOString(),
      label:  'X post',
      detail: views > 0
        ? `${views.toLocaleString()} views${p.matchedKeyword ? ` · #${p.matchedKeyword}` : ''}`
        : p.matchedKeyword ? `#${p.matchedKeyword}` : undefined,
    });
  }

  for (const d of tgDays) {
    items.push({
      id:     `tg-${d.id}`,
      source: 'TELEGRAM',
      date:   d.day.toISOString(),
      label:  'Active in Dual Telegram',
    });
  }

  for (const d of dcDays) {
    items.push({
      id:     `dc-${d.id}`,
      source: 'DISCORD',
      date:   d.day.toISOString(),
      label:  'Active in Dual Discord',
    });
  }

  for (const a of govActivities) {
    const typeLabel =
      a.activityType === 'TOPIC_CREATED'    ? 'Governance topic created' :
      a.activityType === 'COMMENT'          ? 'Governance forum comment' :
      a.activityType === 'FORMAL_PROPOSAL'  ? 'Formal governance proposal' :
      a.activityType === 'POLL_PARTICIPATION' ? 'Governance poll participation' :
      'Governance activity';
    items.push({
      id:     `gov-${a.id}`,
      source: 'GOV_ACTIVITY',
      date:   a.occurredAt.toISOString(),
      label:  typeLabel,
      detail: `+${a.pointsAwarded} pts`,
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ activities: items.slice(0, 100) });
}
