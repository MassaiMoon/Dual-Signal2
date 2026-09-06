/**
 * GET  /api/public/join?username=xxx  — username availability check
 * POST /api/public/join               — create DUAL // SIGNAL Passport
 *
 * Public endpoint — no auth required.
 *
 * Username policy:
 *   3–24 characters, A-Z a-z 0-9 _ -
 *   Case-insensitive uniqueness via usernameNormalized.
 *
 * Wallet is never requested. The DUAL object is owned by the org's internal
 * account; wallet_address is stored as an empty string until the user
 * optionally links one later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ebus } from '@/lib/dual-client';
import { Provider } from '@prisma/client';

export const dynamic = 'force-dynamic';

// ── Validation ────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[A-Za-z0-9_-]{3,24}$/;

function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

function validateUsername(raw: string): string | null {
  const u = raw.trim();
  if (u.length === 0)  return 'Username is required.';
  if (u.length < 3)   return 'Username must be at least 3 characters.';
  if (u.length > 24)  return 'Username must be 24 characters or fewer.';
  if (!USERNAME_RE.test(u)) return 'Username may only contain letters, numbers, underscores, and hyphens.';
  return null;
}

function cleanHandle(raw: string): string {
  return (raw ?? '').replace(/^@/, '').trim();
}

// ── GET — availability check ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username') ?? '';

  const err = validateUsername(username);
  if (err) return NextResponse.json({ available: false, reason: err });

  const normalized = normalizeUsername(username);
  const existing   = await db.user.findUnique({ where: { usernameNormalized: normalized } });

  return NextResponse.json({ available: !existing });
}

// ── POST — create Passport ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    username:       string;
    x?:             string;
    telegram?:      string;
    discord?:       string;
    forum?:         string;
    walletAddress?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ── Validate username ───────────────────────────────────────────────────────
  const usernameErr = validateUsername(body.username ?? '');
  if (usernameErr) return NextResponse.json({ error: usernameErr }, { status: 422 });

  const username           = body.username.trim();
  const usernameNormalized = normalizeUsername(username);

  // ── Clean handles ────────────────────────────────────────────────────────────
  const xHandle        = cleanHandle(body.x        ?? '');
  const telegramHandle = cleanHandle(body.telegram  ?? '');
  const discordHandle  = cleanHandle(body.discord   ?? '');
  const forumHandle    = cleanHandle(body.forum     ?? '');
  const walletAddress  = (body.walletAddress ?? '').trim();

  // ── Guard: username must be unique ──────────────────────────────────────────
  const existingUser = await db.user.findUnique({ where: { usernameNormalized } });
  if (existingUser) {
    return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });
  }

  // ── DUAL template ────────────────────────────────────────────────────────────
  const templateId = process.env.DUAL_SIGNAL_TEMPLATE_ID;
  if (!templateId) {
    return NextResponse.json({ error: 'DUAL_SIGNAL_TEMPLATE_ID not configured.' }, { status: 500 });
  }

  const now         = new Date();
  const memberSince = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── Mint on DUAL ─────────────────────────────────────────────────────────────
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
        discord_level:    '0',
        username:         username,
        wallet_address:   walletAddress,
        member_since:     memberSince,
      },
      { name: `DUAL // SIGNAL — ${username}` },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[join] DUAL mint failed:', msg);
    return NextResponse.json({ error: `Passport creation failed. Please try again.` }, { status: 502 });
  }

  const dualObjectId = mintResult.steps?.[0]?.output?.ids?.[0];
  if (!dualObjectId) {
    console.error('[join] No object ID in mint response:', JSON.stringify(mintResult));
    return NextResponse.json({ error: 'Passport created on DUAL but no ID returned.' }, { status: 502 });
  }

  // ── Create DB records ────────────────────────────────────────────────────────
  let badge;
  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, usernameNormalized },
      });

      const badge = await tx.badge.create({
        data: {
          userId:          user.id,
          dualObjectId,
          dualTemplateId:  templateId,
          walletAddress,
          memberSince,
          xHandle,
          telegramHandle,
          discordHandle,
          isOG:            false,
          signalScore:     0,
          cachedTier:      'INITIATE',
          xSignalLevel:    0,
          telegramLevel:   0,
          governanceLevel: 0,
          discordLevel:    0,
        },
      });

      // Create ExternalAccount records for provided handles.
      // verifiedAt is null — handles are self-reported, not yet verified.
      const accounts: Array<{
        userId: string; source: Provider; externalUserId: string; handle: string;
      }> = [];

      if (xHandle)        accounts.push({ userId: user.id, source: Provider.TWITTER,    externalUserId: xHandle.toLowerCase(),        handle: xHandle        });
      if (telegramHandle) accounts.push({ userId: user.id, source: Provider.TELEGRAM,   externalUserId: telegramHandle.toLowerCase(),  handle: telegramHandle });
      if (discordHandle)  accounts.push({ userId: user.id, source: Provider.DISCORD,    externalUserId: discordHandle.toLowerCase(),   handle: discordHandle  });
      if (forumHandle)    accounts.push({ userId: user.id, source: Provider.DUAL_FORUM, externalUserId: forumHandle.toLowerCase(),     handle: forumHandle    });

      if (accounts.length > 0) {
        await tx.externalAccount.createMany({ data: accounts });
      }

      return { user, badge };
    });
    badge = result.badge;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // DUAL object is already minted — log the ID so it can be recovered manually.
    console.error(`[join] DB transaction failed after DUAL mint (objectId=${dualObjectId}):`, msg);
    return NextResponse.json(
      { error: 'Passport was minted but could not be saved. Contact support.' },
      { status: 500 },
    );
  }

  console.log(`[join] Created passport for ${username} — objectId=${dualObjectId}`);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  return NextResponse.json({
    status:       'created',
    username,
    dualObjectId: badge.dualObjectId,
    badgeUrl:     `${appUrl}/badge/${badge.dualObjectId}`,
    memberSince,
    connected: {
      x:          !!xHandle,
      telegram:   !!telegramHandle,
      discord:    !!discordHandle,
      forum:      !!forumHandle,
    },
  }, { status: 201 });
}
