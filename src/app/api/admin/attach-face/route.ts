/**
 * POST /api/admin/attach-face
 *
 * Creates a DUAL face and attaches it to the SIGNAL template.
 * The face iframes our live badge renderer for every object.
 * Protected by ADMIN_TOKEN bearer auth.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE    = (process.env.DUAL_API_BASE ?? 'https://api.dual.network').replace(/\/$/, '');
const ORG_ID  = process.env.DUAL_ORG_ID ?? '';
const TMPL_ID = process.env.DUAL_SIGNAL_TEMPLATE_ID ?? '';

const FACE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #001A27; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
  </style>
</head>
<body>
  <iframe src="https://dualsignal.org/faces/badge?id={{ .id }}" frameborder="0" scrolling="no"></iframe>
</body>
</html>`;

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
  if (!TMPL_ID) return NextResponse.json({ error: 'DUAL_SIGNAL_TEMPLATE_ID not set' }, { status: 500 });

  const jwt = await getJwt();
  const auth = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

  // Step 1: create face
  const faceBody = {
    name:     'DUAL // SIGNAL Badge Face',
    renderer: 'go-template',
    views: [
      { variant: 'card',   media_type: 'text/html', content: FACE_HTML },
      { variant: 'detail', media_type: 'text/html', content: FACE_HTML },
    ],
  };

  const faceRes = await fetch(`${BASE}/faces`, { method: 'POST', headers: auth, body: JSON.stringify(faceBody) });
  const faceText = await faceRes.text();
  if (!faceRes.ok) {
    return NextResponse.json({ step: 'create-face', status: faceRes.status, body: faceText }, { status: 502 });
  }
  const face = JSON.parse(faceText);

  // Step 2: attach face to template
  const patchRes = await fetch(`${BASE}/templates/${TMPL_ID}`, {
    method:  'PATCH',
    headers: auth,
    body:    JSON.stringify({ face_id: face.id }),
  });
  const patchText = await patchRes.text();
  if (!patchRes.ok) {
    return NextResponse.json({ step: 'attach-face', faceId: face.id, status: patchRes.status, body: patchText }, { status: 502 });
  }

  return NextResponse.json({ ok: true, faceId: face.id, template: TMPL_ID });
}
