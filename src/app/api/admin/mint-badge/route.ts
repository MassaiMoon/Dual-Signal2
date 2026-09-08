/**
 * POST /api/admin/mint-badge
 *
 * Admin: mint a DUAL // SIGNAL Passport for a community member.
 *
 * username is now the primary identity — walletAddress is optional.
 * Either username or walletAddress must be provided.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ebus } from '@/lib/dual-client';
import { calculateTier } from '@/lib/config';

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[A-Za-z0-9_-]{3,24}$/;

interface MintRequest {
  username?:    string;
  memberSince?: string;
  xSignal?:     boolean;
  telegram?:    boolean;
  governance?:  boolean;
  discord?:     boolean;
  isOG?:        boolean;
  isGenesis?:   boolean;
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

  const {
    username:    rawUsername,
    memberSince: rawMemberSince,
    xSignal    = false,
    telegram   = false,
    governance = false,
    discord    = false,
    isOG       = false,
    isGenesis  = false,
  } = body;

  if (!rawUsername) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }

  const username      = rawUsername.trim();
  const walletAddress = '';

  if (username && !USERNAME_RE.test(username)) {
    return NextResponse.json({ error: 'Invalid username format' }, { status: 422 });
  }

  // Guard against duplicate mints
  if (username) {
    const existingUser = await db.user.findUnique({
      where: { usernameNormalized: username.toLowerCase() },
    });
    if (existingUser) {
      const existingBadge = await db.badge.findFirst({ where: { userId: existingUser.id } });
      if (existingBadge) {
        return NextResponse.json(
          { error: 'A Passport already exists for this username', badgeId: existingBadge.id },
          { status: 409 },
        );
      }
    }
  }

  const now         = new Date();
  const MEMBER_SINCE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  const memberSince = (rawMemberSince && MEMBER_SINCE_RE.test(rawMemberSince.trim()))
    ? rawMemberSince.trim()
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const displayName = username || 'Member';

  // ── Mint on DUAL ─────────────────────────────────────────────────────────────
  let mintResult: Awaited<ReturnType<typeof ebus.mint>>;
  try {
    mintResult = await ebus.mint(
      templateId,
      {
        signal_score:     '0',
        identity_tier:    'INITIATE',
        x_signal_level:   xSignal    ? '1' : '0',
        telegram_level:   telegram   ? '1' : '0',
        governance_level: governance ? '1' : '0',
        discord_level:    discord    ? '1' : '0',
        username:         username,
        wallet_address:   '',
        member_since:     memberSince,
      },
      { name: `DUAL // SIGNAL — ${displayName}` },
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

  console.log(`[mint-badge] Minted DUAL object ${dualObjectId} for ${displayName}`);

  // ── Create DB records ─────────────────────────────────────────────────────────
  const { user, badge } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, usernameNormalized: username.toLowerCase() },
    });

    const badge = await tx.badge.create({
      data: {
        userId:          user.id,
        dualObjectId,
        dualTemplateId:  templateId,
        walletAddress:   '',
        memberSince,
        isOG,
        isGenesis,
        signalScore:     0,
        cachedTier:      'INITIATE',
        xSignalLevel:    xSignal    ? 1 : 0,
        telegramLevel:   telegram   ? 1 : 0,
        governanceLevel: governance ? 1 : 0,
        discordLevel:    discord    ? 1 : 0,
      },
    });

    return { user, badge };
  });

  const appUrl       = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const badgeFaceUrl = `${appUrl}/faces/badge?id=${dualObjectId}`;

  console.log(`[mint-badge] Created badge ${badge.id} for user ${user.id}`);

  return NextResponse.json({
    status:       'minted',
    badgeId:      badge.id,
    userId:       user.id,
    dualObjectId,
    username:     username || null,
    walletAddress: walletAddress || null,
    memberSince,
    tier:         'INITIATE',
    badgeFaceUrl,
    actionId:     mintResult.action_id,
  }, { status: 201 });
}
