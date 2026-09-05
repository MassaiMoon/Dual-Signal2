/**
 * POST /api/admin/setup-telegram
 *
 * Registers the Telegram webhook with Telegram's servers.
 * Call once after setting TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET.
 *
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken     = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl       = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  if (!botToken)      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' },      { status: 500 });
  if (!webhookSecret) return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET not set' }, { status: 500 });
  if (!appUrl)        return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' },      { status: 500 });

  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  const tgRes = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url:             webhookUrl,
        secret_token:    webhookSecret,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    },
  );

  const tgBody = await tgRes.json();

  if (!tgBody.ok) {
    console.error('[setup-telegram] Telegram setWebhook failed:', tgBody);
    return NextResponse.json({ error: 'Telegram setWebhook failed', detail: tgBody }, { status: 502 });
  }

  console.log(`[setup-telegram] Webhook registered → ${webhookUrl}`);

  return NextResponse.json({
    status:     'registered',
    webhookUrl,
    telegramResponse: tgBody,
  });
}

// GET — check current webhook info
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });

  const res  = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const body = await res.json();
  return NextResponse.json(body);
}
