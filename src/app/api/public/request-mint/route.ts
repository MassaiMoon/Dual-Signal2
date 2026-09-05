/**
 * POST /api/public/request-mint
 *
 * Called by /join when a visitor submits handles for a wallet with no badge.
 * Sends an email notification to the admin via Gmail SMTP.
 *
 * Required Railway env vars:
 *   GMAIL_USER         — sending Gmail address (e.g. yourname@gmail.com)
 *   GMAIL_APP_PASSWORD — 16-char App Password from Google Account → Security → App passwords
 *   ADMIN_EMAIL        — destination (defaults to perinaca15@gmail.com)
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'perinaca15@gmail.com';

function buildTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service:           'gmail',
    auth:              { user, pass },
    connectionTimeout: 8000,
    socketTimeout:     10000,
    greetingTimeout:   8000,
  });
}

export async function POST(req: NextRequest) {
  let body: { walletAddress: string; xHandle?: string; telegramHandle?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { walletAddress, xHandle, telegramHandle } = body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
  }

  const x  = (xHandle        ?? '').replace(/^@/, '').trim();
  const tg = (telegramHandle ?? '').replace(/^@/, '').trim();
  const now = new Date().toLocaleString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';

  const transport = buildTransport();
  if (!transport) {
    console.warn('[request-mint] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email');
    return NextResponse.json({ queued: true, emailSent: false });
  }

  // Verify SMTP credentials on first use — catches wrong App Password fast
  try {
    await transport.verify();
  } catch (err) {
    console.error('[request-mint] SMTP verify failed:', (err as Error).message);
    return NextResponse.json({ queued: true, emailSent: false, smtpError: 'auth' });
  }

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

  const html = `
    <div style="font-family:monospace;background:#0A1525;color:#C8D8E8;padding:32px;border-radius:12px;max-width:520px">
      <h2 style="color:#5ED3EA;margin:0 0 4px;letter-spacing:0.1em">DUAL // SIGNAL</h2>
      <p style="color:#4A90A4;margin:0 0 24px;font-size:12px;letter-spacing:0.15em">NEW MINT REQUEST</p>

      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#4A90A4;width:110px;font-size:13px">Wallet</td>
            <td style="padding:8px 0;color:#E8F4FC;font-size:13px;word-break:break-all">${walletAddress}</td></tr>
        <tr><td style="padding:8px 0;color:#4A90A4;font-size:13px">𝕏 Handle</td>
            <td style="padding:8px 0;color:#E8F4FC;font-size:13px">${x ? `@${x}` : '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#4A90A4;font-size:13px">Telegram</td>
            <td style="padding:8px 0;color:#E8F4FC;font-size:13px">${tg ? `@${tg}` : '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#4A90A4;font-size:13px">Submitted</td>
            <td style="padding:8px 0;color:#E8F4FC;font-size:13px">${now}</td></tr>
      </table>

      <div style="margin:24px 0 0;padding:16px;background:#0F1E30;border:1px solid rgba(94,211,234,0.15);border-radius:8px">
        <pre style="margin:0;color:#C8D8E8;font-size:13px">Wallet: ${walletAddress}
X: ${x ? `@${x}` : '—'}
Telegram: ${tg ? `@${tg}` : '—'}</pre>
      </div>

      <p style="margin:20px 0 0;font-size:12px;color:#4A90A4">
        <a href="${appUrl}/admin" style="color:#5ED3EA">Open Admin Panel → Quick Mint</a>
      </p>
    </div>
  `;

  try {
    const info = await transport.sendMail({
      from:     `"DUAL SIGNAL" <${process.env.GMAIL_USER}>`,
      to:       ADMIN_EMAIL,
      replyTo:  ADMIN_EMAIL,
      subject:  `Badge mint request — ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
      text,
      html,
    });
    console.log(`[request-mint] Email sent — messageId=${info.messageId} to=${ADMIN_EMAIL} wallet=${walletAddress}`);
    return NextResponse.json({ queued: true, emailSent: true });
  } catch (err) {
    console.error('[request-mint] sendMail error:', (err as Error).message);
    return NextResponse.json({ queued: true, emailSent: false });
  }
}
