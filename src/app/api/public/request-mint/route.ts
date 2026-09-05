/**
 * POST /api/public/request-mint
 *
 * Called by /join when a user submits handles for a wallet that has no badge yet.
 * Sends an email notification to the admin and returns the formatted mint message.
 *
 * Required env vars:
 *   RESEND_API_KEY   — Resend transactional email API key
 *   ADMIN_EMAIL      — destination address (falls back to perinaca15@gmail.com)
 *   RESEND_FROM      — verified sender address (falls back to onboarding@resend.dev for testing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'perinaca15@gmail.com';
const FROM_EMAIL  = process.env.RESEND_FROM  ?? 'onboarding@resend.dev';

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
  const now = new Date().toISOString();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Email not configured — still succeed so the user sees the confirmation screen
    console.warn('[request-mint] RESEND_API_KEY not set — skipping email');
    return NextResponse.json({ queued: true, emailSent: false });
  }

  const resend = new Resend(apiKey);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://dual-signal2-production.up.railway.app').replace(/\/$/, '');

  try {
    await resend.emails.send({
      from:    `DUAL SIGNAL <${FROM_EMAIL}>`,
      to:      [ADMIN_EMAIL],
      subject: `New Badge Mint Request — ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
      html: `
        <div style="font-family:monospace;background:#0A1525;color:#C8D8E8;padding:32px;border-radius:12px;max-width:520px">
          <h2 style="color:#5ED3EA;margin:0 0 8px;letter-spacing:0.1em">DUAL // SIGNAL</h2>
          <p style="color:#4A90A4;margin:0 0 24px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase">New Mint Request</p>

          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:8px 0;color:#4A90A4;width:110px;font-size:13px">Wallet</td>
              <td style="padding:8px 0;color:#E8F4FC;font-size:13px;word-break:break-all">${walletAddress}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#4A90A4;font-size:13px">𝕏 Handle</td>
              <td style="padding:8px 0;color:#E8F4FC;font-size:13px">${x ? `@${x}` : '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#4A90A4;font-size:13px">Telegram</td>
              <td style="padding:8px 0;color:#E8F4FC;font-size:13px">${tg ? `@${tg}` : '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#4A90A4;font-size:13px">Submitted</td>
              <td style="padding:8px 0;color:#E8F4FC;font-size:13px">${now}</td>
            </tr>
          </table>

          <div style="margin:24px 0 0;padding:16px;background:#0F1E30;border:1px solid rgba(94,211,234,0.15);border-radius:8px">
            <p style="margin:0 0 6px;color:#4A90A4;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Copy for mint:</p>
            <pre style="margin:0;color:#C8D8E8;font-size:13px;white-space:pre">Wallet: ${walletAddress}
X: ${x ? `@${x}` : '—'}
Telegram: ${tg ? `@${tg}` : '—'}</pre>
          </div>

          <p style="margin:20px 0 0;font-size:12px;color:#2A4A5E">
            Mint via the <a href="${appUrl}/admin" style="color:#5ED3EA">Admin Panel</a>
            → Quick Mint tab.
          </p>
        </div>
      `,
    });

    console.log(`[request-mint] Email sent for wallet ${walletAddress}`);
    return NextResponse.json({ queued: true, emailSent: true });
  } catch (err) {
    console.error('[request-mint] Resend error:', err);
    // Don't fail the user-facing flow if email fails
    return NextResponse.json({ queued: true, emailSent: false });
  }
}
