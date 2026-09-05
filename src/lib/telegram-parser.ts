/**
 * Telegram Export Parser
 *
 * Pure functions — no database calls. Parses a Telegram Desktop JSON export
 * (result.json) and extracts the evidence needed for Telegram Signal scoring.
 *
 * Supported format: Telegram Desktop JSON export
 *   Admin: Settings → Advanced → Export Telegram data → JSON format
 *
 * Key rules (UTC calendar day is the canonical unit):
 *   - One or more qualifying messages on the same UTC calendar day = 1 active day
 *   - Service messages (join/leave/pin/etc.) are NOT qualifying
 *   - Identity = immutable from_id ("user123456789"), NOT the display username
 *   - date_unixtime (Unix timestamp) is used for date; falls back to date field
 *   - OG evidence: any message before 2018-01-01T00:00:00Z flags the identity
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** A raw message object as it appears in result.json */
interface TelegramMsg {
  id:             number | string;
  type:           string;         // "message" | "service"
  date:           string;         // "2026-09-05T14:30:00" (local time of exporter)
  date_unixtime?: string;         // Unix epoch seconds as string — preferred for UTC
  from?:          string;         // Display name (mutable)
  from_id?:       string;         // "user123456789" — IMMUTABLE Telegram user ID
  text?:          unknown;        // string | array of entities
  // Service-message fields (ignored for scoring)
  actor?:         string;
  actor_id?:      string;
  action?:        string;
}

/** A qualifying message extracted from the export */
export interface QualifyingMessage {
  messageId:     string;
  telegramUserId: string;    // from from_id, e.g. "user123456789"
  displayName:   string;     // from 'from' field (mutable, for display only)
  dateUtc:       string;     // "YYYY-MM-DD" in UTC
  rawTimestamp:  number;     // Unix epoch seconds
}

/** Per-user aggregate derived from the parsed export */
export interface TelegramIdentityAggregate {
  telegramUserId: string;
  displayName:    string;           // last observed display name
  activeDates:    string[];         // sorted unique "YYYY-MM-DD" strings (UTC)
  messageCount:   number;           // total qualifying message count
  firstSeenDate:  string;           // earliest active date
  lastSeenDate:   string;           // latest active date
  isPotentialOG:  boolean;          // any message before OG cutoff date
}

/** Result of parsing a complete Telegram export file */
export interface ParsedExport {
  chatName:     string;
  totalMessages: number;            // raw messages in the file
  qualifyingMessages: number;       // user-authored, non-service messages
  dateRange:    { min: string; max: string };  // UTC date range of qualifying messages
  identities:   TelegramIdentityAggregate[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Telegram user IDs that begin with this prefix in the export's from_id field
const USER_ID_PREFIX = 'user';

// Messages from before this UTC timestamp flag the sender as potential OG evidence
// Matches achievementConfig.ogCutoff
const OG_CUTOFF_TS = new Date('2018-01-01T00:00:00Z').getTime() / 1000;

// Maximum export file size we'll parse (15 MB)
export const MAX_EXPORT_BYTES = 15 * 1024 * 1024;

// ─── Date normalization ───────────────────────────────────────────────────────

/**
 * Convert a Telegram message's timestamp to a UTC calendar date string.
 * Prefers date_unixtime (always UTC) over the date field (local time).
 */
export function toUtcDate(msg: TelegramMsg): string {
  if (msg.date_unixtime) {
    const ts = parseInt(msg.date_unixtime, 10);
    if (!isNaN(ts) && ts > 0) {
      return new Date(ts * 1000).toISOString().slice(0, 10);
    }
  }
  // Fallback: append 'Z' if no timezone marker — treat as UTC
  const dateStr = /[+Z]/.test(msg.date) ? msg.date : msg.date + 'Z';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Unparseable date: ${msg.date}`);
  return d.toISOString().slice(0, 10);
}

function toUnixTs(msg: TelegramMsg): number {
  if (msg.date_unixtime) {
    const ts = parseInt(msg.date_unixtime, 10);
    if (!isNaN(ts)) return ts;
  }
  const dateStr = /[+Z]/.test(msg.date) ? msg.date : msg.date + 'Z';
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

// ─── Message qualification ────────────────────────────────────────────────────

/**
 * Returns true for genuine user-authored messages.
 * Filters out: service messages, missing sender, empty deleted messages.
 */
export function isQualifyingMessage(msg: TelegramMsg): boolean {
  if (msg.type !== 'message') return false;     // service, call, etc.
  if (!msg.from_id) return false;               // no sender identity
  if (!msg.from_id.startsWith(USER_ID_PREFIX)) return false; // bot/channel
  return true;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a Telegram Desktop JSON export object.
 * Throws on invalid structure.
 *
 * Date handling: all active days are normalized to UTC calendar dates.
 * Two messages on the same UTC date from the same user = 1 active day.
 */
export function parseTelegramExport(raw: unknown): ParsedExport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid Telegram export: expected a JSON object');
  }

  const obj = raw as Record<string, unknown>;
  const chatName = typeof obj['name'] === 'string' ? obj['name'] : 'Unknown Chat';

  const messages = obj['messages'];
  if (!Array.isArray(messages)) {
    throw new Error('Invalid Telegram export: "messages" array not found');
  }

  // Per-user aggregates: userId → { dates set, messageCount, displayName, timestamps }
  const byUser = new Map<string, {
    displayName:  string;
    dates:        Set<string>;
    messageCount: number;
    timestamps:   number[];
  }>();

  let totalMessages  = 0;
  let qualifyingCount = 0;
  let globalMinDate  = '';
  let globalMaxDate  = '';

  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') continue;
    const msg = raw as TelegramMsg;
    totalMessages++;

    if (!isQualifyingMessage(msg)) continue;

    let dateUtc: string;
    let ts: number;
    try {
      dateUtc = toUtcDate(msg);
      ts      = toUnixTs(msg);
    } catch {
      continue; // skip unparseable dates
    }

    qualifyingCount++;
    const userId = msg.from_id!;
    const displayName = msg.from ?? userId;

    if (!byUser.has(userId)) {
      byUser.set(userId, { displayName, dates: new Set(), messageCount: 0, timestamps: [] });
    }
    const agg = byUser.get(userId)!;
    agg.dates.add(dateUtc);
    agg.messageCount++;
    agg.timestamps.push(ts);
    // Keep most-recently-seen display name
    if (msg.from) agg.displayName = msg.from;

    if (!globalMinDate || dateUtc < globalMinDate) globalMinDate = dateUtc;
    if (!globalMaxDate || dateUtc > globalMaxDate) globalMaxDate = dateUtc;
  }

  const identities: TelegramIdentityAggregate[] = [];
  for (const [userId, agg] of byUser.entries()) {
    const activeDates = [...agg.dates].sort();
    const minTs       = Math.min(...agg.timestamps);
    identities.push({
      telegramUserId: userId,
      displayName:    agg.displayName,
      activeDates,
      messageCount:   agg.messageCount,
      firstSeenDate:  activeDates[0],
      lastSeenDate:   activeDates[activeDates.length - 1],
      isPotentialOG:  minTs < OG_CUTOFF_TS,
    });
  }

  return {
    chatName,
    totalMessages,
    qualifyingMessages: qualifyingCount,
    dateRange: {
      min: globalMinDate || '',
      max: globalMaxDate || '',
    },
    identities,
  };
}

/**
 * Validate that a JSON value looks like a Telegram export before full parsing.
 * Returns an error string or null if valid.
 */
export function validateExportShape(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'Expected a JSON object at the root level';
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj['messages'])) {
    return 'Missing "messages" array — ensure you exported in JSON format from Telegram Desktop';
  }
  return null;
}
