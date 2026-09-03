/**
 * DUAL API client for DUAL // SIGNAL.
 *
 * Auth: uses X-Api-Key for reads, fetches a JWT for writes.
 * Base URL: https://api.dual.network (root-relative paths, no /v3/ prefix).
 * Never fire parallel write requests — DUAL uses per-account nonces.
 */

const BASE = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const API_KEY = process.env.DUAL_API_KEY ?? '';
const ORG_ID = process.env.DUAL_ORG_ID ?? '';

// ─── HTTP ─────────────────────────────────────────────────────────────────────

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: 'apiKey' | 'jwt';
};

let jwtToken: string | null = null;
let jwtFetchedAt = 0;
const JWT_TTL_MS = 55 * 60 * 1000; // refresh before 60-min expiry

async function getJwt(): Promise<string> {
  if (jwtToken && Date.now() - jwtFetchedAt < JWT_TTL_MS) return jwtToken;

  // Step 1: login with email/password → personal JWT
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.DUAL_EMAIL,
      password: process.env.DUAL_PASSWORD,
    }),
  });
  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`DUAL login failed ${loginRes.status}: ${body}`);
  }
  const loginData = await loginRes.json();
  const personalJwt = loginData.access_token as string;

  // Step 2: switch to org context → org-scoped JWT (required for write ops)
  const switchRes = await fetch(`${BASE}/organizations/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${personalJwt}` },
    body: JSON.stringify({ id: ORG_ID }),
  });
  if (!switchRes.ok) {
    const body = await switchRes.text();
    throw new Error(`DUAL org switch failed ${switchRes.status}: ${body}`);
  }
  const switchData = await switchRes.json();
  jwtToken = switchData.access_token as string;
  jwtFetchedAt = Date.now();
  return jwtToken;
}

async function dualRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = 'apiKey' } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth === 'jwt') {
    const token = await getJwt();
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['X-Api-Key'] = API_KEY;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DUAL API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type DualTemplate = {
  id: string;
  name: string;
  actions: Array<{ alias: string; name: string }>;
  factory: { max_supply: number; minted_count: number; start_time: string };
  object: { metadata: Record<string, string>; custom: Record<string, string> };
  when_created: string;
  when_modified: string;
};

export const templates = {
  get: (id: string) => dualRequest<DualTemplate>(`/templates/${id}`),
  list: (limit = 20) => dualRequest<{ templates: DualTemplate[] }>(`/templates?limit=${limit}`),
  create: (body: unknown) => dualRequest<DualTemplate>('/templates', { method: 'POST', body, auth: 'jwt' }),
};

// ─── Objects ──────────────────────────────────────────────────────────────────

export type DualObject = {
  id: string;
  template_id: string;
  owner: string;
  metadata: Record<string, string>;
  custom: Record<string, string>;
  content_hash: string;
  custom_hash: string;
  state_hash: string;
  integrity_hash: string;
  prev_integrity_hash: string;
  nonce: number;
  version: number;
  when_created: string;
  when_modified: string;
};

export const objects = {
  get: (id: string) => dualRequest<DualObject>(`/objects/${id}`),

  // PATCH /objects/:id — update custom properties
  // Serialized via the caller — never call in parallel.
  update: (id: string, custom: Record<string, string>, metadata?: Record<string, string>) =>
    dualRequest<DualObject>(`/objects/${id}`, {
      method: 'PATCH',
      body: { custom, ...(metadata ? { metadata } : {}) },
      auth: 'jwt',
    }),

  // Public read — no auth, includes integrity_hash for mutation detection
  getPublic: (id: string) => dualRequest<DualObject>(`/public/objects/${id}`, { auth: 'apiKey' }),
};

// ─── Event Bus (mint / transfer / burn) ───────────────────────────────────────

export type EbusResult = {
  action_id: string;
  steps: Array<{ output: { ids?: string[] } }>;
};

export const ebus = {
  execute: (action: unknown) =>
    dualRequest<EbusResult>('/ebus/execute', { method: 'POST', body: { action }, auth: 'jwt' }),

  mint: (templateId: string, custom: Record<string, string>, metadata?: Record<string, string>) =>
    ebus.execute({
      mint: {
        template_id: templateId,
        num: 1,
        data: {
          custom,
          ...(metadata ? { metadata } : {}),
        },
      },
    }),

  transfer: (objectId: string, toDualWalletId: string) =>
    ebus.execute({ transfer: { id: objectId, to: toDualWalletId } }),
};

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export const webhooks = {
  list: () => dualRequest<{ webhooks: unknown[] }>('/webhooks'),
  create: (url: string, templateId: string) =>
    dualRequest('/webhooks', {
      method: 'POST',
      body: { url, rules: [{ template_id: templateId }] },
      auth: 'jwt',
    }),
};

// ─── Organisation ─────────────────────────────────────────────────────────────

export const org = {
  get: () => dualRequest<{ id: string; fqdn: string }>(`/organizations/${ORG_ID}`),
  balance: () => dualRequest<{ amount: string }>(`/organizations/${ORG_ID}/balance`),
};
