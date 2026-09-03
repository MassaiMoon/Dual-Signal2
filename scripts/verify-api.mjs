/**
 * DUAL // SIGNAL — Verify API connectivity
 *
 * Runs a series of read-only checks to confirm your credentials and
 * API access are working before running setup.mjs.
 *
 * Usage:  node scripts/verify-api.mjs
 *
 * Requires in .env:  DUAL_API_BASE, DUAL_API_KEY, DUAL_ORG_ID
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch { console.error('Missing .env'); process.exit(1); }

const BASE    = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const API_KEY = process.env.DUAL_API_KEY;
const ORG_ID  = process.env.DUAL_ORG_ID;

const headers = { 'X-Api-Key': API_KEY };

async function check(label, url) {
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ ${label}`);
      return data;
    } else {
      console.log(`  ✗ ${label} — HTTP ${res.status}`);
      return null;
    }
  } catch (err) {
    console.log(`  ✗ ${label} — ${err.message}`);
    return null;
  }
}

console.log(`\nVerifying DUAL API connectivity`);
console.log(`Base: ${BASE}\n`);

const org     = await check('GET /organizations/:id',         `${BASE}/organizations/${ORG_ID}`);
const balance = await check('GET /organizations/:id/balance', `${BASE}/organizations/${ORG_ID}/balance`);
const wallet  = await check('GET /wallets/me',                `${BASE}/wallets/me`);
const tmpls   = await check('GET /templates',                 `${BASE}/templates?limit=5`);
const pubTmpl = await check('GET /public/templates',          `${BASE}/public/templates?limit=3`);

console.log('\n── Summary ───────────────────────────────────────────');
if (org)     console.log(`  Org:      ${org.fqdn ?? org.id}`);
if (balance) console.log(`  Balance:  ${balance.amount} DUAL`);
if (tmpls)   console.log(`  Templates in org: ${tmpls.templates?.length ?? 0}`);

const templateId = process.env.DUAL_SIGNAL_TEMPLATE_ID;
if (templateId) {
  console.log(`\n  Checking DUAL_SIGNAL_TEMPLATE_ID = ${templateId} ...`);
  await check('GET /templates/:templateId', `${BASE}/templates/${templateId}`);
} else {
  console.log('\n  DUAL_SIGNAL_TEMPLATE_ID not set — run setup.mjs first');
}

console.log('──────────────────────────────────────────────────────\n');
