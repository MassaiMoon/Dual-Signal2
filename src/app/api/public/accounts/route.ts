/**
 * POST /api/public/accounts
 *
 * Add a community identity to an existing Passport after onboarding.
 * Identified by dualObjectId (stable Passport ID — no wallet required).
 *
 * Handles are self-reported and NOT verified at this stage.
 * verifiedAt remains null until a real verification mechanism is in place.
 *
 * Body: { dualObjectId, provider, handle }
 * provider: 'x' | 'telegram' | 'discord' | 'forum'
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Provider } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PROVIDER_MAP: Record<string, Provider> = {
  x:        Provider.TWITTER,
  twitter:  Provider.TWITTER,
  telegram: Provider.TELEGRAM,
  discord:  Provider.DISCORD,
  forum:    Provider.DUAL_FORUM,
  dual_forum: Provider.DUAL_FORUM,
};

const HANDLE_FIELD: Record<Provider, 'xHandle' | 'telegramHandle' | 'discordHandle' | null> = {
  [Provider.TWITTER]:    'xHandle',
  [Provider.TELEGRAM]:   'telegramHandle',
  [Provider.DISCORD]:    'discordHandle',
  [Provider.DUAL_FORUM]: null,
};

export async function POST(req: NextRequest) {
  let body: { dualObjectId: string; provider: string; handle: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { dualObjectId, provider: rawProvider, handle: rawHandle } = body;
  if (!dualObjectId || !rawProvider || !rawHandle) {
    return NextResponse.json({ error: 'dualObjectId, provider, and handle are required.' }, { status: 400 });
  }

  const provider = PROVIDER_MAP[rawProvider.toLowerCase()];
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown provider. Use: x, telegram, discord, or forum.` },
      { status: 400 },
    );
  }

  const handle = rawHandle.replace(/^@/, '').trim();
  if (!handle) {
    return NextResponse.json({ error: 'Handle cannot be empty.' }, { status: 400 });
  }

  // Find badge + user
  const badge = await db.badge.findFirst({
    where: { dualObjectId },
    include: { user: true },
  });
  if (!badge) {
    return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });
  }

  // Check for duplicate connection on this passport
  const existingAccount = await db.externalAccount.findUnique({
    where: { source_externalUserId: { source: provider, externalUserId: handle.toLowerCase() } },
  });
  if (existingAccount && existingAccount.userId !== badge.userId) {
    return NextResponse.json({ error: 'This handle is already linked to another Passport.' }, { status: 409 });
  }
  if (existingAccount && existingAccount.userId === badge.userId) {
    return NextResponse.json({ status: 'already_connected', handle, provider });
  }

  // Create ExternalAccount and update badge handle field
  await db.$transaction(async (tx) => {
    await tx.externalAccount.create({
      data: {
        userId:         badge.userId,
        source:         provider,
        externalUserId: handle.toLowerCase(),
        handle,
        verifiedAt:     null,
      },
    });

    const badgeHandleField = HANDLE_FIELD[provider];
    if (badgeHandleField) {
      await tx.badge.update({
        where: { id: badge.id },
        data: { [badgeHandleField]: handle },
      });
    }
  });

  console.log(`[accounts] Added ${provider} handle "${handle}" to passport ${dualObjectId}`);

  return NextResponse.json({ status: 'connected', handle, provider });
}
