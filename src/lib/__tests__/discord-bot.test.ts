import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  normalizeHandle,
  findBadgeByDiscordHandle,
  processDiscordMessage,
  type MessageEvent,
} from '../../../discord-bot/handler';

// Mock discord-recalculate so tests never hit the real DB or compute scores
vi.mock('../discord-recalculate', () => ({
  recalculateDiscordForBadge: vi.fn().mockResolvedValue({}),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBadge(id = 'badge-1') {
  return { id };
}

function makeDb(overrides: Partial<{
  badgeFindFirst: ReturnType<typeof vi.fn>;
  discordDayFindUnique: ReturnType<typeof vi.fn>;
  discordDayCreate: ReturnType<typeof vi.fn>;
}> = {}): PrismaClient {
  return {
    badge: {
      findFirst: overrides.badgeFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    discordActiveDay: {
      findUnique: overrides.discordDayFindUnique ?? vi.fn().mockResolvedValue(null),
      create:     overrides.discordDayCreate    ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

function makeEvent(overrides: Partial<MessageEvent> = {}): MessageEvent {
  return {
    authorBot:       false,
    authorWebhookId: null,
    authorUsername:  'alice',
    guildId:         'guild-123',
    channelId:       'chan-456',
    ...overrides,
  };
}

// ── normalizeHandle ───────────────────────────────────────────────────────────

describe('normalizeHandle', () => {
  it('lowercases the handle', () => {
    expect(normalizeHandle('Alice')).toBe('alice');
  });

  it('trims whitespace', () => {
    expect(normalizeHandle('  bob  ')).toBe('bob');
  });

  it('lowercases and trims combined', () => {
    expect(normalizeHandle('  CoolUser123  ')).toBe('cooluser123');
  });
});

// ── findBadgeByDiscordHandle ──────────────────────────────────────────────────

describe('findBadgeByDiscordHandle', () => {
  it('returns null when no badge matches', async () => {
    const db = makeDb();
    const result = await findBadgeByDiscordHandle(db, 'unknown');
    expect(result).toBeNull();
  });

  it('returns the badge when discordHandle matches (case-normalised)', async () => {
    const badge = makeBadge();
    const db = makeDb({ badgeFindFirst: vi.fn().mockResolvedValue(badge) });
    const result = await findBadgeByDiscordHandle(db, 'Alice');
    expect(result).toEqual(badge);
    expect((db.badge.findFirst as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { discordHandle: 'alice' } }),
    );
  });
});

// ── processDiscordMessage ─────────────────────────────────────────────────────

describe('processDiscordMessage — skip conditions', () => {
  it('skips bot messages', async () => {
    const db = makeDb();
    const result = await processDiscordMessage(db, makeEvent({ authorBot: true }));
    expect(result).toEqual({ skipped: true, reason: 'bot' });
  });

  it('skips webhook messages', async () => {
    const db = makeDb();
    const result = await processDiscordMessage(db, makeEvent({ authorWebhookId: 'wh-1' }));
    expect(result).toEqual({ skipped: true, reason: 'webhook' });
  });

  it('skips DMs (no guildId)', async () => {
    const db = makeDb();
    const result = await processDiscordMessage(db, makeEvent({ guildId: null }));
    expect(result).toEqual({ skipped: true, reason: 'dm' });
  });

  it('skips when no badge matches the author handle', async () => {
    const db = makeDb({ badgeFindFirst: vi.fn().mockResolvedValue(null) });
    const result = await processDiscordMessage(db, makeEvent());
    expect(result).toEqual({ skipped: true, reason: 'no_badge' });
  });
});

describe('processDiscordMessage — recording active days', () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = makeDb({
      badgeFindFirst:      vi.fn().mockResolvedValue(makeBadge()),
      discordDayFindUnique: vi.fn().mockResolvedValue(null),   // day not yet recorded
      discordDayCreate:     vi.fn().mockResolvedValue({}),
    });
  });

  it('creates a new active day on the first message of the day', async () => {
    const result = await processDiscordMessage(db, makeEvent());
    expect(result).toMatchObject({ skipped: false, created: true });
    expect((db.discordActiveDay.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });

  it('does not duplicate an active day already recorded today', async () => {
    // findUnique returns an existing row
    (db.discordActiveDay.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' });

    const result = await processDiscordMessage(db, makeEvent());
    expect(result).toMatchObject({ skipped: false, created: false });
    expect((db.discordActiveDay.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('normalises username before matching', async () => {
    await processDiscordMessage(db, makeEvent({ authorUsername: 'ALICE' }));
    expect((db.badge.findFirst as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { discordHandle: 'alice' } }),
    );
  });

  it('does not process messages from bots even if a badge matches', async () => {
    const result = await processDiscordMessage(db, makeEvent({ authorBot: true }));
    expect(result.skipped).toBe(true);
    expect((db.discordActiveDay.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
