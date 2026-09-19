import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 ambiguity
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.memberAuth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.memberAuth.user.id;

  // Delete any existing codes for this user
  await db.telegramVerifyCode.deleteMany({ where: { userId } });

  const code      = generateCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await db.telegramVerifyCode.create({ data: { code, userId, expiresAt } });

  return NextResponse.json({ code });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.memberAuth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await db.telegramVerifyCode.deleteMany({ where: { userId: session.memberAuth.user.id } });
  return NextResponse.json({ ok: true });
}
