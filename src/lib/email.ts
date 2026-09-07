/**
 * Magic-link email delivery via Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY  — Resend API key
 *   EMAIL_FROM      — sender address, e.g. "DUAL // SIGNAL <signal@yourdomain.com>"
 *
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 */

import { Resend } from 'resend';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

export async function sendMagicLink(to: string, token: string): Promise<void> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const from   = process.env.EMAIL_FROM ?? 'DUAL // SIGNAL <noreply@dual.network>';
  const link   = `${appUrl}/api/auth/verify?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log to console so the developer can click the link
    console.log(`\n[email] Magic link for ${to}:\n  ${link}\n`);
    return;
  }

  const resend = getResend();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Your DUAL // SIGNAL login link',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#040E1A;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:40px 24px">
  <div style="font-size:18px;font-weight:700;letter-spacing:0.2em;color:#E8F4FC;margin-bottom:6px">DUAL // SIGNAL</div>
  <div style="font-size:10px;letter-spacing:0.24em;color:#2A5060;text-transform:uppercase;margin-bottom:36px">Community Identity Passport</div>

  <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#E8F4FC;line-height:1.2">Access Your Signal</p>
  <p style="margin:0 0 28px;font-size:14px;color:#5A8A9A;line-height:1.7">
    Click the button below to sign in. This link expires in 15 minutes and can only be used once.
  </p>

  <a href="${link}"
     style="display:inline-block;padding:14px 28px;background:#0EB4D0;border-radius:10px;color:#FFFFFF;font-weight:700;font-size:12px;text-decoration:none;letter-spacing:0.14em;text-transform:uppercase">
    ACCESS MY SIGNAL →
  </a>

  <p style="margin:28px 0 0;font-size:12px;color:#2A3A4A;line-height:1.7">
    If you didn't request this link, you can safely ignore this email.<br>
    Someone may have entered your email address by mistake.
  </p>

  <div style="margin-top:36px;padding-top:20px;border-top:1px solid rgba(94,211,234,0.08);font-size:11px;color:#1E3040">
    DUAL Network · Chain 6301
  </div>
</div>
</body>
</html>`,
    text: `Access your DUAL // SIGNAL dashboard:\n\n${link}\n\nThis link expires in 15 minutes and can only be used once.\n\nIf you didn't request this, ignore this email.\n\n—\nDUAL Network`,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
}
