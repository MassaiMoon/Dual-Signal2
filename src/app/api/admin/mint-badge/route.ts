/**
 * POST /api/admin/mint-badge
 *
 * M6 — Mint a DUAL // SIGNAL badge for a new community member.
 *
 * 1. Mints a new badge object on DUAL Network via ebus.mint()
 * 2. Creates User + Badge records in the database
 * 3. Returns the badge face URL ready to share
 *
 * Protected by ADMIN_TOKEN bearer auth.
 *
 * Requires DUAL_SIGNAL_TEMPLATE_ID in env.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ebus } from '@/lib/dual-client';
import { calculateTier } from '@/lib/config';

export const dynamic = 'force-dynamic';

interface MintRequest {
  walletAddress:  string;
  discordHandle?: string;
  telegramHandle?: string;
  isOG?:          boolean;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templateId = process.env.DUAL_SIGNAL_TEMPLATE_ID;
  if (!templateId) {
    return NextResponse.json({ error: 'DUAL_SIGNAL_TEMPLATE_ID not set' }, { status: 500 });
  }

  let body: MintRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { walletAddress, discordHandle = '', telegramHandle = '', isOG = false } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
  }

  // Guard against duplicate mints for the same wallet
  const existingBadge = await db.badge.findFirst({ where: { walletAddress } });
  if (existingBadge) {
    return NextResponse.json(
      { error: 'A badge already exists for this wallet', badgeId: existingBadge.id },
      { status: 409 },
    );
  }

  const now    = new Date();
  const memberSince = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const shortWallet = `${walletAddress.slice(0, 6)}···${walletAddress.slice(-4)}`;

  // ── Mint on DUAL ────────────────────────────────────────────────────────────
  let mintResult: Awaited<ReturnType<typeof ebus.mint>>;
  try {
    mintResult = await ebus.mint(
      templateId,
      {
        signal_score:     '0',
        identity_tier:    'INITIATE',
        x_signal_level:   '0',
        telegram_level:   '0',
        governance_level: '0',
        holder_level:     '0',
        wallet_address:   walletAddress,
        member_since:     memberSince,
      },
      {
        name: `DUAL // SIGNAL — ${shortWallet}`,
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mint-badge] DUAL mint failed:', msg);
    return NextResponse.json({ error: `DUAL mint failed: ${msg}` }, { status: 502 });
  }

  const dualObjectId = mintResult.steps?.[0]?.output?.ids?.[0];
  if (!dualObjectId) {
    console.error('[mint-badge] No object ID in mint response:', JSON.stringify(mintResult));
    return NextResponse.json({ error: 'Mint succeeded but no object ID returned' }, { status: 502 });
  }

  console.log(`[mint-badge] Minted DUAL object ${dualObjectId} for wallet ${walletAddress}`);

  // ── Create DB records ───────────────────────────────────────────────────────
  const { user, badge } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: {} });

    const badge = await tx.badge.create({
      data: {
        userId:          user.id,
        dualObjectId,
        dualTemplateId:  templateId,
        walletAddress,
        memberSince,
        discordHandle,
        telegramHandle,
        isOG,
        signalScore:     0,
        cachedTier:      'INITIATE',
        xSignalLevel:    0,
        telegramLevel:   0,
        governanceLevel: 0,
        holderLevel:     0,
      },
    });

    return { user, badge };
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const badgeFaceUrl = `${appUrl}/faces/badge?id=${dualObjectId}`;

  console.log(`[mint-badge] Created badge ${badge.id} for user ${user.id}`);

  return NextResponse.json({
    status:       'minted',
    badgeId:      badge.id,
    userId:       user.id,
    dualObjectId,
    walletAddress,
    memberSince,
    tier:         'INITIATE',
    badgeFaceUrl,
    actionId:     mintResult.action_id,
  }, { status: 201 });
}
