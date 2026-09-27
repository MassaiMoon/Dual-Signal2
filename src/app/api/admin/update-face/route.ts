/**
 * POST /api/admin/update-face
 *
 * Updates the DUAL face content. Pass { faceId, html } in the body.
 * Used for iterating on the face template without creating new faces.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE   = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const ORG_ID = process.env.DUAL_ORG_ID ?? '';

async function getJwt(): Promise<string> {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: process.env.DUAL_EMAIL, password: process.env.DUAL_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
  const { access_token: personal } = await loginRes.json();

  const switchRes = await fetch(`${BASE}/organizations/switch`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${personal}` },
    body:    JSON.stringify({ id: ORG_ID }),
  });
  if (!switchRes.ok) throw new Error(`Org switch failed: ${await switchRes.text()}`);
  const { access_token } = await switchRes.json();
  return access_token;
}

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { faceId, html } = await req.json() as { faceId: string; html: string };
  if (!faceId || !html) return NextResponse.json({ error: 'faceId and html required' }, { status: 400 });

  const jwt = await getJwt();

  const res = await fetch(`${BASE}/faces/${faceId}`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      views: [
        { variant: 'card',   media_type: 'text/html', content: html },
        { variant: 'detail', media_type: 'text/html', content: html },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) return NextResponse.json({ status: res.status, body: text }, { status: 502 });
  return NextResponse.json({ ok: true, faceId });
}
