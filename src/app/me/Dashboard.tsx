'use client';

/**
 * Member dashboard UI for /me. Pure presentation + handle editing; data
 * loading lives in ./page.tsx.
 */

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCard, type BadgeData as CardData } from '@/components/PassportCard';
import { C, TIERS, tierColor } from '@/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Account {
  id:             string;
  source:         string;
  handle:         string;
  externalUserId: string;
  xResolvedAt:    string | null;
  requiresReview: boolean;
  verifiedAt:     string | null;
}

export interface BadgeData {
  id:                       string;
  dualObjectId:             string;
  signalScore:              number;
  cachedTier:               string;
  memberSince:              string;
  xHandle:                  string;
  telegramHandle:           string;
  discordHandle:            string;
  xSignalLevel:             number;
  xQualifyingPosts:         number;
  xSignalPublicViews:       number;
  telegramLevel:            number;
  telegramActiveDays:       number;
  governanceLevel:          number;
  governanceVotes:          number;
  governanceActivityPoints: number;
  discordLevel:             number;
  discordActiveDays:        number;
  isOG:                     boolean;
  isGenesis:                boolean;
  createdAt:                string;
  updatedAt:                string;
}

export interface ActivityItem {
  id:      string;
  source:  'X' | 'TELEGRAM' | 'DISCORD' | 'GOV_ACTIVITY' | 'GOV_VOTE';
  date:    string;
  label:   string;
  detail?: string;
}

export interface MeData {
  email:    string;
  username: string | null;
  badge:    BadgeData | null;
  accounts: Account[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const TIER_MIN: Record<string, number> = { INITIATE: 0, EXPLORER: 150, BUILDER: 350, STAKEHOLDER: 550, GENESIS: 750, LEGEND: 900 };

const X_LEVELS   = ['FIRST_SIGNAL', 'SPARK', 'PULSE', 'WAVE', 'IMPACT'];
const TG_LEVELS  = [
  { name: 'FIRST_CONTACT', days: 1 }, { name: 'REGULAR', days: 7 }, { name: 'CONNECTED', days: 30 },
  { name: 'CORE_MEMBER', days: 90 }, { name: 'PILLAR', days: 180 },
];
const GOV_LEVELS = [
  { name: 'FIRST_VOICE', pts: 10 }, { name: 'CONTRIBUTOR', pts: 30 }, { name: 'PARTICIPANT', pts: 75 },
  { name: 'GOVERNOR', pts: 150 }, { name: 'STEWARD', pts: 300 },
];
const X_VIEWS    = [0, 1_000, 10_000, 100_000, 1_000_000];
const LEVEL_PTS  = (level: number) => level * 50;

const SOURCE_META: Record<ActivityItem['source'], { icon: string; color: string }> = {
  X:            { icon: '𝕏',   color: '#E8F4FC' },
  TELEGRAM:     { icon: 'TG',  color: '#5ED3EA' },
  DISCORD:      { icon: 'DC',  color: '#7B83EB' },
  GOV_ACTIVITY: { icon: 'GOV', color: '#F7C873' },
  GOV_VOTE:     { icon: 'GOV', color: '#F7C873' },
};

const fmtNum  = (n: number) => n.toLocaleString('en-US');
const plural  = (n: number, w: string) => `${fmtNum(n)} ${w}${n === 1 ? '' : 's'}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Channels ──────────────────────────────────────────────────────────────────

interface Channel { key: string; icon: string; label: string; color: string; level: number; levelName?: string; metric: string; next: string | null }

function buildChannels(b: BadgeData): Channel[] {
  return [
    {
      key: 'x', icon: '𝕏', label: 'X Signal', color: '#E8F4FC', level: b.xSignalLevel, levelName: X_LEVELS[b.xSignalLevel - 1],
      metric: b.xSignalLevel > 0 ? `${plural(b.xQualifyingPosts, 'post')} · ${plural(Number(b.xSignalPublicViews), 'view')}` : 'No qualifying posts yet',
      next: b.xSignalLevel === 0 ? 'Post on X mentioning DUAL or SIGNAL to unlock your first 50 pts.'
        : b.xSignalLevel >= 5 ? null
        : `${fmtNum(Math.max(0, X_VIEWS[b.xSignalLevel] - Number(b.xSignalPublicViews)))} more views for ${X_LEVELS[b.xSignalLevel]}.`,
    },
    {
      key: 'tg', icon: 'TG', label: 'Telegram', color: '#5ED3EA', level: b.telegramLevel, levelName: TG_LEVELS[b.telegramLevel - 1]?.name,
      metric: b.telegramActiveDays > 0 ? `${plural(b.telegramActiveDays, 'active day')}` : 'No activity yet',
      next: b.telegramLevel === 0 ? 'Send a message in the DUAL Telegram group to earn 50 pts.'
        : b.telegramLevel >= 5 ? null
        : `${plural(TG_LEVELS[b.telegramLevel].days - b.telegramActiveDays, 'more active day')} for ${TG_LEVELS[b.telegramLevel].name}.`,
    },
    {
      key: 'dc', icon: 'DC', label: 'Discord', color: '#7B83EB', level: b.discordLevel, levelName: TG_LEVELS[b.discordLevel - 1]?.name,
      metric: b.discordActiveDays > 0 ? `${plural(b.discordActiveDays, 'active day')}` : 'No activity yet',
      next: b.discordLevel === 0 ? 'Take part in the DUAL Discord to earn 50 pts.'
        : b.discordLevel >= 5 ? null
        : `${plural(TG_LEVELS[b.discordLevel].days - b.discordActiveDays, 'more active day')} for ${TG_LEVELS[b.discordLevel].name}.`,
    },
    {
      key: 'gov', icon: 'GOV', label: 'Governance', color: '#F7C873', level: b.governanceLevel, levelName: GOV_LEVELS[b.governanceLevel - 1]?.name,
      metric: b.governanceActivityPoints > 0 ? `${plural(b.governanceActivityPoints, 'activity pt')} · ${plural(b.governanceVotes, 'vote')}` : 'No forum activity yet',
      next: b.governanceLevel === 0 ? 'Comment or vote on the DUAL governance forum — 10 activity pts earns 50 SIGNAL.'
        : b.governanceLevel >= 5 ? null
        : `${plural(GOV_LEVELS[b.governanceLevel].pts - b.governanceActivityPoints, 'more activity pt')} for ${GOV_LEVELS[b.governanceLevel].name}.`,
    },
  ];
}

// ── Account row (view + inline edit) ──────────────────────────────────────────

function AccountRow({
  provider, icon, iconColor, label, placeholder, handle, at = true, extra, onUpdated,
}: {
  provider:    'x' | 'telegram' | 'discord' | 'forum';
  icon:        string;
  iconColor:   string;
  label:       string;
  placeholder: string;
  handle:      string;
  at?:         boolean;
  extra?:      React.ReactNode;
  onUpdated:   (handle: string | null) => void;
}) {
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState(handle);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');
  const [confirming, setConfirming] = useState(false);

  function cancel() { setDraft(handle); setErr(''); setConfirming(false); setEditing(false); }

  async function save() {
    const value = draft.replace(/^@/, '').trim();
    setSaving(true); setErr('');
    try {
      const res  = await fetch(`/api/me/accounts/${provider}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: value }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Update failed.'); return; }
      onUpdated(data.handle ?? value);
      setEditing(false);
    } catch { setErr('Network error. Please try again.'); }
    finally   { setSaving(false); }
  }

  async function remove() {
    setSaving(true); setErr('');
    try {
      const res = await fetch(`/api/me/accounts/${provider}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Remove failed.'); return; }
      onUpdated(null); setDraft(''); setConfirming(false); setEditing(false);
    } catch { setErr('Network error. Please try again.'); }
    finally  { setSaving(false); }
  }

  return (
    <div className="me-acct">
      <div className="me-acct-row">
        <span className="me-chip" style={{ color: iconColor }}>{icon}</span>
        <div className="me-acct-main">
          <div className="me-acct-label">{label}{extra}</div>
          {!editing && (handle
            ? <div className="me-acct-handle">{at ? '@' : ''}{handle}</div>
            : <div className="me-acct-empty">Not connected</div>)}
        </div>
        {!editing && (
          <button type="button" className={`ds-btn ds-btn-sm ${handle ? 'ds-btn-ghost' : 'me-btn-soft'}`} onClick={() => { setDraft(handle); setEditing(true); }}>
            {handle ? 'Edit' : 'Connect'}
          </button>
        )}
      </div>

      {editing && (
        <div className="me-acct-edit">
          {confirming ? (
            <div className="me-confirm">
              <p>Remove your {label} connection?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="ds-btn ds-btn-sm me-btn-danger" onClick={remove} disabled={saving}>{saving ? 'Removing…' : 'Remove'}</button>
                <button type="button" className="ds-btn ds-btn-sm ds-btn-ghost" onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  className="ds-input ds-input-sm"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder={placeholder}
                  aria-label={`${label} handle`}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
                />
                <button type="button" className="ds-btn ds-btn-sm ds-btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="ds-btn ds-btn-sm ds-btn-ghost" onClick={cancel}>Cancel</button>
              </div>
              {handle && (
                <button type="button" className="me-link-danger" onClick={() => setConfirming(true)} disabled={saving}>Remove {label}</button>
              )}
            </>
          )}
          {err && <p className="me-err">{err}</p>}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({
  data, activities, actLoading, onUpdateHandle, onLogout,
}: {
  data:           MeData;
  activities:     ActivityItem[];
  actLoading:     boolean;
  onUpdateHandle: (source: string, badgeField: keyof BadgeData | null, val: string | null) => void;
  onLogout:       () => void;
}) {
  const [showAllAct,    setShowAllAct]    = useState(false);
  const [tgCode,        setTgCode]        = useState<string | null>(null);
  const [tgCodeLoading, setTgCodeLoading] = useState(false);
  const [copied,        setCopied]        = useState(false);

  const { badge } = data;
  const handleOf  = (source: string) => data.accounts.find(a => a.source === source)?.handle ?? '';

  const xHandle     = badge?.xHandle        || handleOf('TWITTER');
  const tgHandle    = badge?.telegramHandle || handleOf('TELEGRAM');
  const dcHandle    = badge?.discordHandle  || handleOf('DISCORD');
  const forumHandle = handleOf('DUAL_FORUM');

  const tier      = badge?.cachedTier ?? 'INITIATE';
  const score     = badge?.signalScore ?? 0;
  const tierIdx   = TIERS.findIndex(t => t.name === tier);
  const nextTier  = TIERS[tierIdx + 1];
  const curMin    = TIER_MIN[tier] ?? 0;
  const nextMin   = nextTier ? TIER_MIN[nextTier.name] : 1000;
  const tierPct   = nextTier ? Math.min(100, Math.max(0, ((score - curMin) / (nextMin - curMin)) * 100)) : 100;

  const channels      = badge ? buildChannels(badge) : [];
  const activeCount   = channels.filter(c => c.level > 0).length;
  const linkedCount   = [xHandle, tgHandle, dcHandle, forumHandle].filter(Boolean).length;
  const recentCount   = activities.filter(a => Date.now() - new Date(a.date).getTime() < 30 * 86_400_000).length;
  const visibleActs   = showAllAct ? activities : activities.slice(0, 8);

  const tgAccount     = data.accounts.find(a => a.source === 'TELEGRAM');
  const tgNeedsVerify = !!tgHandle && !(tgAccount?.externalUserId && /^\d+$/.test(tgAccount.externalUserId));

  const orgId     = process.env.NEXT_PUBLIC_DUAL_ORG_ID ?? '6a9831bdc8ff2688f8c9d3e2';
  const walletUrl = `https://wallet.dual.network/${orgId}/login`;
  const displayName = data.username ?? data.email;

  const cardData: CardData | null = badge && {
    signalScore:         badge.signalScore,
    tier,
    xSignalLevel:        badge.xSignalLevel,
    telegramLevel:       badge.telegramLevel,
    discordLevel:        badge.discordLevel,
    governanceLevel:     badge.governanceLevel,
    isOG:                badge.isOG,
    isGenesis:           badge.isGenesis,
    walletAddress:       '',
    username:            data.username ?? '',
    memberSince:         badge.memberSince,
    xConnected:          !!xHandle,
    telegramConnected:   !!tgHandle,
    discordConnected:    !!dcHandle,
    governanceConnected: !!forumHandle,
  };

  async function share() {
    if (!badge) return;
    const url = `${window.location.origin}/badge/${badge.dualObjectId}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${displayName} — DUAL // SIGNAL`, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch { /* user cancelled */ }
  }

  async function getTgCode() {
    setTgCodeLoading(true);
    try {
      const res = await fetch('/api/me/telegram-verify-code', { method: 'POST' });
      if (res.ok) { const j = await res.json(); setTgCode(j.code); }
    } finally { setTgCodeLoading(false); }
  }

  return (
    <div className="me">
      <style>{ME_CSS}</style>

      {/* ── Nav ── */}
      <nav className="ds-nav">
        <Link href="/" className="ds-logo">DUAL <span>//</span> SIGNAL</Link>
        <div className="ds-nav-links">
          <span className="ds-pill ds-nav-hide-sm">Alpha</span>
          <Link href="/leaderboard" className="ds-nav-link ds-nav-hide-sm">Leaderboard</Link>
          <div className="me-user">
            <span className="me-avatar" aria-hidden>{displayName.slice(0, 1).toUpperCase()}</span>
            <span className="me-user-name ds-nav-hide-sm">{displayName}</span>
          </div>
          <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={onLogout}>Sign out</button>
        </div>
      </nav>

      <main className="ds-container me-main">

        {/* ── Page header ── */}
        <header className="me-head">
          <div>
            <p className="ds-eyebrow" style={{ marginBottom: 8 }}>Dashboard</p>
            <h1 className="me-title">{badge ? `Welcome back, ${displayName}` : `Welcome, ${displayName}`}</h1>
            {badge && (
              <p className="me-sub">
                {badge.memberSince && <>Member since {badge.memberSince} · </>}
                Score synced {timeAgo(badge.updatedAt)}
              </p>
            )}
          </div>
          {badge && (
            <div className="me-head-actions">
              <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
              <a href={`/badge/${badge.dualObjectId}`} className="ds-btn ds-btn-primary ds-btn-sm">View Passport</a>
            </div>
          )}
        </header>

        {!badge ? (
          /* ── No Passport yet ── */
          <section className="ds-card me-onboard">
            <div>
              <p className="ds-eyebrow">Get started</p>
              <h2 className="me-h2">Mint your Passport to start earning SIGNAL</h2>
              <p className="ds-body" style={{ maxWidth: 440 }}>Connect your accounts and earn up to 1,000 points across four channels.</p>
              <a href="/join" className="ds-btn ds-btn-primary" style={{ marginTop: 24 }}>Mint Passport →</a>
            </div>
            <ol className="me-steps">
              {[
                { done: true,  label: 'Create account' },
                { done: false, label: 'Mint your Passport' },
                { done: false, label: 'Connect X, Telegram, Discord & Forum' },
                { done: false, label: 'Earn SIGNAL through community activity' },
              ].map((s, i) => (
                <li key={s.label} className={s.done ? 'is-done' : ''}>
                  <span>{s.done ? '✓' : i + 1}</span>{s.label}
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <>
            {/* ── Overview: Passport + score ── */}
            <section className="me-overview">
              <div className="me-passport">
                {cardData && <BadgeCard data={cardData} />}
              </div>

              <div className="ds-card me-score">
                <div className="me-score-top">
                  <span className="ds-label" style={{ margin: 0 }}>SIGNAL score</span>
                  <span className="me-tier" style={{ color: tierColor(tier), borderColor: 'currentColor' }}>{tier}</span>
                </div>
                <div className="me-score-num">
                  {fmtNum(score)}<span>/ 1,000</span>
                </div>

                <div className="me-progress" aria-label={`${Math.round(tierPct)}% to ${nextTier?.name ?? 'max tier'}`}>
                  <div style={{ width: `${tierPct}%`, background: tierColor(tier) }} />
                </div>
                <p className="me-progress-label">
                  {nextTier
                    ? <><b>{fmtNum(nextMin - score)} pts</b> to {nextTier.name}</>
                    : <b style={{ color: C.success }}>Maximum tier reached</b>}
                </p>

                <div className="me-tierline" aria-hidden>
                  {TIERS.map((t, i) => (
                    <span key={t.name} className={i <= tierIdx ? 'is-on' : ''} style={i <= tierIdx ? { background: t.color } : undefined} title={t.name} />
                  ))}
                </div>

                <div className="me-stats">
                  <div><b>{activeCount}<small>/4</small></b><span>Channels earning</span></div>
                  <div><b>{linkedCount}<small>/4</small></b><span>Accounts linked</span></div>
                  <div><b>{recentCount}</b><span>Events · 30 days</span></div>
                </div>

                {(badge.isOG || badge.isGenesis) && (
                  <div className="me-flags">
                    {badge.isOG && <span>OG</span>}
                    {badge.isGenesis && <span>Genesis</span>}
                  </div>
                )}
              </div>
            </section>

            {/* ── Channels ── */}
            <section className="me-section">
              <div className="me-section-head">
                <h2 className="me-h2">Channels</h2>
                <span className="ds-small">Each channel has 5 levels worth up to 250 SIGNAL</span>
              </div>
              <div className="me-channels">
                {channels.map(ch => (
                  <article key={ch.key} className="ds-card me-ch">
                    <div className="me-ch-top">
                      <span className="me-chip" style={{ color: ch.color }}>{ch.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="me-ch-name">{ch.label}</div>
                        <div className="ds-small">{ch.level > 0 ? `Level ${ch.level} · ${ch.levelName}` : 'Not started'}</div>
                      </div>
                      <div className={`me-ch-pts${ch.level > 0 ? '' : ' is-zero'}`}>{ch.level > 0 ? `+${LEVEL_PTS(ch.level)}` : '0'}</div>
                    </div>
                    <div className="me-ch-bar">
                      {[1, 2, 3, 4, 5].map(l => <span key={l} style={l <= ch.level ? { background: ch.color } : undefined} />)}
                    </div>
                    <p className="me-ch-metric">{ch.metric}</p>
                    {ch.next
                      ? <p className="me-ch-next"><b style={{ color: ch.color }}>Next</b> {ch.next}</p>
                      : <p className="me-ch-next"><b style={{ color: C.success }}>Maxed out</b> All five levels earned.</p>}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Activity + sidebar ── */}
        <section className="me-split">
          {badge && (
            <div className="ds-card me-panel">
              <div className="me-panel-head">
                <h2 className="me-h3">Recent activity</h2>
                {activities.length > 0 && <span className="ds-small">{plural(activities.length, 'event')}</span>}
              </div>
              {actLoading && <div className="me-skel-list">{[0, 1, 2, 3].map(i => <div key={i} className="me-skel" />)}</div>}
              {!actLoading && activities.length === 0 && (
                <div className="me-empty">
                  <p>No activity recorded yet.</p>
                  <span className="ds-small">Activity on your connected channels will show up here.</span>
                </div>
              )}
              {!actLoading && activities.length > 0 && (
                <ul className="me-feed">
                  {visibleActs.map(a => (
                    <li key={a.id}>
                      <span className="me-chip me-chip-sm" style={{ color: SOURCE_META[a.source].color }}>{SOURCE_META[a.source].icon}</span>
                      <div className="me-feed-main">
                        <div className="me-feed-label">{a.label}</div>
                        {a.detail && <div className="ds-small">{a.detail}</div>}
                      </div>
                      <time className="me-feed-date" dateTime={a.date}>{fmtDate(a.date)}</time>
                    </li>
                  ))}
                </ul>
              )}
              {activities.length > 8 && (
                <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-block" style={{ marginTop: 12 }} onClick={() => setShowAllAct(v => !v)}>
                  {showAllAct ? 'Show less' : `Show ${activities.length - 8} more`}
                </button>
              )}
            </div>
          )}

          <aside className="me-side">
            {/* Connected accounts */}
            <div className="ds-card me-panel">
              <div className="me-panel-head">
                <h2 className="me-h3">Connected accounts</h2>
                <span className="ds-small">{linkedCount}/4</span>
              </div>
              <AccountRow
                provider="x" icon="𝕏" iconColor="#E8F4FC" label="X" placeholder="@username" handle={xHandle}
                onUpdated={v => onUpdateHandle('TWITTER', 'xHandle', v)}
              />
              <AccountRow
                provider="telegram" icon="TG" iconColor="#5ED3EA" label="Telegram" placeholder="@username" handle={tgHandle}
                extra={tgHandle && !tgNeedsVerify ? <span className="me-verified">Verified</span> : undefined}
                onUpdated={v => onUpdateHandle('TELEGRAM', 'telegramHandle', v)}
              />
              {tgNeedsVerify && (
                <div className="me-verify">
                  <b>Verify Telegram</b>
                  {tgCode ? (
                    <p>
                      DM <code>@dual_signal_tracker_bot</code> with <code>/connect {tgCode}</code>
                      <span className="ds-small" style={{ display: 'block', marginTop: 4 }}>Code expires in 30 minutes.</span>
                    </p>
                  ) : (
                    <>
                      <p>Prove this handle is yours so your Telegram activity counts.</p>
                      <button type="button" className="ds-btn ds-btn-sm me-btn-soft" onClick={getTgCode} disabled={tgCodeLoading}>
                        {tgCodeLoading ? 'Generating…' : 'Get verification code'}
                      </button>
                    </>
                  )}
                </div>
              )}
              <AccountRow
                provider="discord" icon="DC" iconColor="#7B83EB" label="Discord" placeholder="username" handle={dcHandle}
                onUpdated={v => onUpdateHandle('DISCORD', 'discordHandle', v)}
              />
              <AccountRow
                provider="forum" icon="GOV" iconColor="#F7C873" label="DUAL Forum" placeholder="forum username" handle={forumHandle} at={false}
                onUpdated={v => onUpdateHandle('DUAL_FORUM', null, v)}
              />
            </div>

            {/* On-chain */}
            {badge && (
              <div className="ds-card me-panel">
                <div className="me-panel-head">
                  <h2 className="me-h3">On-chain Passport</h2>
                  <span className="me-status"><i /> Active on DUAL</span>
                </div>
                <dl className="me-dl">
                  <dt>Object ID</dt>
                  <dd><code title={badge.dualObjectId}>{badge.dualObjectId}</code></dd>
                  <dt>Network</dt>
                  <dd>DUAL · Chain 6301</dd>
                </dl>
                <div className="me-btn-row">
                  <a href={`https://explorer.dual.network/objects/${badge.dualObjectId}`} target="_blank" rel="noreferrer" className="ds-btn ds-btn-ghost ds-btn-sm">Explorer ↗</a>
                  <a href={walletUrl} target="_blank" rel="noopener noreferrer" className="ds-btn ds-btn-ghost ds-btn-sm">DUAL wallet ↗</a>
                </div>
                <p className="ds-small" style={{ marginTop: 12 }}>Sign in to the DUAL wallet with the email and password from sign-up.</p>
              </div>
            )}

            {/* Account */}
            <div className="ds-card me-panel">
              <div className="me-panel-head"><h2 className="me-h3">Account</h2></div>
              <dl className="me-dl">
                <dt>Email</dt>
                <dd>{data.email}</dd>
                {data.username && (<><dt>Username</dt><dd>{data.username}</dd></>)}
              </dl>
            </div>
          </aside>
        </section>
      </main>

      <footer className="ds-footer">
        <span className="ds-logo" style={{ fontSize: 12, color: C.textFaint }}>DUAL <span>//</span> SIGNAL</span>
        <span><Link href="/leaderboard">Leaderboard</Link> · DUAL Network</span>
      </footer>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ME_CSS = `
  .me { min-height: 100vh; background: radial-gradient(ellipse 1100px 600px at 50% -120px, rgba(14,180,208,0.08) 0%, transparent 65%), var(--ds-bg); }
  .me-main { padding-top: 104px; padding-bottom: 80px; }

  .me-user { display: flex; align-items: center; gap: 10px; }
  .me-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--ds-cyan-wash); border: 1px solid var(--ds-border-strong); color: var(--ds-cyan); font-size: 13px; font-weight: 700; }
  .me-user-name { font-size: 13px; color: var(--ds-text); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .me-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
  .me-title { margin: 0; font-size: clamp(26px, 3.2vw, 34px); font-weight: 800; letter-spacing: -0.02em; color: var(--ds-text-strong); overflow-wrap: anywhere; }
  .me-sub { margin: 8px 0 0; font-size: 13px; color: var(--ds-text-dim); }
  .me-head-actions { display: flex; gap: 10px; }

  .me-h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: var(--ds-text-strong); }
  .me-h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--ds-text-strong); }

  .me-overview { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 20px; align-items: stretch; }
  .me-passport { border-radius: var(--ds-radius-lg); overflow: hidden; border: 1px solid var(--ds-border-strong); background: #001A27;
    box-shadow: 0 30px 70px -40px rgba(94,211,234,0.55); align-self: center; }

  .me-score { padding: 28px; display: flex; flex-direction: column; }
  .me-score-top { display: flex; justify-content: space-between; align-items: center; }
  .me-tier { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; border: 1px solid; border-radius: 999px; padding: 4px 10px; }
  .me-score-num { margin: 14px 0 18px; font-size: 64px; font-weight: 900; letter-spacing: -0.04em; line-height: 1; color: var(--ds-text-strong); font-variant-numeric: tabular-nums; }
  .me-score-num span { font-size: 16px; font-weight: 600; letter-spacing: 0; color: var(--ds-text-faint); margin-left: 8px; }
  .me-progress { height: 6px; border-radius: 3px; background: var(--ds-border); overflow: hidden; }
  .me-progress > div { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .me-progress-label { margin: 10px 0 0; font-size: 13px; color: var(--ds-text-dim); }
  .me-progress-label b { color: var(--ds-text-strong); }
  .me-tierline { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 18px; }
  .me-tierline span { height: 3px; border-radius: 2px; background: var(--ds-border); }
  .me-stats { margin-top: auto; padding-top: 24px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .me-stats > div { padding: 12px; border-radius: var(--ds-radius); background: var(--ds-bg-inset); border: 1px solid var(--ds-border); }
  .me-stats b { display: block; font-size: 22px; font-weight: 800; color: var(--ds-text-strong); font-variant-numeric: tabular-nums; }
  .me-stats small { font-size: 12px; font-weight: 600; color: var(--ds-text-faint); }
  .me-stats span { display: block; margin-top: 2px; font-size: 11px; color: var(--ds-text-faint); }
  .me-flags { display: flex; gap: 8px; margin-top: 14px; }
  .me-flags span { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ds-gold);
    border: 1px solid rgba(247,200,115,0.3); background: rgba(247,200,115,0.06); border-radius: 6px; padding: 4px 10px; }

  .me-section { margin-top: 44px; }
  .me-section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .me-section-head .me-h2 { margin: 0; }
  .me-channels { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .me-ch { padding: 20px; display: flex; flex-direction: column; }
  .me-ch-top { display: flex; align-items: center; gap: 12px; }
  .me-ch-name { font-size: 14px; font-weight: 700; color: var(--ds-text-strong); }
  .me-ch-pts { font-size: 20px; font-weight: 800; color: var(--ds-text-strong); font-variant-numeric: tabular-nums; }
  .me-ch-pts.is-zero { color: var(--ds-text-faint); }
  .me-ch-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 16px 0 12px; }
  .me-ch-bar span { height: 4px; border-radius: 2px; background: var(--ds-border); }
  .me-ch-metric { margin: 0; font-size: 12px; color: var(--ds-text-dim); }
  .me-ch-next { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--ds-border); font-size: 12px; line-height: 1.55; color: var(--ds-text-dim); }
  .me-ch-next b { margin-right: 4px; }

  .me-chip { width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    background: var(--ds-cyan-wash); border: 1px solid var(--ds-border); font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
  .me-chip-sm { width: 28px; height: 28px; border-radius: 8px; font-size: 9px; }

  .me-split { margin-top: 44px; display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  .me-side { display: flex; flex-direction: column; gap: 20px; }
  .me-split > .me-side:only-child { grid-column: 1 / -1; max-width: 560px; }
  .me-panel { padding: 22px; }
  .me-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }

  .me-feed { list-style: none; margin: 0; padding: 0; }
  .me-feed li { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--ds-border); }
  .me-feed li:last-child { border-bottom: 0; }
  .me-feed-main { flex: 1; min-width: 0; }
  .me-feed-label { font-size: 13px; color: var(--ds-text); font-weight: 500; }
  .me-feed-date { font-size: 11px; color: var(--ds-text-faint); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .me-empty { padding: 28px 0; text-align: center; }
  .me-empty p { margin: 0 0 4px; color: var(--ds-text); font-size: 14px; }
  @keyframes me-shimmer { 0% { opacity: 0.45; } 50% { opacity: 0.9; } 100% { opacity: 0.45; } }
  .me-skel-list { display: flex; flex-direction: column; gap: 10px; padding: 6px 0; }
  .me-skel { height: 40px; border-radius: 8px; background: var(--ds-bg-raised); animation: me-shimmer 1.4s ease-in-out infinite; }

  .me-acct { padding: 12px 0; border-bottom: 1px solid var(--ds-border); }
  .me-acct:last-child { border-bottom: 0; }
  .me-acct-row { display: flex; align-items: center; gap: 12px; }
  .me-acct-main { flex: 1; min-width: 0; }
  .me-acct-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ds-text); }
  .me-acct-handle { font-size: 12px; color: var(--ds-cyan); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .me-acct-empty { font-size: 12px; color: var(--ds-text-faint); }
  .me-acct-edit { margin: 10px 0 0 48px; display: flex; flex-direction: column; gap: 8px; }
  .me-verified { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ds-success); }
  .me-verify { margin: 0 0 4px 48px; padding: 12px 14px; border-radius: var(--ds-radius-sm); background: var(--ds-cyan-wash); border: 1px solid var(--ds-border-strong); font-size: 12px; color: var(--ds-text-dim); }
  .me-verify b { color: var(--ds-cyan); font-size: 12px; }
  .me-verify p { margin: 4px 0 10px; line-height: 1.55; }
  .me-verify code, .me-dl code { font-family: var(--ds-mono); font-size: 11.5px; color: var(--ds-text); background: rgba(94,211,234,0.08); border-radius: 4px; padding: 1px 6px; }
  .me-confirm { padding: 12px 14px; border-radius: var(--ds-radius-sm); background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.22); }
  .me-confirm p { margin: 0 0 10px; font-size: 12px; font-weight: 600; color: var(--ds-danger); }
  .me-btn-soft { background: var(--ds-cyan-wash); color: var(--ds-cyan); border-color: var(--ds-border-strong); }
  .me-btn-soft:hover:not(:disabled) { border-color: var(--ds-border-focus); }
  .me-btn-danger { background: rgba(248,113,113,0.12); color: var(--ds-danger); border-color: rgba(248,113,113,0.3); }
  .me-link-danger { align-self: flex-start; background: none; border: 0; padding: 0; font-family: inherit; font-size: 11px; color: var(--ds-danger); text-decoration: underline; cursor: pointer; }
  .me-err { margin: 0; font-size: 12px; color: var(--ds-danger); }

  .me-status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ds-success); }
  .me-status i { width: 6px; height: 6px; border-radius: 50%; background: var(--ds-success); box-shadow: 0 0 0 3px rgba(74,200,154,0.18); }
  .me-dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 16px; font-size: 13px; }
  .me-dl dt { color: var(--ds-text-faint); }
  .me-dl dd { margin: 0; color: var(--ds-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
  .me-btn-row { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

  .me-onboard { padding: 36px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: center; }
  .me-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .me-steps li { display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--ds-text); }
  .me-steps li span { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    border: 1px solid var(--ds-border-strong); font-size: 12px; color: var(--ds-text-dim); }
  .me-steps li.is-done { color: var(--ds-success); }
  .me-steps li.is-done span { border-color: rgba(74,200,154,0.4); color: var(--ds-success); background: rgba(74,200,154,0.08); }

  @media (max-width: 1080px) {
    .me-channels { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 900px) {
    .me-overview, .me-split, .me-onboard { grid-template-columns: 1fr; }
    .me-split > .me-side:only-child { max-width: none; }
  }
  @media (max-width: 560px) {
    .me-main { padding-top: 88px; }
    .me-channels { grid-template-columns: 1fr; }
    .me-score { padding: 22px; }
    .me-score-num { font-size: 52px; }
    .me-head-actions { width: 100%; }
    .me-head-actions > * { flex: 1; }
    .me-acct-edit, .me-verify { margin-left: 0; }
    .me-onboard { padding: 24px; }
  }
`;
