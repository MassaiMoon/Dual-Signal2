/**
 * DUAL // SIGNAL — one-time Tier Certificate setup
 *
 * Creates the tier-certificate template, creates its face (an iframe of
 * /faces/tier), attaches the face, then prints the template ID for .env.
 *
 * Usage:  node scripts/setup-tier-certificate.mjs
 * Needs:  DUAL_API_BASE, DUAL_EMAIL, DUAL_PASSWORD, DUAL_ORG_ID in .env
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  if (!process.env[key]) process.env[key] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}

const BASE   = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const ORG_ID = process.env.DUAL_ORG_ID;
const FACE_ORIGIN = 'https://dualsignal.org';

async function api(path, { method = 'GET', body, jwt } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function login() {
  const { access_token: personal } = await api('/auth/login', {
    method: 'POST', body: { email: process.env.DUAL_EMAIL, password: process.env.DUAL_PASSWORD },
  });
  const { access_token } = await api('/organizations/switch', { method: 'POST', body: { id: ORG_ID }, jwt: personal });
  return access_token;
}

const CUSTOM_FIELDS = {
  tier:                 'INITIATE',
  username:             '',
  score_at_achievement: '0',
  achieved_at:          '',   // YYYY-MM-DD
  member_since:         '',   // YYYY-MM
  serial:               '0',  // Nth certificate issued for this tier
  passport_object_id:   '',
};

// `update` is deliberately absent: certificates never change after mint.
// Access stays `public` — `private` blocks the org itself (tested 2026-10-04)
// and DUAL still enforces the ownership check on public actions.
const template = {
  name: 'io.dual.signal.tier-certificate.v1',
  object: {
    metadata: {
      name:        'DUAL // SIGNAL Tier Certificate',
      description: 'Permanent record of reaching a DUAL // SIGNAL tier.',
      category:    'tier-certificate',
    },
    custom: CUSTOM_FIELDS,
  },
  actions: ['mint', 'transfer', 'burn'].map(name => ({ name, access: { type: 'public' } })),
  public_access: { custom: Object.keys(CUSTOM_FIELDS) },
  factory: { max_supply: 0, start_time: new Date().toISOString() },
};

const FACE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #040E1A; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
  </style>
</head>
<body>
  <iframe src="${FACE_ORIGIN}/faces/tier?embed=1&id={{ .id }}" frameborder="0" scrolling="no"></iframe>
</body>
</html>`;

try {
  const jwt = await login();
  console.log('✓ Logged in to org', ORG_ID);

  const created = await api('/templates', { method: 'POST', body: template, jwt });
  console.log('✓ Template created:', created.id);

  const face = await api('/faces', {
    method: 'POST',
    jwt,
    body: {
      name: 'DUAL // SIGNAL Tier Certificate Face',
      renderer: 'go-template',
      views: [
        { variant: 'card',   media_type: 'text/html', content: FACE_HTML },
        { variant: 'detail', media_type: 'text/html', content: FACE_HTML },
      ],
    },
  });
  console.log('✓ Face created:', face.id);

  await api(`/templates/${created.id}`, { method: 'PATCH', body: { face_id: face.id }, jwt });
  console.log('✓ Face attached');

  const check = await api(`/templates/${created.id}`, { jwt });
  console.log('  actions:      ', (check.actions ?? []).map(a => `${a.name}:${a.access?.type}`).join(', ') || 'none');
  console.log('  public fields:', (check.public_access?.custom ?? []).join(', ') || 'none');
  console.log('  face_id:      ', check.face_id);

  console.log(`\nAdd to .env (and Railway):\n  DUAL_TIER_CERT_TEMPLATE_ID="${created.id}"`);
} catch (err) {
  console.error('✗ Setup failed:', err.message);
  process.exit(1);
}
