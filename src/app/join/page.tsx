/**
 * /join — resolves the session on the server so the client flow starts on the
 * right step immediately (no "Loading…" state on first paint).
 *
 *   no session          → email step
 *   session + Passport  → redirect to /me
 *   session, no Passport → username step
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionByToken, SESSION_COOKIE } from '@/lib/auth';
import JoinFlow from './JoinFlow';

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const jar     = await cookies();
  const session = await getSessionByToken(jar.get(SESSION_COOKIE)?.value).catch(() => null);

  if (session?.memberAuth.user?.badge) redirect('/me');

  return <JoinFlow initialStep={session ? 'username' : 'email'} />;
}
