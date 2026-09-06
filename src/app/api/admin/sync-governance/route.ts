/**
 * POST /api/admin/sync-governance
 *
 * Triggers a governance forum sync.
 * Protected by ADMIN_TOKEN bearer auth.
 *
 * Body (optional JSON):
 *   { testForumUsername?: string; topicPages?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runGovernanceSync } from '@/lib/forum-sync';
import { resolveForumAccount } from '@/lib/forum-sync';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { testForumUsername?: string; topicPages?: number; resolve?: { badgeId: string; forumUsername: string } } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch { /* no body */ }

  // Special case: just resolve one forum account
  if (body.resolve) {
    const { badgeId, forumUsername } = body.resolve;
    try {
      const result = await resolveForumAccount(badgeId, forumUsername);
      if (!result) {
        return NextResponse.json({ error: `Forum user "${forumUsername}" not found` }, { status: 404 });
      }
      return NextResponse.json({ ok: true, forumUserId: result.forumUserId });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  try {
    const summary = await runGovernanceSync({
      testForumUsername: body.testForumUsername,
      topicPages:        body.topicPages,
    });
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[sync-governance] Unhandled error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
