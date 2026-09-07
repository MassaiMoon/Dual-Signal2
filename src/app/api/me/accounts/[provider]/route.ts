/**
 * PATCH /api/me/accounts/[provider]  — add or update a community handle
 * DELETE /api/me/accounts/[provider] — remove a community handle
 *
 * Provider: x | telegram | discord | forum
 *
 * Identity-change safety:
 *   X        — blocked if X user ID was already resolved via API (xResolvedAt set)
 *   Telegram — blocked if badge has activity days matched by Telegram user ID
 *   Discord  — always allowed (no stable ID in schema)
 *   Forum    — always allowed (admin re-syncs by forumUserId, not handle)
 *
 * Handle uniqueness is enforced across all members for X and Telegram.
 * Member derives from the session — the client cannot choose another member.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { Provider } from '@prisma/client';

export const dynamic = 'force-dynamic';

// ── Provider mapping ──────────────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, Provider> = {
  x:        Provider.TWITTER,
  telegram: Provider.TELEGRAM,
  discord:  Provider.DISCORD,
  forum:    Provider.DUAL_FORUM,
};

const BADGE_HANDLE_FIELD: Record<Provider, 'xHandle' | 'telegramHandle' | 'discordHandle' | null> = {
  [Provider.TWITTER]:    'xHandle',
  [Provider.TELEGRAM]:   'telegramHandle',
  [Provider.DISCORD]:    'discordHandle',
  [Provider.DUAL_FORUM]: null,
};

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, '').trim();
}

// ── PATCH — update or add handle ──────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { provider: rawProvider } = await params;
  const provider = PROVIDER_MAP[rawProvider.toLowerCase()];
  if (!provider) {
    return NextResponse.json(
      { error: 'Unknown provider. Use: x, telegram, discord, or forum.' },
      { status: 400 },
    );
  }

  const user  = session.memberAuth.user;
  const badge = user?.badge;
  if (!user || !badge) {
    return NextResponse.json({ error: 'No Passport found for this account.' }, { status: 404 });
  }

  let body: { handle?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const handle = cleanHandle(body.handle ?? '');
  if (!handle || handle.length > 100) {
    return NextResponse.json({ error: 'Handle is required and must be under 100 characters.' }, { status: 422 });
  }

  // Validate handle format per provider
  if (provider === Provider.TWITTER && !/^[A-Za-z0-9_]{1,50}$/.test(handle)) {
    return NextResponse.json({ error: 'X handle may only contain letters, numbers, and underscores.' }, { status: 422 });
  }
  if (provider === Provider.TELEGRAM && !/^[A-Za-z0-9_]{5,32}$/.test(handle)) {
    return NextResponse.json({ error: 'Telegram handle must be 5-32 characters (letters, numbers, underscores).' }, { status: 422 });
  }

  const normalized = handle.toLowerCase();

  // Find existing ExternalAccount for this user+provider
  const existing = await db.externalAccount.findFirst({
    where: { userId: user.id, source: provider },
  });

  // No-op if handle unchanged
  if (existing && existing.handle.toLowerCase() === normalized) {
    return NextResponse.json({ status: 'no_change', handle: existing.handle });
  }

  // ── Safety checks ─────────────────────────────────────────────────────────

  if (provider === Provider.TWITTER && existing?.xResolvedAt) {
    return NextResponse.json(
      { error: 'Your X account has been verified. To update your handle, please contact support.', code: 'review_required' },
      { status: 409 },
    );
  }

  if (provider === Provider.TELEGRAM && existing) {
    const verifiedDay = await db.telegramActiveDay.findFirst({
      where: { badgeId: badge.id, telegramProviderUserId: { not: null } },
    });
    if (verifiedDay) {
      return NextResponse.json(
        { error: 'Your Telegram account has activity records. To update your handle, please contact support.', code: 'review_required' },
        { status: 409 },
      );
    }
  }

  // Uniqueness: check if another user already uses this handle
  const conflict = await db.externalAccount.findFirst({
    where: {
      source:         provider,
      externalUserId: normalized,
      userId:         { not: user.id },
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: 'This handle is already linked to another Passport.' },
      { status: 409 },
    );
  }

  // ── Apply update ──────────────────────────────────────────────────────────

  const badgeField = BADGE_HANDLE_FIELD[provider];

  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.externalAccount.update({
        where: { id: existing.id },
        data: { handle, externalUserId: normalized, requiresReview: false },
      });
    } else {
      await tx.externalAccount.create({
        data: {
          userId: user.id,
          source: provider,
          externalUserId: normalized,
          handle,
        },
      });
    }

    if (badgeField) {
      await tx.badge.update({
        where: { id: badge.id },
        data: { [badgeField]: handle },
      });
    }
  });

  console.log(`[me/accounts] ${user.username} updated ${provider} handle to "${handle}"`);

  return NextResponse.json({ status: 'updated', provider, handle });
}

// ── DELETE — remove handle ────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { provider: rawProvider } = await params;
  const provider = PROVIDER_MAP[rawProvider.toLowerCase()];
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 400 });
  }

  const user  = session.memberAuth.user;
  const badge = user?.badge;
  if (!user || !badge) {
    return NextResponse.json({ error: 'No Passport found.' }, { status: 404 });
  }

  const existing = await db.externalAccount.findFirst({
    where: { userId: user.id, source: provider },
  });

  if (!existing) {
    return NextResponse.json({ status: 'not_connected' });
  }

  const badgeField = BADGE_HANDLE_FIELD[provider];

  await db.$transaction(async (tx) => {
    await tx.externalAccount.delete({ where: { id: existing.id } });
    if (badgeField) {
      await tx.badge.update({ where: { id: badge.id }, data: { [badgeField]: '' } });
    }
  });

  console.log(`[me/accounts] ${user.username} removed ${provider} connection`);

  return NextResponse.json({ status: 'removed', provider });
}
