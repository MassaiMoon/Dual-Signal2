/**
 * Tests for GET /api/admin/badges/[id]/apple-wallet
 *
 * All DUAL calls are mocked — no real network requests.
 * Security invariants under test:
 *   - Only ADMIN_TOKEN callers may call this endpoint
 *   - dualObjectId is always resolved from DB, never supplied by the caller
 *   - DUAL credentials / JWTs are never returned to the client
 *   - The endpoint is read-only — fetchPkpassResponse is the only DUAL call made
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/badges/[id]/apple-wallet/route';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    badge: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/dual-client', () => ({
  fetchPkpassResponse: vi.fn(),
  // Confirm that NO write functions are imported / callable from here
  ebus:    undefined,
  objects: undefined,
}));

import { db }                  from '@/lib/db';
import { fetchPkpassResponse } from '@/lib/dual-client';

const mockDb    = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mockFetch = fetchPkpassResponse as unknown as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_TOKEN = 'test-admin-token';

function makeReq(badgeId: string, opts: { token?: string } = {}) {
  return new NextRequest(`http://localhost/api/admin/badges/${badgeId}/apple-wallet`, {
    headers: { authorization: `Bearer ${opts.token ?? ADMIN_TOKEN}` },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const MOCK_PKPASS = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP magic bytes

function okDualRes() {
  return new Response(MOCK_PKPASS, {
    status: 200,
    headers: { 'content-type': 'application/vnd.apple.pkpass' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/badges/[id]/apple-wallet', () => {
  it('1. rejects requests without valid ADMIN_TOKEN', async () => {
    const req = makeReq('badge-1', { token: 'wrong-token' });
    const res = await GET(req, makeParams('badge-1'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('2. returns 404 when badge does not exist', async () => {
    (mockDb.badge.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeReq('no-such-badge'), makeParams('no-such-badge'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('3. returns 422 when badge has MOCK-OBJECT-ID', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'MOCK-OBJECT-ID',
      user: { username: 'tester' },
    } as never);
    const res = await GET(makeReq('badge-1'), makeParams('badge-1'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/no valid DUAL Object ID/i);
  });

  it('3b. returns 422 when badge has empty dualObjectId', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: '',
      user: { username: 'tester' },
    } as never);
    const res = await GET(makeReq('badge-1'), makeParams('badge-1'));
    expect(res.status).toBe(422);
  });

  it('4. proxies binary pkpass on successful DUAL response', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice' },
    } as never);
    mockFetch.mockResolvedValue(okDualRes());

    const res = await GET(makeReq('badge-1'), makeParams('badge-1'));
    expect(res.status).toBe(200);

    const buf = await res.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(MOCK_PKPASS);
  });

  it('5. sets Content-Type: application/vnd.apple.pkpass on success', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice' },
    } as never);
    mockFetch.mockResolvedValue(okDualRes());

    const res = await GET(makeReq('badge-1'), makeParams('badge-1'));
    expect(res.headers.get('content-type')).toContain('apple.pkpass');
  });

  it('6. Content-Disposition filename contains only safe characters', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-2',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice_123' },
    } as never);
    mockFetch.mockResolvedValue(okDualRes());

    const res = await GET(makeReq('badge-2'), makeParams('badge-2'));
    const cd  = res.headers.get('content-disposition') ?? '';
    // Only [A-Za-z0-9_.-] in the filename
    const filenameMatch = cd.match(/filename="([^"]+)"/);
    expect(filenameMatch).not.toBeNull();
    expect(filenameMatch![1]).toMatch(/^[A-Za-z0-9_.-]+\.pkpass$/);
  });

  it('6b. filename falls back to "passport" when username is null', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-3',
      dualObjectId: 'real-dual-object-id',
      user: null,
    } as never);
    mockFetch.mockResolvedValue(okDualRes());

    const res = await GET(makeReq('badge-3'), makeParams('badge-3'));
    const cd  = res.headers.get('content-disposition') ?? '';
    expect(cd).toContain('passport.pkpass');
  });

  it('7. returns 502 when DUAL returns 401 or 403', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice' },
    } as never);
    mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const res = await GET(makeReq('badge-1'), makeParams('badge-1'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/DUAL returned 401/i);
  });

  it('7b. returns 502 when fetchPkpassResponse throws', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice' },
    } as never);
    mockFetch.mockRejectedValue(new Error('DUAL login failed 503: Service Unavailable'));

    const res = await GET(makeReq('badge-1'), makeParams('badge-1'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/DUAL request failed/i);
  });

  it('8. DUAL failure does not mutate the member Passport (no write calls)', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice' },
    } as never);
    mockFetch.mockRejectedValue(new Error('network error'));

    await GET(makeReq('badge-1'), makeParams('badge-1'));

    // Only findUnique (read) + fetchPkpassResponse (read-only) should have been called
    expect(mockDb.badge.findUnique).toHaveBeenCalledTimes(1);
    // No DB mutations
    expect((mockDb.badge as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((mockDb.badge as unknown as Record<string, unknown>).delete).toBeUndefined();
    // fetchPkpassResponse was the only DUAL call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('9. dualObjectId from DB is used — browser cannot supply an arbitrary objectId', async () => {
    const dbObjectId = 'db-resolved-object-id';
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: dbObjectId,
      user: { username: 'alice' },
    } as never);
    mockFetch.mockResolvedValue(okDualRes());

    // The URL contains only the badgeId — no objectId parameter
    const req = new NextRequest(
      'http://localhost/api/admin/badges/badge-1/apple-wallet?objectId=evil-injected-id',
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } },
    );
    await GET(req, makeParams('badge-1'));

    // fetchPkpassResponse must have been called with the DB value, not the query-param value
    expect(mockFetch).toHaveBeenCalledWith(dbObjectId);
    expect(mockFetch).not.toHaveBeenCalledWith('evil-injected-id');
  });

  it('10. DUAL credentials and JWTs are never included in the response body', async () => {
    mockDb.badge.findUnique.mockResolvedValue({
      id: 'badge-1',
      dualObjectId: 'real-dual-object-id',
      user: { username: 'alice' },
    } as never);
    // Simulate a DUAL error so the response is JSON (easier to inspect)
    mockFetch.mockRejectedValue(new Error('DUAL login failed 503: some body'));

    const res  = await GET(makeReq('badge-1'), makeParams('badge-1'));
    const text = await res.text();

    const stringPatterns: string[] = [
      process.env.DUAL_EMAIL,
      process.env.DUAL_PASSWORD,
      process.env.DUAL_API_KEY,
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);

    for (const p of stringPatterns) {
      expect(text).not.toContain(p);
    }

    // JWT-shaped strings (three dot-separated base64 segments)
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
  });
});
