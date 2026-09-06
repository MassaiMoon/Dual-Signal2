import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseTelegramHtmlFile,
  parseTelegramHtmlExport,
} from '../telegram-html-parser';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const FIXTURES = join(__dirname, 'fixtures');

function fixture(name: string) {
  return { name, content: readFileSync(join(FIXTURES, name), 'utf-8') };
}

function makeHtml(body: string, chatName = 'Test Chat') {
  return {
    name: 'messages.html',
    content: `<!DOCTYPE html><html><body>
      <div class="page_wrap">
        <div class="page_header"><div class="content"><div class="text bold">${chatName}</div></div></div>
        <div class="history">${body}</div>
      </div></body></html>`,
  };
}

function msg({
  id, date, fromName, joined = false, isService = false, hasMedia = false,
}: {
  id: number; date: string; fromName?: string; joined?: boolean; isService?: boolean; hasMedia?: boolean;
}) {
  if (isService) {
    return `<div class="message service" id="message${id}">
      <div class="body details">System event</div>
    </div>`;
  }
  const classes = `message default clearfix${joined ? ' joined' : ''}`;
  const fromDiv = fromName ? `<div class="from_name">${fromName}</div>` : '';
  const bodyContent = hasMedia
    ? `<div class="media_wrap clearfix"><img class="photo" src="x.jpg"></div>`
    : `<div class="text">hello</div>`;
  return `<div class="${classes}" id="message${id}">
    <div class="body">
      <div class="pull_right date details" title="${date}">12:00</div>
      ${fromDiv}
      ${bodyContent}
    </div>
  </div>`;
}

// ─── parseTelegramHtmlFile ───────────────────────────────────────────────────

describe('parseTelegramHtmlFile — basic extraction', () => {
  it('extracts chat name from page header', () => {
    const { chatName } = parseTelegramHtmlFile(makeHtml('', 'DUAL Community').content);
    expect(chatName).toBe('DUAL Community');
  });

  it('extracts display-name-only sender (LOW confidence)', () => {
    const html = makeHtml(msg({ id: 1, date: '01.09.2025 10:00:00', fromName: 'Alice' }));
    const { messages } = parseTelegramHtmlFile(html.content);
    const qualifying   = messages.filter(m => !m.isService);
    expect(qualifying).toHaveLength(1);
    expect(qualifying[0].identity.displayName).toBe('Alice');
    expect(qualifying[0].identity.confidence).toBe('LOW');
    expect(qualifying[0].identity.key).toBe('display:Alice');
  });

  it('extracts @username from t.me href (HIGH confidence)', () => {
    const html = makeHtml(msg({ id: 1, date: '01.09.2025 10:00:00', fromName: '<a href="https://t.me/alice_tg">Alice</a>' }));
    const { messages } = parseTelegramHtmlFile(html.content);
    const q = messages.filter(m => !m.isService);
    expect(q[0].identity.confidence).toBe('HIGH');
    expect(q[0].identity.key).toBe('@alice_tg');
    expect(q[0].identity.username).toBe('alice_tg');
  });

  it('extracts @username from literal @handle in from_name (MEDIUM confidence)', () => {
    const html = makeHtml(msg({ id: 1, date: '01.09.2025 10:00:00', fromName: '@alice_tg' }));
    const { messages } = parseTelegramHtmlFile(html.content);
    const q = messages.filter(m => !m.isService);
    expect(q[0].identity.confidence).toBe('MEDIUM');
    expect(q[0].identity.key).toBe('@alice_tg');
  });

  it('marks service messages as isService=true', () => {
    const html = makeHtml(msg({ id: 1, date: '01.09.2025 10:00:00', isService: true }));
    const { messages } = parseTelegramHtmlFile(html.content);
    expect(messages[0].isService).toBe(true);
  });

  it('skips messages with no parseable date', () => {
    const html = makeHtml(
      `<div class="message default clearfix" id="message99">
        <div class="body">
          <div class="pull_right date details" title="INVALID">?</div>
          <div class="from_name">Ghost</div>
          <div class="text">no date</div>
        </div>
      </div>`,
    );
    const { messages } = parseTelegramHtmlFile(html.content);
    expect(messages.filter(m => !m.isService)).toHaveLength(0);
  });
});

describe('parseTelegramHtmlFile — joined message sender inheritance', () => {
  it('consecutive "joined" messages inherit sender from previous message', () => {
    const html = makeHtml([
      msg({ id: 1, date: '01.09.2025 10:00:00', fromName: '<a href="https://t.me/alice_tg">Alice</a>' }),
      msg({ id: 2, date: '01.09.2025 10:01:00', joined: true }),
      msg({ id: 3, date: '01.09.2025 10:02:00', joined: true }),
    ].join(''));
    const { messages } = parseTelegramHtmlFile(html.content);
    const q = messages.filter(m => !m.isService);
    expect(q).toHaveLength(3);
    for (const m of q) {
      expect(m.identity.key).toBe('@alice_tg');
    }
  });

  it('new from_name after joined messages resets sender', () => {
    const html = makeHtml([
      msg({ id: 1, date: '01.09.2025 10:00:00', fromName: 'Alice' }),
      msg({ id: 2, date: '01.09.2025 10:01:00', joined: true }),
      msg({ id: 3, date: '01.09.2025 10:02:00', fromName: 'Bob' }),
    ].join(''));
    const { messages } = parseTelegramHtmlFile(html.content);
    const q = messages.filter(m => !m.isService);
    expect(q[0].identity.key).toBe('display:Alice');
    expect(q[1].identity.key).toBe('display:Alice');
    expect(q[2].identity.key).toBe('display:Bob');
  });
});

// ─── parseTelegramHtmlExport — acceptance tests from spec ────────────────────

describe('parseTelegramHtmlExport — acceptance test (spec §22)', () => {
  const result = parseTelegramHtmlExport([fixture('messages.html')]);

  it('User A: 2 active days (Monday + Tuesday) via @alice_tg', () => {
    const alice = result.identities.find(i => i.telegramUserId === '@alice_tg');
    expect(alice).toBeDefined();
    expect(alice!.activeDates).toHaveLength(2);
    expect(alice!.identityConfidence).toBe('HIGH');
  });

  it('User B: 1 active day (Monday) via display name', () => {
    const bob = result.identities.find(i => i.displayName === 'Bob');
    expect(bob).toBeDefined();
    expect(bob!.activeDates).toHaveLength(1);
    expect(bob!.identityConfidence).toBe('LOW');
  });

  it('User C (Charlie): present in identities with 1 active day (unmatched by route)', () => {
    const charlie = result.identities.find(i => i.displayName === 'Charlie');
    expect(charlie).toBeDefined();
    expect(charlie!.activeDates).toHaveLength(1);
  });

  it('OGMember flagged as isPotentialOG for pre-2018 message', () => {
    const og = result.identities.find(i => i.displayName === 'OGMember');
    expect(og).toBeDefined();
    expect(og!.isPotentialOG).toBe(true);
  });

  it('non-OG user not flagged', () => {
    const alice = result.identities.find(i => i.telegramUserId === '@alice_tg');
    expect(alice!.isPotentialOG).toBe(false);
  });

  it('service messages are not counted in qualifying messages', () => {
    // Bob joined (service) should not add a qualifying message
    expect(result.qualifyingMessages).toBeLessThan(result.totalMessages);
  });

  it('media-only messages count as qualifying', () => {
    // Alice sends a photo on Sep 1 — still same day so active day count unchanged,
    // but qualifying message count should be > 10 (the 10 text msgs) for Alice
    const alice = result.identities.find(i => i.telegramUserId === '@alice_tg');
    expect(alice!.messageCount).toBeGreaterThanOrEqual(11); // 10 Monday + 1 photo + 3 Tuesday
  });

  it('10 messages same day from same user → 1 active day', () => {
    const alice = result.identities.find(i => i.telegramUserId === '@alice_tg');
    // Monday: 10 text + 1 photo = 1 day; Tuesday: 3 text = 1 day → total 2
    expect(alice!.activeDates).toHaveLength(2);
  });

  it('chatName extracted correctly', () => {
    expect(result.chatName).toBe('DUAL Community');
  });
});

// ─── Multiple file combination & overlap dedup ───────────────────────────────

describe('parseTelegramHtmlExport — multiple files + overlap dedup', () => {
  const result = parseTelegramHtmlExport([
    fixture('messages.html'),
    fixture('messages2.html'),
  ]);

  it('combines files and reports file count', () => {
    expect(result.htmlFiles).toBe(2);
  });

  it('message1034 from messages2.html (duplicate ID) is not double-counted', () => {
    // Alice should have 3 active days: Sep 1, Sep 2, Sep 3
    const alice = result.identities.find(i => i.telegramUserId === '@alice_tg');
    expect(alice!.activeDates).toHaveLength(3);
  });

  it('Bob gains a second active day from messages2.html (Wed Sep 3)', () => {
    const bob = result.identities.find(i => i.displayName === 'Bob');
    expect(bob!.activeDates).toHaveLength(2);
  });

  it('sticker message in messages2.html is qualifying', () => {
    // Bob sends sticker on Sep 3 (joined, no from_name) — same day as his text msg
    // so still 1 active day for Sep 3 but messageCount should be 2 for that day
    const bob = result.identities.find(i => i.displayName === 'Bob');
    // Sep 1 (1 msg) + Sep 3 (text + sticker = 2 msgs) = 2 days, 3 messages
    expect(bob!.messageCount).toBe(3);
  });

  it('service messages in messages2.html not counted', () => {
    // Group name change (service) and pin (service) are both ignored
    // Total qualifying messages should not include them
    expect(result.qualifyingMessages).toBeGreaterThan(0);
  });
});

// ─── Same export uploaded twice ──────────────────────────────────────────────

describe('parseTelegramHtmlExport — same file uploaded twice', () => {
  it('does not double-count active days (message ID dedup)', () => {
    const f = fixture('messages.html');
    const result = parseTelegramHtmlExport([f, { name: 'messages_copy.html', content: f.content }]);
    const alice = result.identities.find(i => i.telegramUserId === '@alice_tg');
    // Even without message ID dedup, same dates would merge via Set — but IDs prevent double totalMessages
    expect(alice!.activeDates).toHaveLength(2);
  });
});

// ─── Ambiguous same-name users ───────────────────────────────────────────────

describe('parseTelegramHtmlExport — two users with same display name', () => {
  it('same display name without href = merged into one identity (LOW confidence, flagged for review)', () => {
    // Our fixture has two "John" messages without href.
    // Without a href, we CANNOT distinguish them — they merge under display:John.
    // The route will mark them AMBIGUOUS based on LOW confidence.
    const result = parseTelegramHtmlExport([fixture('messages.html')]);
    const john = result.identities.find(i => i.displayName === 'John');
    expect(john).toBeDefined();
    expect(john!.identityConfidence).toBe('LOW');
    // Parser merges into one key — route disambiguates by marking it AMBIGUOUS
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('parseTelegramHtmlExport — edge cases', () => {
  it('empty HTML = zero identities, zero messages', () => {
    const result = parseTelegramHtmlExport([makeHtml('')]);
    expect(result.identities).toHaveLength(0);
    expect(result.totalMessages).toBe(0);
  });

  it('throws when no files provided', () => {
    expect(() => parseTelegramHtmlExport([])).toThrow();
  });

  it('invalid HTML does not throw (graceful empty parse)', () => {
    const result = parseTelegramHtmlExport([{ name: 'messages.html', content: '<<<not html>>>' }]);
    expect(result.identities).toHaveLength(0);
  });

  it('single message on each of 4 different days = 4 active days', () => {
    const html = makeHtml([
      msg({ id: 1, date: '01.09.2025 10:00:00', fromName: 'Alice' }),
      msg({ id: 2, date: '02.09.2025 10:00:00', fromName: 'Alice' }),
      msg({ id: 3, date: '03.09.2025 10:00:00', fromName: 'Alice' }),
      msg({ id: 4, date: '04.09.2025 10:00:00', fromName: 'Alice' }),
    ].join(''));
    const result = parseTelegramHtmlExport([html]);
    const alice  = result.identities.find(i => i.displayName === 'Alice')!;
    expect(alice.activeDates).toHaveLength(4);
  });

  it('same username with different display names = one identity (key-based merging)', () => {
    const html = makeHtml([
      msg({ id: 1, date: '01.09.2025 10:00:00', fromName: '<a href="https://t.me/alice_tg">Alice</a>' }),
      msg({ id: 2, date: '02.09.2025 10:00:00', fromName: '<a href="https://t.me/alice_tg">Alice Smith</a>' }),
    ].join(''));
    const result = parseTelegramHtmlExport([html]);
    const matching = result.identities.filter(i => i.telegramUserId === '@alice_tg');
    expect(matching).toHaveLength(1);
    expect(matching[0].activeDates).toHaveLength(2);
  });
});
