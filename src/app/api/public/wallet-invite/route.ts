/**
 * POST /api/public/wallet-invite
 *
 * Sends (or resends) a DUAL org member invite to the authenticated user's email.
 * Non-fatal: "already a member" is treated as success since the wallet link is the same.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { members } from '@/lib/dual-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const email = session.memberAuth.email;
  if (!email) {
    return NextResponse.json({ error: 'No email address on your account.' }, { status: 400 });
  }

  let alreadyMember = false;
  try {
    await members.invite(email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('already')) {
      alreadyMember = true;
    } else {
      console.warn(`[wallet-invite] DUAL invite failed for ${email}:`, msg);
      return NextResponse.json({ error: 'Could not send invite. Try again shortly.' }, { status: 502 });
    }
  }

  const orgId = process.env.DUAL_ORG_ID ?? '';
  return NextResponse.json({
    ok: true,
    alreadyMember,
    walletUrl: `https://wallet.dual.network/${orgId}/login`,
  });
}
