/**
 * GET /api/admin/telegram-chat-id
 *
 * Helper to find your personal Telegram chat ID.
 * 1. Message your bot anything on Telegram first
 * 2. Hit this endpoint to see the chat ID
 *
 * Protected by ADMIN_TOKEN.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });

  const [meRes, updatesRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getMe`),
    fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`),
  ]);

  const me      = await meRes.json()      as { ok: boolean; result?: { username: string; first_name: string } };
  const updates = await updatesRes.json() as { ok: boolean; result?: { message?: { chat: { id: number; username?: string; first_name?: string } } }[] };

  const chats = (updates.result ?? [])
    .map(u => u.message?.chat)
    .filter(Boolean)
    .map(c => ({ id: c!.id, username: c!.username, name: c!.first_name }));

  const unique = [...new Map(chats.map(c => [c.id, c])).values()];

  return NextResponse.json({
    bot:    me.result,
    chats:  unique,
    hint:   unique.length === 0
      ? 'No messages found. Open Telegram, find your bot, and send it any message — then call this endpoint again.'
      : `Add ADMIN_TELEGRAM_CHAT_ID=${unique[0].id} to Railway variables.`,
  });
}
