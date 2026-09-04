/**
 * Register the DUAL // SIGNAL webhook URL with DUAL Network.
 *
 * Run once after deploying to Railway:
 *   node scripts/register-webhook.mjs
 *
 * What it does:
 *   1. Lists existing webhooks so you can see what's already registered.
 *   2. Registers the production receiver URL for your template.
 *   3. Prints the response — save the webhook ID somewhere safe.
 *
 * Required env vars (copy from Railway or .env):
 *   DUAL_API_BASE, DUAL_EMAIL, DUAL_PASSWORD, DUAL_ORG_ID,
 *   DUAL_SIGNAL_TEMPLATE_ID, NEXT_PUBLIC_APP_URL
 */

import 'dotenv/config';

const BASE        = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const EMAIL       = process.env.DUAL_EMAIL;
const PASSWORD    = process.env.DUAL_PASSWORD;
const ORG_ID      = process.env.DUAL_ORG_ID;
const TEMPLATE_ID = process.env.DUAL_SIGNAL_TEMPLATE_ID;
const APP_URL     = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

if (!EMAIL || !PASSWORD || !ORG_ID || !TEMPLATE_ID || !APP_URL) {
  console.error('Missing required env vars. Check .env or Railway variables:');
  console.error('  DUAL_EMAIL, DUAL_PASSWORD, DUAL_ORG_ID, DUAL_SIGNAL_TEMPLATE_ID, NEXT_PUBLIC_APP_URL');
  process.exit(1);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getOrgJwt() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed ${loginRes.status}: ${await loginRes.text()}`);
  const { access_token: personalJwt } = await loginRes.json();

  const switchRes = await fetch(`${BASE}/organizations/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${personalJwt}` },
    body: JSON.stringify({ id: ORG_ID }),
  });
  if (!switchRes.ok) throw new Error(`Org switch failed ${switchRes.status}: ${await switchRes.text()}`);
  const { access_token } = await switchRes.json();
  return access_token;
}

async function dualPost(path, body, jwt) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function dualGet(path, jwt) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${jwt}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const WEBHOOK_URL = `${APP_URL}/api/webhooks/dual`;

console.log('Authenticating with DUAL Network...');
const jwt = await getOrgJwt();
console.log('✓ Authenticated\n');

// List existing webhooks
console.log('Existing webhooks:');
const existing = await dualGet('/webhooks', jwt);
console.log(JSON.stringify(existing, null, 2));
console.log('');

// Register new webhook
console.log(`Registering webhook → ${WEBHOOK_URL}`);
console.log(`Template: ${TEMPLATE_ID}`);
const result = await dualPost('/webhooks', {
  url:   WEBHOOK_URL,
  rules: [{ template_id: TEMPLATE_ID }],
}, jwt);

console.log('\n✓ Webhook registered:');
console.log(JSON.stringify(result, null, 2));
console.log('\nNext steps:');
console.log('1. Copy the webhook secret from the response (or DUAL dashboard) into DUAL_WEBHOOK_SECRET');
console.log('2. Set DUAL_WEBHOOK_DEBUG=1 in Railway to log the first real event and confirm header names');
console.log('3. Remove DUAL_WEBHOOK_DEBUG=1 once confirmed');
