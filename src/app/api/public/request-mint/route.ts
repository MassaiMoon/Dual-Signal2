/**
 * POST /api/public/request-mint
 *
 * Called by /join when a visitor submits handles for a wallet with no badge.
 * Sends a Telegram notification (primary) with Gmail SMTP as fallback.
 *
 * Required Railway env vars:
 *   TELEGRAM_BOT_TOKEN    — already set for webhook tracking
 *   ADMIN_TELEGRAM_CHAT_ID — your personal Telegram chat ID (see instructions below)
 *
 * Optional fallback:
 *   GMAIL_USER / GMAIL_APP_PASSWORD — used only if Telegram notification fails
 *   ADMIN_EMAIL — email destination (defaults to perinaca15@gmail.com)
 *
 * To get ADMIN_TELEGRAM_CHAT_ID:
 *   1. Open Telegram, search for your bot and send it any message (e.g. /start)
 *   2. Visit: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
 *   3. Look for "chat":{"id": 123456789} — that number is your chat ID
 *   4. Add it to Railway as ADMIN_TELEGRAM_CHAT_ID
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'perinaca15@gmail.com';

// ── Telegram ──────────────────────────────────────────────────────────────────

async function sendTelegram(walletAddress: string, x: string, tg: string, now: string): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://dual-signal2-production.up.railway.app').replace(/\/$/, '');

  const text = [
    '🔔 <b>New Badge Mint Request</b>',
    '',
    `💳 <b>Wallet:</b> <code>${walletAddress}</code>`,
    `𝕏 <b>X:</b> ${x  ? `@${x}`  : '—'}`,
    `📱 <b>Telegram:</b> ${tg ? `@${tg}` : '—'}`,
    `🕐 <b>Time:</b> ${now}`,
    '',
    `<a href="${appUrl}/admin">Open Admin Panel → Quick Mint</a>`,
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error('[request-mint] Telegram error:', data.description);
      return false;
    }
    console.log(`[request-mint] Telegram notification sent to chat_id=${chatId}`);
    return true;
  } catch (err) {
    console.error('[request-mint] Telegram fetch error:', (err as Error).message);
    return false;
  }
}

// ── Gmail fallback ────────────────────────────────────────────────────────────

async function sendEmail(walletAddress: string, x: string, tg: string, now: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return false;

  const transport = nodemailer.createTransport({
    service:           'gmail',
    auth:              { user, pass },
    connectionTimeout: 8000,
    socketTimeout:     10000,
    greetingTimeout:   8000,
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://dual-signal2-production.up.railway.app').replace(/\/$/, '');

  const text = [
    'New DUAL // SIGNAL badge mint request',
    '',
    `Wallet:   ${walletAddress}`,
    `X:        ${x  ? `@${x}`  : '—'}`,
    `Telegram: ${tg ? `@${tg}` : '—'}`,
    `Time:     ${now}`,
    '',
    `Mint here: ${appUrl}/admin`,
  ].join('\n');

  try {
    await transport.verify();
    const info = await transport.sendMail({
      from:    `"DUAL SIGNAL" <${user}>`,
      to:      ADMIN_EMAIL,
      replyTo: ADMIN_EMAIL,
      subject: `Badge mint request — ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
      text,
    });
    console.log(`[request-mint] Email sent — messageId=${info.messageId}`);
    return true;
  } catch (err) {
    console.error('[request-mint] Email error:', (err as Error).message);
    return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { walletAddress: string; xHandle?: string; telegramHandle?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { walletAddress, xHandle, telegramHandle } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
  }

  const x   = (xHandle        ?? '').replace(/^@/, '').trim();
  const tg  = (telegramHandle ?? '').replace(/^@/, '').trim();
  const now = new Date().toLocaleString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';

  // Try Telegram first (instant, no spam issues), fall back to email
  const tgSent    = await sendTelegram(walletAddress, x, tg, now);
  const emailSent = tgSent ? false : await sendEmail(walletAddress, x, tg, now);

  if (!tgSent && !emailSent) {
    console.warn('[request-mint] No notification sent — set TELEGRAM_BOT_TOKEN + ADMIN_TELEGRAM_CHAT_ID in Railway');
  }

  return NextResponse.json({ queued: true, tgSent, emailSent });
}
