/**
 * Telegram Desktop HTML Export Parser
 *
 * Parses HTML message files produced by Telegram Desktop's "Export chat history"
 * feature (HTML format). Produces the same TelegramIdentityAggregate shape used
 * by the JSON parser so the rest of the reputation pipeline is format-agnostic.
 *
 * Supported files:
 *   messages.html, messages2.html, messages3.html, … (all combined in one session)
 *
 * Identity extraction (strongest → weakest):
 *   HIGH   — @username extracted from href="https://t.me/username"
 *   MEDIUM — @username appears literally in from_name (e.g. starts with @)
 *   LOW    — display name only (may collide between different people)
 *
 * Identity key stored in telegramUserId:
 *   HIGH   → "@alice_tg"
 *   MEDIUM → "@alice_tg"
 *   LOW    → "display:Alice"
 *
 * Date format in HTML: title="DD.MM.YYYY HH:MM:SS" (local time of exporter).
 * We normalize to UTC by treating it as UTC — same limitation as the JSON
 * date field fallback; at most ±1 day error for non-UTC timezone edge cases.
 *
 * Service messages (join/leave/pin/name-change) are excluded.
 * Message IDs (id="messageNNN") are tracked for cross-file deduplication.
 */

import { parse as parseHtml } from 'node-html-parser';
import type { TelegramIdentityAggregate, ParsedExport } from './telegram-parser';

// ─── Re-export shared types so callers only need one import ─────────────────

export type { TelegramIdentityAggregate, ParsedExport };

// ─── HTML-specific identity fields ──────────────────────────────────────────

export type IdentityConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Extended aggregate produced by the HTML parser. Includes confidence level. */
export interface HtmlIdentityAggregate extends TelegramIdentityAggregate {
  /** The match-confidence for this identity's HTML key. */
  identityConfidence: IdentityConfidence;
  /**
   * Normalized @username if extracted from an href or literal "@handle".
   * Undefined when only display name is available.
   */
  username?: string;
}

/** ParsedExport variant returned by the HTML parser. */
export interface HtmlParsedExport extends Omit<ParsedExport, 'identities'> {
  identities:  HtmlIdentityAggregate[];
  htmlFiles:   number;  // count of HTML files combined
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Messages before this UTC timestamp flag the sender as potential OG.
const OG_CUTOFF_TS = new Date('2018-01-01T00:00:00Z').getTime();

export const MAX_HTML_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
export const MAX_HTML_FILES      = 20;                 // safety cap on file count

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse Telegram's title-attribute date string "DD.MM.YYYY HH:MM:SS" → Date.
 * Treated as UTC (same fallback behaviour as JSON parser's `date` field).
 */
function parseTelegramHtmlDate(titleAttr: string): Date | null {
  // Format: "01.09.2025 14:30:00"
  const m = titleAttr.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`);
  return isNaN(d.getTime()) ? null : d;
}

function dateToUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Identity key derivation ─────────────────────────────────────────────────

interface ExtractedIdentity {
  key:        string;             // telegramUserId stored in DB
  displayName: string;
  username?:  string;             // @handle if available
  confidence: IdentityConfidence;
}

/**
 * Extract the strongest available identity from the from_name element.
 *
 * Telegram Desktop may render:
 *   <div class="from_name"><a href="https://t.me/alice_tg">Alice</a></div>
 *   <div class="from_name">Alice</div>
 *   <div class="from_name">@alice_tg</div>
 */
function extractIdentity(fromNameHtml: string): ExtractedIdentity {
  const root        = parseHtml(fromNameHtml);
  const anchor      = root.querySelector('a');
  const displayName = root.text.trim().replace(/\s+/g, ' ');

  // HIGH: profile link present
  if (anchor) {
    const href = anchor.getAttribute('href') ?? '';
    const tmeMatch = href.match(/^https?:\/\/t\.me\/([A-Za-z0-9_]{3,})$/);
    if (tmeMatch) {
      const username = tmeMatch[1].toLowerCase();
      return { key: `@${username}`, displayName, username, confidence: 'HIGH' };
    }
  }

  // MEDIUM: display name starts with @
  if (displayName.startsWith('@')) {
    const username = displayName.slice(1).toLowerCase();
    return { key: `@${username}`, displayName, username, confidence: 'MEDIUM' };
  }

  // LOW: display name only
  const key = `display:${displayName}`;
  return { key, displayName, confidence: 'LOW' };
}

// ─── Single-file parser ───────────────────────────────────────────────────────

interface RawMessage {
  messageId:   string;
  identity:    ExtractedIdentity;
  date:        Date;
  isService:   boolean;
}

/**
 * Parse one Telegram Desktop HTML export file.
 * Returns raw extracted messages (before cross-file dedup).
 */
export function parseTelegramHtmlFile(html: string): {
  chatName: string;
  messages: RawMessage[];
} {
  const root     = parseHtml(html, { comment: false, blockTextElements: { script: true, style: true } });

  // Chat name from page header
  const chatName = root.querySelector('.page_header .text.bold')?.text?.trim()
    ?? root.querySelector('title')?.text?.replace(/— Messages.*/, '').trim()
    ?? 'Unknown Chat';

  const messages: RawMessage[] = [];
  const allMessageDivs = root.querySelectorAll('div[id^="message"]');

  let currentSender: ExtractedIdentity | null = null;

  for (const div of allMessageDivs) {
    const id        = div.getAttribute('id') ?? '';
    const msgId     = id.replace('message', '');
    const classList = div.getAttribute('class') ?? '';

    // Service messages: class contains "service"
    if (classList.includes('service')) {
      messages.push({
        messageId: msgId,
        identity:  currentSender ?? { key: 'service', displayName: 'service', confidence: 'LOW' },
        date:      new Date(0),
        isService: true,
      });
      continue;
    }

    // Regular message: must be "message default clearfix"
    if (!classList.includes('default')) continue;

    // Date is in the title attribute of .date.details
    const dateTitleEl = div.querySelector('.pull_right.date.details')
      ?? div.querySelector('.date.details');
    const titleStr    = dateTitleEl?.getAttribute('title') ?? '';
    const date        = parseTelegramHtmlDate(titleStr);
    if (!date) continue; // skip messages with no parseable date

    // from_name is present only on the FIRST message in a consecutive sequence.
    // Joined messages (class contains "joined") inherit currentSender.
    const fromNameEl = div.querySelector('.from_name');
    if (fromNameEl) {
      currentSender = extractIdentity(fromNameEl.innerHTML);
    }

    if (!currentSender) continue; // no sender known yet — skip

    messages.push({
      messageId: msgId,
      identity:  currentSender,
      date,
      isService: false,
    });
  }

  return { chatName, messages };
}

// ─── Multi-file combiner ──────────────────────────────────────────────────────

/**
 * Parse one or more Telegram Desktop HTML export files and combine them into
 * a single ParsedExport-shaped result.
 *
 * Deduplication:
 *   - Message IDs (id="messageNNN") are tracked globally; a message seen in a
 *     second file with the same ID is skipped.
 *   - Active days are deduplicated per identity via a Set.
 *   - The TelegramActiveDay @@unique([badgeId, day]) DB constraint provides a
 *     final safety net regardless.
 */
export function parseTelegramHtmlExport(
  files: Array<{ name: string; content: string }>,
): HtmlParsedExport {
  if (files.length === 0) throw new Error('No HTML files provided');

  // Sort files: messages.html < messages2.html < messages3.html …
  const sorted = [...files].sort((a, b) => {
    const numA = Number(a.name.match(/(\d+)\.html$/)?.[1] ?? 0);
    const numB = Number(b.name.match(/(\d+)\.html$/)?.[1] ?? 0);
    return numA - numB;
  });

  const seenMessageIds = new Set<string>();
  const byKey = new Map<string, {
    displayName:  string;
    username?:    string;
    confidence:   IdentityConfidence;
    dates:        Set<string>;
    messageCount: number;
    timestamps:   number[];
  }>();

  let chatName         = 'Unknown Chat';
  let totalMessages    = 0;
  let qualifyingCount  = 0;
  let globalMinDate    = '';
  let globalMaxDate    = '';

  for (const f of sorted) {
    const { chatName: cn, messages } = parseTelegramHtmlFile(f.content);
    if (cn !== 'Unknown Chat') chatName = cn;

    for (const msg of messages) {
      totalMessages++;

      if (msg.isService) continue;

      // Cross-file dedup by message ID
      if (msg.messageId && seenMessageIds.has(msg.messageId)) continue;
      if (msg.messageId) seenMessageIds.add(msg.messageId);

      const dateUtc = dateToUtcDay(msg.date);
      const ts      = msg.date.getTime();

      qualifyingCount++;

      const { key, displayName, username, confidence } = msg.identity;

      if (!byKey.has(key)) {
        byKey.set(key, {
          displayName, username, confidence,
          dates: new Set(), messageCount: 0, timestamps: [],
        });
      }
      const agg = byKey.get(key)!;
      agg.dates.add(dateUtc);
      agg.messageCount++;
      agg.timestamps.push(ts);
      // Keep the highest-confidence identity info observed
      if (CONF_RANK[confidence] > CONF_RANK[agg.confidence]) {
        agg.displayName = displayName;
        agg.username    = username;
        agg.confidence  = confidence;
      } else if (displayName !== 'service') {
        agg.displayName = displayName;
      }

      if (!globalMinDate || dateUtc < globalMinDate) globalMinDate = dateUtc;
      if (!globalMaxDate || dateUtc > globalMaxDate) globalMaxDate = dateUtc;
    }
  }

  const identities: HtmlIdentityAggregate[] = [];
  for (const [key, agg] of byKey.entries()) {
    const activeDates = [...agg.dates].sort();
    const minTs       = Math.min(...agg.timestamps);
    identities.push({
      telegramUserId:    key,
      displayName:       agg.displayName,
      activeDates,
      messageCount:      agg.messageCount,
      firstSeenDate:     activeDates[0],
      lastSeenDate:      activeDates[activeDates.length - 1],
      isPotentialOG:     minTs < OG_CUTOFF_TS,
      identityConfidence: agg.confidence,
      username:          agg.username,
    });
  }

  return {
    chatName,
    totalMessages,
    qualifyingMessages: qualifyingCount,
    dateRange: { min: globalMinDate, max: globalMaxDate },
    identities,
    htmlFiles: sorted.length,
  };
}

// ─── Confidence ranking ──────────────────────────────────────────────────────

const CONF_RANK: Record<IdentityConfidence, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };
