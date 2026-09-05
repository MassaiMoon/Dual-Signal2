import { describe, it, expect } from 'vitest';
import {
  parseTelegramExport,
  validateExportShape,
  isQualifyingMessage,
  toUtcDate,
} from '../telegram-parser';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeMsg(overrides: Record<string, unknown> = {}) {
  return {
    id:            1,
    type:          'message',
    date:          '2026-09-01T10:00:00',
    date_unixtime: '1756728000',
    from:          'Alice',
    from_id:       'user111',
    text:          'Hello',
    ...overrides,
  };
}

function makeExport(messages: unknown[]) {
  return { name: 'Test Chat', type: 'public_supergroup', id: 999, messages };
}

// ─── validateExportShape ──────────────────────────────────────────────────────

describe('validateExportShape', () => {
  it('accepts a valid export shape', () => {
    expect(validateExportShape({ messages: [] })).toBeNull();
  });

  it('rejects null', () => {
    expect(validateExportShape(null)).not.toBeNull();
  });

  it('rejects arrays', () => {
    expect(validateExportShape([])).not.toBeNull();
  });

  it('rejects object without messages', () => {
    expect(validateExportShape({ name: 'chat' })).not.toBeNull();
  });

  it('rejects messages as non-array', () => {
    expect(validateExportShape({ messages: 'oops' })).not.toBeNull();
  });
});

// ─── isQualifyingMessage ──────────────────────────────────────────────────────

describe('isQualifyingMessage', () => {
  it('accepts a normal user message', () => {
    expect(isQualifyingMessage(makeMsg() as never)).toBe(true);
  });

  it('rejects service messages (join/leave/pin)', () => {
    expect(isQualifyingMessage(makeMsg({ type: 'service', action: 'join_group_by_link' }) as never)).toBe(false);
  });

  it('rejects messages without from_id', () => {
    expect(isQualifyingMessage(makeMsg({ from_id: undefined }) as never)).toBe(false);
  });

  it('rejects messages with empty from_id', () => {
    expect(isQualifyingMessage(makeMsg({ from_id: '' }) as never)).toBe(false);
  });

  it('rejects channel/bot IDs that do not start with "user"', () => {
    expect(isQualifyingMessage(makeMsg({ from_id: 'channel123' }) as never)).toBe(false);
    expect(isQualifyingMessage(makeMsg({ from_id: 'bot123' }) as never)).toBe(false);
  });

  it('accepts sticker or media-only messages (V1: presence counts)', () => {
    expect(isQualifyingMessage(makeMsg({ text: '' }) as never)).toBe(true);
  });
});

// ─── toUtcDate ────────────────────────────────────────────────────────────────

describe('toUtcDate', () => {
  it('uses date_unixtime when available', () => {
    // 1756728000 = 2026-09-01T10:40:00Z
    const msg = makeMsg({ date_unixtime: '1756728000', date: '2099-01-01T00:00:00' });
    const result = toUtcDate(msg as never);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Must not use the bogus date field
    expect(result).not.toBe('2099-01-01');
  });

  it('falls back to date field treated as UTC when no date_unixtime', () => {
    const msg = makeMsg({ date_unixtime: undefined, date: '2026-09-05T00:00:00' });
    expect(toUtcDate(msg as never)).toBe('2026-09-05');
  });

  it('two UTC timestamps on same calendar day → same date string', () => {
    const m1 = makeMsg({ date_unixtime: '1756728000' }); // some time on 2026-09-01 UTC
    const m2 = makeMsg({ date_unixtime: '1756728001' }); // one second later
    expect(toUtcDate(m1 as never)).toBe(toUtcDate(m2 as never));
  });
});

// ─── parseTelegramExport: active-day deduplication ───────────────────────────

describe('parseTelegramExport — active day deduplication', () => {
  it('5 messages same day from same user → 1 active day', () => {
    const messages = Array.from({ length: 5 }, (_, i) =>
      makeMsg({ id: i, from_id: 'user111', date_unixtime: String(1756728000 + i) }),
    );
    const result = parseTelegramExport(makeExport(messages));
    const user   = result.identities.find(id => id.telegramUserId === 'user111')!;
    expect(user.activeDates).toHaveLength(1);
    expect(user.messageCount).toBe(5);
  });

  it('messages across 4 different UTC days → 4 active days', () => {
    // each 86400 apart (one day)
    const messages = [0, 1, 2, 3].map((offset, i) =>
      makeMsg({ id: i, from_id: 'user222', date_unixtime: String(1756728000 + offset * 86400) }),
    );
    const result = parseTelegramExport(makeExport(messages));
    const user   = result.identities.find(id => id.telegramUserId === 'user222')!;
    expect(user.activeDates).toHaveLength(4);
  });

  it('two different users same day → each gets 1 active day independently', () => {
    const messages = [
      makeMsg({ id: 1, from_id: 'user111', date_unixtime: '1756728000' }),
      makeMsg({ id: 2, from_id: 'user222', date_unixtime: '1756728100' }),
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.identities).toHaveLength(2);
    for (const identity of result.identities) {
      expect(identity.activeDates).toHaveLength(1);
    }
  });
});

// ─── parseTelegramExport: service message filtering ──────────────────────────

describe('parseTelegramExport — service message filtering', () => {
  it('join/leave service messages are not counted', () => {
    const messages = [
      makeMsg({ id: 1, from_id: 'user111', date_unixtime: '1756728000' }),
      { id: 2, type: 'service', date: '2026-09-01T10:01:00', date_unixtime: '1756728060',
        actor: 'Bob', actor_id: 'user222', action: 'join_group_by_link' },
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.identities).toHaveLength(1);
    expect(result.identities[0].telegramUserId).toBe('user111');
  });

  it('qualifyingMessages count excludes service messages', () => {
    const messages = [
      makeMsg({ id: 1, from_id: 'user111', date_unixtime: '1756728000' }),
      { id: 2, type: 'service', date: '2026-09-01T10:01:00', date_unixtime: '1756728060',
        actor: 'User', actor_id: 'user333', action: 'pin_message' },
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.totalMessages).toBe(2);
    expect(result.qualifyingMessages).toBe(1);
  });
});

// ─── parseTelegramExport: username change safety ──────────────────────────────

describe('parseTelegramExport — same from_id, different display names', () => {
  it('same from_id with different display names → treated as one user identity', () => {
    const messages = [
      makeMsg({ id: 1, from_id: 'user111', from: 'Alice',      date_unixtime: '1756728000' }),
      makeMsg({ id: 2, from_id: 'user111', from: 'Alice Smith', date_unixtime: '1756814400' }), // next day
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.identities).toHaveLength(1);
    expect(result.identities[0].activeDates).toHaveLength(2);
  });

  it('same handle, two different from_ids → treated as two separate identities', () => {
    const messages = [
      makeMsg({ id: 1, from_id: 'user111', from: 'Alice', date_unixtime: '1756728000' }),
      makeMsg({ id: 2, from_id: 'user999', from: 'Alice', date_unixtime: '1756728100' }),
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.identities).toHaveLength(2);
  });
});

// ─── parseTelegramExport: OG detection ───────────────────────────────────────

describe('parseTelegramExport — OG evidence', () => {
  it('message before 2018-01-01 UTC flags user as potential OG', () => {
    // 2017-12-31T23:59:59Z = 1514764799
    const messages = [
      makeMsg({ id: 1, from_id: 'user111', date_unixtime: '1514764799' }),
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.identities[0].isPotentialOG).toBe(true);
  });

  it('message after OG cutoff is not flagged', () => {
    const messages = [
      makeMsg({ id: 1, from_id: 'user222', date_unixtime: '1756728000' }),
    ];
    const result = parseTelegramExport(makeExport(messages));
    expect(result.identities[0].isPotentialOG).toBe(false);
  });
});

// ─── parseTelegramExport: empty export ───────────────────────────────────────

describe('parseTelegramExport — edge cases', () => {
  it('empty messages array → no identities', () => {
    const result = parseTelegramExport(makeExport([]));
    expect(result.identities).toHaveLength(0);
    expect(result.totalMessages).toBe(0);
    expect(result.qualifyingMessages).toBe(0);
  });

  it('preserves chat name', () => {
    const result = parseTelegramExport({ name: 'DUAL Community', messages: [] });
    expect(result.chatName).toBe('DUAL Community');
  });

  it('throws on non-object input', () => {
    expect(() => parseTelegramExport('not an object')).toThrow();
    expect(() => parseTelegramExport(null)).toThrow();
    expect(() => parseTelegramExport([1, 2, 3])).toThrow();
  });
});

// ─── Telegram level thresholds (from scoring rules) ──────────────────────────

describe('Telegram level thresholds via parseTelegramExport day counts', () => {
  function makeNDayExport(n: number, userId = 'user111') {
    return makeExport(
      Array.from({ length: n }, (_, i) =>
        makeMsg({ id: i, from_id: userId, date_unixtime: String(1756728000 + i * 86400) }),
      ),
    );
  }

  it('1 active day qualifies for Level 1', () => {
    const result = parseTelegramExport(makeNDayExport(1));
    expect(result.identities[0].activeDates).toHaveLength(1);
  });

  it('7 active days qualifies for Level 2', () => {
    const result = parseTelegramExport(makeNDayExport(7));
    expect(result.identities[0].activeDates).toHaveLength(7);
  });

  it('30 active days qualifies for Level 3', () => {
    const result = parseTelegramExport(makeNDayExport(30));
    expect(result.identities[0].activeDates).toHaveLength(30);
  });
});
