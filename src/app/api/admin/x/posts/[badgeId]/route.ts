/**
 * GET /api/admin/x/posts/:badgeId
 *
 * Returns qualifying XPosts for one badge, for the admin X Review detail view.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { badgeId } = await params;

  const posts = await db.xPost.findMany({
    where:   { badgeId, qualifies: true },
    orderBy: { postedAt: 'desc' },
  });

  const rows = posts.map(p => ({
    id:                 p.id,
    postId:             p.postId,
    postUrl:            `https://x.com/${p.authorHandle}/status/${p.postId}`,
    authorHandle:       p.authorHandle,
    matchedKeyword:     p.matchedKeyword,
    publicViews:        Number(p.publicViews),
    firstObservedViews: Number(p.firstObservedViews),
    postedAt:           p.postedAt,
    firstSeenAt:        p.firstSeenAt,
    lastCheckedAt:      p.lastCheckedAt,
    nextCheckAt:        p.nextCheckAt,
    checkCount:         p.checkCount,
    status:             p.status,
  }));

  return NextResponse.json({ posts: rows });
}
