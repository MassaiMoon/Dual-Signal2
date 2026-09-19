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
  };
}

async function processUpdate(update: TgUpdate) {
  const msg = update.message;
  if (!msg?.from || msg.chat.type === 'private') return;

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
        await processUpdate(update);
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
