import { db } from '@/lib/db';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API   = `https://api.telegram.org/bot${TOKEN}`;

if (!TOKEN) {
  console.error('[tg-bot] TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; };
    chat: { id: number; type: string; };
    date: number;
    text?: string;
  };
}

async function send(chatId: number, text: string) {
  await fetch(`${API}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text }),
  });
}

async function handleVerify(msg: NonNullable<TgUpdate['message']>) {
  const telegramUserId = String(msg.from!.id);
  const parts = (msg.text ?? '').trim().split(/\s+/);

  if (parts.length < 2) {
    await send(msg.chat.id,
      'Usage: /verify <your_telegram_handle>\n\nExample: /verify erik_nelson_7764\n\nUse the exact handle shown in your DUAL // SIGNAL profile.'
    );
    return;
  }

  const handle = parts[1].replace(/^@/, '');

  const account = await db.externalAccount.findFirst({
    where: { source: 'TELEGRAM', handle: { equals: handle, mode: 'insensitive' } },
  });

  if (!account) {
    await send(msg.chat.id,
      `❌ No SIGNAL account found with Telegram handle "${handle}".\n\nCheck your exact handle in the DUAL // SIGNAL dashboard and try again.`
    );
    return;
  }

  if (account.externalUserId === telegramUserId) {
    await send(msg.chat.id, '✅ Already verified! Your Telegram activity is being tracked on DUAL // SIGNAL.');
    return;
  }

  try {
    await db.externalAccount.update({
      where: { id: account.id },
      data:  { externalUserId: telegramUserId },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      await send(msg.chat.id,
        '⚠️ Your Telegram account is already linked to a different SIGNAL handle. Contact an admin if you need to change it.'
      );
      return;
    }
    throw err;
  }

  console.log(`[tg-bot] verified userId=${telegramUserId} as handle=${handle}`);
  await send(msg.chat.id, '✅ Verified! Your messages in the DUAL group will now earn you active-day credit on DUAL // SIGNAL.');
}

async function processUpdate(update: TgUpdate) {
  const msg = update.message;
  if (!msg?.from) return;

  const isPrivate = msg.chat.type === 'private';
  const text      = msg.text ?? '';

  if (isPrivate) {
    if (text.startsWith('/verify')) await handleVerify(msg);
    return;
  }

  // Group message — track active day
  const telegramUserId = String(msg.from.id);
  const day = new Date(msg.date * 1000);
  day.setUTCHours(0, 0, 0, 0);

  console.log(`[tg-bot] message from userId=${telegramUserId} in chat=${msg.chat.id}`);

  const account = await db.externalAccount.findFirst({
    where:  { source: 'TELEGRAM', externalUserId: telegramUserId },
    select: { user: { select: { badge: { select: { id: true } } } } },
  });

  const badgeId = account?.user?.badge?.id;
  if (!badgeId) return;

  await db.telegramActiveDay.upsert({
    where:  { badgeId_day: { badgeId, day } },
    create: { badgeId, day, telegramProviderUserId: telegramUserId, firstMessageId: String(msg.message_id) },
    update: {},
  });

  console.log(`[tg-bot] recorded active day for badge ${badgeId} on ${day.toISOString().slice(0, 10)}`);
}

async function poll() {
  let offset = 0;
  console.log('[tg-bot] starting poll loop…');

  while (true) {
    try {
      const res  = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30&allowed_updates=["message"]`);
      const json = await res.json() as { ok: boolean; result: TgUpdate[] };

      if (!json.ok) {
        console.error('[tg-bot] getUpdates error', json);
        await sleep(5000);
        continue;
      }

      for (const update of json.result) {
        try { await processUpdate(update); } catch (err) { console.error('[tg-bot] processUpdate error', err); }
        offset = update.update_id + 1;
      }
    } catch (err) {
      console.error('[tg-bot] poll error', err);
      await sleep(5000);
    }
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

poll().catch(console.error);
