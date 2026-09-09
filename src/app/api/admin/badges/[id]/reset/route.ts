/**
 * POST /api/admin/badges/[id]/reset
 *
 * Completely reset a SIGNAL Alpha member account.
 * Removes all local records so the same email can re-register from scratch.
 *
 * Deletion order (respects FK constraints):
 *   BadgeUpdate → XPost → DiscordActiveDay → TelegramActiveDay →
 *   GovernanceParticipation → GovernanceActivity → Badge →
 *   Event (for ext accounts) → ExternalAccount →
 *   TelegramImportIdentity (null out match refs) →
 *   MemberAuth.userId = null → User → MemberAuth (cascades sessions/tokens)
 *
 * If burnDualObject=true, the DUAL Object is burned via Event Bus BEFORE any
 * local deletion. If the burn fails, the reset is aborted with an error.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetMember } from '@/lib/admin-actions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: badgeId } = await params;

  let body: { confirmed?: boolean; burnDualObject?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Server-side confirmation gate — the client must pass confirmed:true explicitly
  if (body.confirmed !== true) {
    return NextResponse.json({ error: 'Reset requires confirmed:true in the request body' }, { status: 400 });
  }

  const burnDualObject = body.burnDualObject === true;

  try {
    const result = await resetMember(badgeId, burnDualObject);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === 'Passport not found' ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
