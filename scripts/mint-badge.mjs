/**
 * DUAL // SIGNAL — Mint a single badge
 *
 * Usage:
 *   node scripts/mint-badge.mjs \
 *     --discord "@handle" \
 *     --wallet "0x..." \
 *     --tier "INITIATE" \
 *     [--genesis] [--stakeholder]
 *
 * Requires in .env:
 *   DUAL_API_BASE, DUAL_EMAIL, DUAL_PASSWORD, DUAL_SIGNAL_TEMPLATE_ID
 *
 * Prints the new object ID — save it to track the badge in your DB.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch { console.error('Missing .env'); process.exit(1); }

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

const discord    = get('--discord')    ?? '';
const telegram   = get('--telegram')  ?? '';
const wallet     = get('--wallet')    ?? '';
const tier       = get('--tier')      ?? 'INITIATE';
const isGenesis  = has('--genesis');
const isStaker   = has('--stakeholder');

const VALID_TIERS = ['INITIATE', 'EXPLORER', 'CONTRIBUTOR', 'BUILDER', 'VALIDATOR'];
if (!VALID_TIERS.includes(tier)) {
  console.error(`--tier must be one of: ${VALID_TIERS.join(', ')}`);
  process.exit(1);
}

const BASE        = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const TEMPLATE_ID = process.env.DUAL_SIGNAL_TEMPLATE_ID;
const EMAIL       = process.env.DUAL_EMAIL;
const PASS        = process.env.DUAL_PASSWORD;

if (!TEMPLATE_ID) { console.error('DUAL_SIGNAL_TEMPLATE_ID not set in .env — run setup.mjs first'); process.exit(1); }
if (!EMAIL || !PASS) { console.error('DUAL_EMAIL and DUAL_PASSWORD must be set in .env'); process.exit(1); }

// ── Login ─────────────────────────────────────────────────────────────────────
console.log(`\nLogging in as ${EMAIL} ...`);
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
if (!loginRes.ok) { console.error('Login failed:', await loginRes.text()); process.exit(1); }
const { access_token: personalJwt } = await loginRes.json();

const switchRes = await fetch(`${BASE}/organizations/switch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${personalJwt}` },
  body: JSON.stringify({ id: process.env.DUAL_ORG_ID }),
});
if (!switchRes.ok) { console.error('Org switch failed:', await switchRes.text()); process.exit(1); }
const { access_token: jwt } = await switchRes.json();
console.log('✓ Logged in (org context)');

// ── Mint ──────────────────────────────────────────────────────────────────────
console.log(`\nMinting badge ...`);
console.log(`  Tier:         ${tier}`);
console.log(`  Discord:      ${discord || '(none)'}`);
console.log(`  Wallet:       ${wallet || '(none)'}`);
console.log(`  Genesis:      ${isGenesis}`);
console.log(`  Stakeholder:  ${isStaker}`);

const mintRes = await fetch(`${BASE}/ebus/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    action: {
      mint: {
        template_id: TEMPLATE_ID,
        num: 1,
        data: {
          metadata: {
            name: `DUAL // SIGNAL — ${discord || wallet || 'Badge'}`,
          },
          custom: {
            identity_tier:     tier,
            is_genesis:        String(isGenesis),
            is_stakeholder:    String(isStaker),
            is_governor:       'false',
            signal_count:      '0',
            achievement_level: '',
            advocate_approved: 'false',
            discord_handle:    discord,
            telegram_handle:   telegram,
            wallet_address:    wallet,
            member_since:      new Date().toISOString().split('T')[0],
          },
        },
      },
    },
  }),
});

if (!mintRes.ok) {
  console.error('\n❌  Mint failed:', await mintRes.text());
  process.exit(1);
}

const result = await mintRes.json();
const objectId = result.steps?.[0]?.output?.ids?.[0] ?? result.id ?? '(check response)';

console.log('\n' + '─'.repeat(60));
console.log('✅  Badge minted!\n');
console.log(`    Object ID:   ${objectId}`);
console.log(`    Action ID:   ${result.action_id ?? 'n/a'}`);
console.log('\nNext steps:');
console.log(`  • View on explorer: https://explorer.dual.network/objects/${objectId}`);
console.log('  • Update your DB:   set dualObjectId =', objectId);
console.log('─'.repeat(60) + '\n');
