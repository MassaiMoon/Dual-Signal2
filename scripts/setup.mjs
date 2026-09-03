/**
 * DUAL // SIGNAL — One-time platform setup
 *
 * Run this ONCE to create the template on the DUAL platform.
 * After it completes, copy the printed template ID into your .env file.
 *
 * Usage:
 *   node scripts/setup.mjs
 *
 * Requires in .env:
 *   DUAL_API_BASE, DUAL_EMAIL, DUAL_PASSWORD, DUAL_ORG_ID
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');

try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not read .env — make sure it exists (cp .env.example .env)');
  process.exit(1);
}

const BASE  = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const EMAIL = process.env.DUAL_EMAIL;
const PASS  = process.env.DUAL_PASSWORD;

if (!EMAIL || !PASS) {
  console.error('DUAL_EMAIL and DUAL_PASSWORD must be set in .env');
  process.exit(1);
}

// ── Step 1: Login to get JWT ──────────────────────────────────────────────────
async function login() {
  console.log(`\n[1/3] Logging in as ${EMAIL} ...`);
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!loginRes.ok) throw new Error(`Login failed ${loginRes.status}: ${await loginRes.text()}`);
  const { access_token: personalJwt } = await loginRes.json();

  // Switch to org context — required for all write operations
  const switchRes = await fetch(`${BASE}/organizations/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${personalJwt}` },
    body: JSON.stringify({ id: process.env.DUAL_ORG_ID }),
  });
  if (!switchRes.ok) throw new Error(`Org switch failed ${switchRes.status}: ${await switchRes.text()}`);
  const { access_token: orgJwt } = await switchRes.json();

  console.log(`    ✓ Logged in and switched to org context`);
  return orgJwt;
}

// ── Step 2: Create the DUAL // SIGNAL template ────────────────────────────────
async function createTemplate(jwt) {
  console.log('\n[2/3] Creating DUAL // SIGNAL template ...');

  const template = {
    name: 'io.dual.signal.community-badge.v1',
    object: {
      metadata: {
        name:        'DUAL // SIGNAL Badge',
        description: 'Living community identity badge. Evolves as you contribute to the DUAL ecosystem.',
        category:    'community-badge',
      },
      custom: {
        // Identity layer
        identity_tier:    'INITIATE',   // INITIATE | EXPLORER | CONTRIBUTOR | BUILDER | VALIDATOR
        // Status flags
        is_genesis:       'false',
        is_stakeholder:   'false',
        is_governor:      'false',
        // Achievement state
        signal_count:     '0',
        achievement_level: '',          // FIRST_SIGNAL | AMPLIFIER_I | AMPLIFIER_II | BROADCASTER
        advocate_approved: 'false',
        // Member info (set at mint time)
        discord_handle:   '',
        telegram_handle:  '',
        wallet_address:   '',
        member_since:     '',
      },
    },
    factory: {
      max_supply: 0,                    // unlimited
      start_time: new Date().toISOString(),
    },
  };

  const res = await fetch(`${BASE}/templates`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(template),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Template creation failed ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Step 3: Verify it's readable ─────────────────────────────────────────────
async function verifyTemplate(templateId, jwt) {
  console.log('\n[3/3] Verifying template is readable ...');
  const res = await fetch(`${BASE}/templates/${templateId}`, {
    headers: { 'Authorization': `Bearer ${jwt}` },
  });

  if (!res.ok) throw new Error(`Template read failed ${res.status}`);
  const t = await res.json();
  console.log(`    ✓ Name:     ${t.name}`);
  console.log(`    ✓ Actions:  ${t.actions?.map(a => a.name).join(', ') ?? 'none yet'}`);
  console.log(`    ✓ Custom fields: ${Object.keys(t.object?.custom ?? {}).join(', ')}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
try {
  const jwt      = await login();
  const created  = await createTemplate(jwt);
  await verifyTemplate(created.id, jwt);

  console.log('\n' + '─'.repeat(60));
  console.log('✅  Template created successfully!\n');
  console.log(`    Template ID: ${created.id}`);
  console.log('\nNext steps:');
  console.log(`  1. Add to .env:  DUAL_SIGNAL_TEMPLATE_ID="${created.id}"`);
  console.log('  2. Run:          node scripts/mint-badge.mjs');
  console.log('─'.repeat(60) + '\n');
} catch (err) {
  console.error('\n❌  Setup failed:', err.message);
  process.exit(1);
}
