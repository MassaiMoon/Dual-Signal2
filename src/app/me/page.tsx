'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account {
  id:             string;
  source:         string;
  handle:         string;
  externalUserId: string;
  xResolvedAt:    string | null;
  requiresReview: boolean;
  verifiedAt:     string | null;
}

interface BadgeData {
  id:              string;
  dualObjectId:    string;
  signalScore:     number;
  cachedTier:      string;
  memberSince:     string;
  xHandle:         string;
  telegramHandle:  string;
  discordHandle:   string;
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
  createdAt:       string;
  updatedAt:       string;
}

interface ActivityItem {
  id:      string;
  source:  'X' | 'TELEGRAM' | 'DISCORD' | 'GOV_ACTIVITY' | 'GOV_VOTE';
  date:    string;
  label:   string;
  detail?: string;
}

interface MeData {
  email:    string;
  username: string | null;
  badge:    BadgeData | null;
  accounts: Account[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const BUTTERFLY_TIERS = [
  { name: 'INITIATE',    minScore: 0   },
  { name: 'EXPLORER',    minScore: 150 },
  { name: 'BUILDER',     minScore: 350 },
  { name: 'STAKEHOLDER', minScore: 550 },
  { name: 'GENESIS',     minScore: 750 },
  { name: 'LEGEND',      minScore: 900 },
];

const X_LEVELS = [
  { level: 1, name: 'FIRST_SIGNAL', points: 50  },
  { level: 2, name: 'SPARK',        points: 100 },
  { level: 3, name: 'PULSE',        points: 150 },
  { level: 4, name: 'WAVE',         points: 200 },
  { level: 5, name: 'IMPACT',       points: 250 },
];
const TG_LEVELS = [
  { level: 1, name: 'FIRST_CONTACT', points: 50,  activeDays: 1   },
  { level: 2, name: 'REGULAR',       points: 100, activeDays: 7   },
  { level: 3, name: 'CONNECTED',     points: 150, activeDays: 30  },
  { level: 4, name: 'CORE_MEMBER',   points: 200, activeDays: 90  },
  { level: 5, name: 'PILLAR',        points: 250, activeDays: 180 },
];
const DC_LEVELS = TG_LEVELS;
const GOV_LEVELS = [
  { level: 1, name: 'FIRST_VOICE',  points: 50,  activityPoints: 10  },
  { level: 2, name: 'CONTRIBUTOR',  points: 100, activityPoints: 30  },
  { level: 3, name: 'PARTICIPANT',  points: 150, activityPoints: 75  },
  { level: 4, name: 'GOVERNOR',     points: 200, activityPoints: 150 },
  { level: 5, name: 'STEWARD',      points: 250, activityPoints: 300 },
];

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  bg:        '#040E1A',
  bgCard:    '#071525',
  bgDark:    '#020C16',
  border:    'rgba(94,211,234,0.09)',
  borderMid: 'rgba(94,211,234,0.14)',
  cyan:      '#5ED3EA',
  cyanDim:   '#0EB4D0',
  text:      '#C8D8E8',
  textMuted: '#4A6A7A',
  textDim:   '#2A3A4A',
  textLabel: '#3A5A6A',
  green:     '#4AC89A',
  red:       '#F87171',
  gold:      '#F7C873',
};

const TIER_COLOR: Record<string, string> = {
  INITIATE:    '#4A7A8A',
  EXPLORER:    '#5ED3EA',
  BUILDER:     '#7FE4F4',
  STAKEHOLDER: '#A8EDF9',
  GENESIS:     '#F7C873',
  LEGEND:      '#FFD700',
};

const SOURCE_ICON: Record<string, string> = {
  X:            '𝕏',
  TELEGRAM:     'TG',
  DISCORD:      'DC',
  GOV_ACTIVITY: 'GOV',
  GOV_VOTE:     'GOV',
};
const SOURCE_COLOR: Record<string, string> = {
  X:            '#E8F4FC',
  TELEGRAM:     '#5ED3EA',
  DISCORD:      '#7B83EB',
  GOV_ACTIVITY: '#F7C873',
  GOV_VOTE:     '#F7C873',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Tier progression bar ──────────────────────────────────────────────────────

function TierBar({ tier }: { tier: string }) {
  const currentIdx = BUTTERFLY_TIERS.findIndex(t => t.name === tier);
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '0.18em', color: C.textLabel, textTransform: 'uppercase' as const, marginBottom: 8 }}>
        Tier Progression
      </p>
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {BUTTERFLY_TIERS.map((t, i) => {
          const isActive = t.name === tier;
          const isPast   = i < currentIdx;
          const color    = TIER_COLOR[t.name] ?? C.cyan;
          return (
            <div key={t.name} style={{ flex: 1, height: 5, borderRadius: 3, background: isPast || isActive ? color : 'rgba(94,211,234,0.07)', border: isPast || isActive ? 'none' : `1px solid ${C.border}`, opacity: isPast ? 0.5 : 1 }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {BUTTERFLY_TIERS.map(t => {
          const isActive = t.name === tier;
          const color    = TIER_COLOR[t.name] ?? C.cyan;
          return (
            <span key={t.name} style={{ fontSize: 7, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: isActive ? color : C.textDim, fontWeight: isActive ? 700 : 400 }}>
              {t.name === 'STAKEHOLDER' ? 'S.HLDR' : t.name.slice(0, 4).toUpperCase()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── HandleEditor ──────────────────────────────────────────────────────────────

function HandleEditor({
  provider, currentHandle, label, placeholder, onSaved,
}: {
  provider:      string;
  currentHandle: string;
  label:         string;
  placeholder:   string;
  onSaved:       (handle: string | null) => void;
}) {
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState(currentHandle);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');
  const [confirming, setConfirming] = useState(false);

  async function save() {
    const value = draft.replace(/^@/, '').trim();
    setSaving(true); setErr('');
    try {
      const res  = await fetch(`/api/me/accounts/${provider}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: value }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Update failed.'); return; }
      onSaved(data.handle ?? value);
      setEditing(false);
    } catch { setErr('Network error. Please try again.'); }
    finally   { setSaving(false); }
  }

  async function remove() {
    setSaving(true); setErr('');
    try {
      const res = await fetch(`/api/me/accounts/${provider}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Remove failed.'); return; }
      onSaved(null); setEditing(false); setDraft(''); setConfirming(false);
    } catch { setErr('Network error. Please try again.'); }
    finally  { setSaving(false); }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 }}>
        {confirming ? (
          <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: C.red, margin: '0 0 10px', fontWeight: 600 }}>Remove {label} connection?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={remove} disabled={saving} style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '6px 14px', color: C.red, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {saving ? 'Removing…' : 'Remove'}
              </button>
              <button onClick={() => setConfirming(false)} disabled={saving} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', color: C.textLabel, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
            {err && <p style={{ fontSize: 12, color: C.red, margin: '8px 0 0' }}>{err}</p>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => {
                  if (e.key === 'Enter')  save();
                  if (e.key === 'Escape') { setEditing(false); setDraft(currentHandle); setErr(''); }
                }}
                style={{ flex: 1, background: C.bg, border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={save} disabled={saving} style={{ background: 'rgba(94,211,234,0.12)', border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 14px', color: C.cyan, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setDraft(currentHandle); setErr(''); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
            </div>
            {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
            {currentHandle && (
              <button onClick={() => setConfirming(true)} disabled={saving} style={{ background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>
                Remove {label}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#A8C8D8', marginBottom: 2 }}>{label}</p>
      {currentHandle
        ? <p style={{ fontSize: 12, color: C.cyan }}><button style={{ background: 'none', border: 'none', color: C.cyan, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }} onClick={() => setEditing(true)}>@{currentHandle}</button></p>
        : <p style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Not connected</p>
      }
    </div>
  );

  void provider;
}

// ── AccountRow ────────────────────────────────────────────────────────────────

function AccountRow({
  provider, icon, iconColor, label, placeholder, handle, labelSuffix, onUpdated,
}: {
  provider:     string;
  icon:         string;
  iconColor:    string;
  label:        string;
  placeholder:  string;
  handle:       string;
  labelSuffix?: React.ReactNode;
  onUpdated:    (handle: string | null) => void;
}) {
  const [editing,       setEditing]       = useState(false);
  const [currentHandle, setCurrentHandle] = useState(handle);

  function handleSaved(val: string | null) {
    setCurrentHandle(val ?? '');
    setEditing(false);
    onUpdated(val);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: iconColor, letterSpacing: '0.04em', flexShrink: 0 }}>
        {icon}
      </div>
      {editing ? (
        <HandleEditor provider={provider} currentHandle={currentHandle} label={label} placeholder={placeholder} onSaved={handleSaved} />
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#A8C8D8', margin: 0 }}>{label}</p>
            {labelSuffix}
          </div>
          {currentHandle
            ? <p style={{ fontSize: 12, color: C.cyan, margin: 0 }}>@{currentHandle}</p>
            : <p style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic', margin: 0 }}>Not connected</p>
          }
        </div>
      )}
      {!editing && (
        <button
          style={{ background: currentHandle ? 'transparent' : 'rgba(94,211,234,0.06)', border: `1px solid ${currentHandle ? C.border : C.borderMid}`, borderRadius: 6, padding: '5px 12px', color: currentHandle ? C.textLabel : C.cyan, fontSize: 10, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: 'inherit', flexShrink: 0 }}
          onClick={() => setEditing(true)}
        >
          {currentHandle ? 'Edit' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// ── ForumRow ──────────────────────────────────────────────────────────────────

function ForumRow({ handle, onUpdated }: { handle: string; onUpdated: (h: string | null) => void }) {
  const [editing,       setEditing]       = useState(false);
  const [currentHandle, setCurrentHandle] = useState(handle);
  const [draft,         setDraft]         = useState(handle);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');
  const [confirming,    setConfirming]    = useState(false);

  async function save() {
    const value = draft.replace(/^@/, '').trim();
    setSaving(true); setErr('');
    try {
      const res  = await fetch('/api/me/accounts/forum', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: value }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Update failed.'); return; }
      setCurrentHandle(value); onUpdated(value); setEditing(false);
    } catch { setErr('Network error.'); }
    finally  { setSaving(false); }
  }

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch('/api/me/accounts/forum', { method: 'DELETE' });
      if (!res.ok) { setErr('Remove failed.'); return; }
      setCurrentHandle(''); onUpdated(null); setEditing(false); setConfirming(false);
    } catch { setErr('Network error.'); } finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.gold, letterSpacing: '0.04em', flexShrink: 0 }}>GOV</div>
      {editing ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {confirming ? (
            <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 12, color: C.red, margin: '0 0 10px', fontWeight: 600 }}>Remove Forum connection?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={remove} disabled={saving} style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '6px 14px', color: C.red, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                  {saving ? 'Removing…' : 'Remove'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={saving} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', color: C.textLabel, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
              {err && <p style={{ fontSize: 12, color: C.red, margin: '8px 0 0' }}>{err}</p>}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="forum-username"
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setDraft(currentHandle); } }}
                  style={{ flex: 1, background: C.bg, border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={save} disabled={saving} style={{ background: 'rgba(94,211,234,0.12)', border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 14px', color: C.cyan, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setEditing(false); setDraft(currentHandle); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
              </div>
              {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
              {currentHandle && <button onClick={() => setConfirming(true)} style={{ background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>Remove Forum</button>}
            </>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#A8C8D8', margin: 0 }}>DUAL Forum</p>
          {currentHandle
            ? <p style={{ fontSize: 12, color: C.cyan, margin: 0 }}>{currentHandle}</p>
            : <p style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic', margin: 0 }}>Not connected</p>
          }
        </div>
      )}
      {!editing && (
        <button style={{ background: currentHandle ? 'transparent' : 'rgba(94,211,234,0.06)', border: `1px solid ${currentHandle ? C.border : C.borderMid}`, borderRadius: 6, padding: '5px 12px', color: currentHandle ? C.textLabel : C.cyan, fontSize: 10, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: 'inherit', flexShrink: 0 }}
          onClick={() => { setDraft(currentHandle); setEditing(true); }}>
          {currentHandle ? 'Edit' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function MePage() {
  const [data,       setData]       = useState<MeData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [actLoading, setActLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    try {
      const res = await fetch('/api/me/activity');
      if (res.ok) { const j = await res.json(); setActivities(j.activities ?? []); }
    } finally { setActLoading(false); }
  }, []);

  useEffect(() => { load(); },        [load]);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function getHandle(source: string) {
    return data?.accounts.find(a => a.source === source)?.handle ?? '';
  }

  function updateHandle(source: string, val: string | null) {
    setData(prev => {
      if (!prev) return prev;
      const accounts = val
        ? prev.accounts.some(a => a.source === source)
          ? prev.accounts.map(a => a.source === source ? { ...a, handle: val } : a)
          : [...prev.accounts, { id: '', source, handle: val, externalUserId: val.toLowerCase(), xResolvedAt: null, requiresReview: false, verifiedAt: null }]
        : prev.accounts.filter(a => a.source !== source);
      return { ...prev, accounts };
    });
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(94,211,234,0.12)', borderTop: `2px solid ${C.cyan}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: C.textLabel, fontSize: 13, letterSpacing: '0.1em' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { badge }  = data;
  const tier       = badge?.cachedTier ?? 'INITIATE';
  const score      = badge?.signalScore ?? 0;
  const tierColor  = TIER_COLOR[tier] ?? C.cyan;
  const nextTier   = BUTTERFLY_TIERS.find(t => t.minScore > score);
  const ptsToNext  = nextTier ? nextTier.minScore - score : 0;
  const forumAccount = data.accounts.find(a => a.source === 'DUAL_FORUM');

  const levelUpChannels = badge ? [
    {
      key: 'x', icon: '𝕏', label: 'X Signal', color: '#E8F4FC',
      level: badge.xSignalLevel, levels: X_LEVELS,
      nextStep: badge.xSignalLevel === 0
        ? 'Post on X mentioning DUAL or SIGNAL with relevant keywords. Your first qualifying post earns 50 pts and unlocks FIRST_SIGNAL.'
        : badge.xSignalLevel >= 5 ? null
        : (() => { const n = X_LEVELS[badge.xSignalLevel]; return `Keep posting qualifying X content to reach ${n.name} (Level ${n.level}) and earn ${n.points} pts.`; })(),
    },
    {
      key: 'tg', icon: 'TG', label: 'Telegram', color: '#5ED3EA',
      level: badge.telegramLevel, levels: TG_LEVELS,
      nextStep: badge.telegramLevel === 0
        ? 'Send a message in the DUAL Telegram group. Just 1 active day earns your first 50 pts (FIRST_CONTACT).'
        : badge.telegramLevel >= 5 ? null
        : (() => { const n = TG_LEVELS[badge.telegramLevel]; const r = n.activeDays - badge.telegramActiveDays; return `${r} more active day${r !== 1 ? 's' : ''} in DUAL Telegram to reach Level ${n.level} (${n.name}) and earn ${n.points} pts. You have ${badge.telegramActiveDays} of ${n.activeDays} needed.`; })(),
    },
    {
      key: 'dc', icon: 'DC', label: 'Discord', color: '#7B83EB',
      level: badge.discordLevel, levels: DC_LEVELS,
      nextStep: badge.discordLevel === 0
        ? 'Participate in the DUAL Discord server. Your first active day earns 50 pts (FIRST_CONTACT).'
        : badge.discordLevel >= 5 ? null
        : (() => { const n = DC_LEVELS[badge.discordLevel]; const r = n.activeDays - badge.discordActiveDays; return `${r} more active day${r !== 1 ? 's' : ''} in DUAL Discord to reach Level ${n.level} (${n.name}) and earn ${n.points} pts. You have ${badge.discordActiveDays} of ${n.activeDays} needed.`; })(),
    },
    {
      key: 'gov', icon: 'GOV', label: 'Governance', color: C.gold,
      level: badge.governanceLevel, levels: GOV_LEVELS,
      nextStep: badge.governanceLevel === 0
        ? 'Join the DUAL governance forum and comment on a topic or vote on a proposal. Just 10 activity points earns your first 50 pts (FIRST_VOICE).'
        : badge.governanceLevel >= 5 ? null
        : (() => { const n = GOV_LEVELS[badge.governanceLevel]; const r = n.activityPoints - badge.governanceActivityPoints; return `${r} more governance activity point${r !== 1 ? 's' : ''} to reach Level ${n.level} (${n.name}) and earn ${n.points} pts. Post topics, comment on proposals, or vote to accumulate points.`; })(),
    },
  ] : [];

  // Channel data for the breakdown grid
  const channels = badge ? [
    {
      key: 'x', icon: '𝕏', label: 'X Signal', color: '#E8F4FC',
      level: badge.xSignalLevel,
      levelName: X_LEVELS[badge.xSignalLevel - 1]?.name,
      pts: X_LEVELS[badge.xSignalLevel - 1]?.points ?? 0,
      metric: badge.xSignalLevel > 0
        ? `${badge.xQualifyingPosts} qualifying post${badge.xQualifyingPosts !== 1 ? 's' : ''} · ${Number(badge.xSignalPublicViews).toLocaleString()} views`
        : 'No qualifying posts yet',
    },
    {
      key: 'tg', icon: 'TG', label: 'Telegram', color: '#5ED3EA',
      level: badge.telegramLevel,
      levelName: TG_LEVELS[badge.telegramLevel - 1]?.name,
      pts: TG_LEVELS[badge.telegramLevel - 1]?.points ?? 0,
      metric: badge.telegramActiveDays > 0
        ? `${badge.telegramActiveDays} active day${badge.telegramActiveDays !== 1 ? 's' : ''}`
        : 'No activity yet',
    },
    {
      key: 'dc', icon: 'DC', label: 'Discord', color: '#7B83EB',
      level: badge.discordLevel,
      levelName: DC_LEVELS[badge.discordLevel - 1]?.name,
      pts: DC_LEVELS[badge.discordLevel - 1]?.points ?? 0,
      metric: badge.discordActiveDays > 0
        ? `${badge.discordActiveDays} active day${badge.discordActiveDays !== 1 ? 's' : ''}`
        : 'No activity yet',
    },
    {
      key: 'gov', icon: 'GOV', label: 'Governance', color: C.gold,
      level: badge.governanceLevel,
      levelName: GOV_LEVELS[badge.governanceLevel - 1]?.name,
      pts: GOV_LEVELS[badge.governanceLevel - 1]?.points ?? 0,
      metric: badge.governanceActivityPoints > 0
        ? `${badge.governanceActivityPoints} activity pts · ${badge.governanceVotes} vote${badge.governanceVotes !== 1 ? 's' : ''}`
        : 'No forum activity yet',
    },
  ] : [];

  const btnOutline: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    padding: '10px 20px', borderRadius: 9,
    border: `1px solid ${C.borderMid}`, color: C.textLabel,
    textDecoration: 'none', cursor: 'pointer', background: 'transparent',
  };
  const btnPrimary: React.CSSProperties = {
    ...btnOutline,
    background: C.cyanDim, borderColor: 'transparent', color: '#fff',
    padding: '13px 28px', borderRadius: 10, fontSize: 12,
  };
  const card: React.CSSProperties = {
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px',
  };
  const eyebrow: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.28em',
    color: C.cyan, textTransform: 'uppercase' as const, display: 'block', marginBottom: 10,
  };
  const sectionH2: React.CSSProperties = {
    fontSize: 28, fontWeight: 800, color: '#E8F4FC',
    letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 32,
  };
  const metaLbl: React.CSSProperties = {
    fontSize: 9, letterSpacing: '0.18em', color: C.textLabel,
    textTransform: 'uppercase' as const, marginBottom: 3, display: 'block',
  };
  const metaVal: React.CSSProperties = {
    fontSize: 13, color: '#7AABBF', marginBottom: 14, display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        .ds-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
        .ds-ch-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .ds-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
        .ds-sec { padding: 80px 64px; }
        @media (max-width: 1024px) {
          .ds-hero, .ds-ch-grid, .ds-2col { grid-template-columns: 1fr; }
          .ds-sec { padding: 60px 24px; }
        }
        @media (max-width: 640px) { .ds-sec { padding: 40px 16px; } }
        a.ds-btn:hover { opacity: 0.82; }
        @media (max-width: 768px) {
          .ds-nav { padding: 0 20px !important; }
          .ds-nav-extra { display: none !important; }
          .ds-hero-wrap { padding: 80px 20px 48px !important; }
          .ds-score { font-size: 60px !important; }
        }
        @media (max-width: 480px) {
          .ds-nav { padding: 0 16px !important; }
          .ds-hero-wrap { padding: 64px 16px 40px !important; }
          .ds-score { font-size: 48px !important; }
          .ds-footer { padding: 16px !important; flex-direction: column !important; gap: 6px !important; }
        }
      `}</style>

      {/* ── Nav ── */}
      <header className="ds-nav" style={{
        background: 'rgba(4,14,26,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`, padding: '0 48px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100,
      }}>
        <a href="/" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.22em', color: '#E8F4FC', textTransform: 'uppercase' as const, textDecoration: 'none' }}>
          DUAL <span style={{ color: C.cyan }}>//</span> SIGNAL
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span className="ds-nav-extra" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(94,211,234,0.4)', textTransform: 'uppercase' as const, border: '1px solid rgba(94,211,234,0.14)', borderRadius: 4, padding: '3px 8px' }}>ALPHA</span>
          <a href="/leaderboard" className="ds-nav-extra" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: C.textMuted, textDecoration: 'none', textTransform: 'uppercase' as const }}>Leaderboard</a>
          {badge && (
            <a href={`/badge/${badge.dualObjectId}`} className="ds-nav-extra" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: C.textMuted, textDecoration: 'none', textTransform: 'uppercase' as const }}>
              My Passport
            </a>
          )}
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid rgba(94,211,234,0.14)', borderRadius: 8, padding: '8px 16px', color: '#3A5A6A', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: 'inherit' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Hero: Score + Identity ── */}
      <div style={{ background: 'radial-gradient(ellipse 1100px 700px at 50% -80px, rgba(14,180,208,0.07) 0%, transparent 65%)', padding: '128px 64px 72px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }} className="ds-hero">

          {/* Score left — or getting-started when no badge */}
          <div>
            {badge ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                  <span style={{ display: 'block', width: 24, height: 1, background: 'rgba(94,211,234,0.3)' }} />
                  <span style={eyebrow}>Your Signal</span>
                  <span style={{ display: 'block', width: 24, height: 1, background: 'rgba(94,211,234,0.3)' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
                  <span className="ds-score" style={{ fontSize: 88, fontWeight: 900, letterSpacing: '-0.05em', color: '#F0F8FC', lineHeight: 1, fontVariantNumeric: 'tabular-nums' as const }}>
                    {score.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 18, color: C.textDim, fontWeight: 700, letterSpacing: '0.04em', paddingBottom: 10 }}>/ 1000</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: tierColor }}>{tier}</span>
                  {nextTier
                    ? <span style={{ fontSize: 12, color: C.textMuted }}>· {ptsToNext} pts to {nextTier.name}</span>
                    : <span style={{ fontSize: 12, color: C.green }}>· MAX TIER</span>
                  }
                </div>
                <p style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 28 }}>
                  Score synced · {timeAgo(badge.updatedAt)}
                </p>

                <div style={{ marginBottom: 36 }}>
                  <TierBar tier={tier} />
                </div>

                <a href={`/badge/${badge.dualObjectId}`} className="ds-btn" style={btnPrimary}>
                  View Passport →
                </a>
              </>
            ) : (
              /* ── No passport yet — getting started ── */
              <>
                <span style={eyebrow}>Get Started</span>
                <h1 style={{ fontSize: 32, fontWeight: 900, color: '#E8F4FC', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 10 }}>
                  Build your<br /><span style={{ color: C.cyan }}>SIGNAL score</span>
                </h1>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, marginBottom: 32, maxWidth: 380 }}>
                  Mint your Passport to start tracking SIGNAL. Connect your accounts and earn up to 1,000 points across four channels.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 36 }}>
                  {[
                    { done: true,  label: 'Create account' },
                    { done: false, label: 'Mint your Passport', cta: '/join' },
                    { done: false, label: 'Connect X, Telegram, Discord & Forum' },
                    { done: false, label: 'Earn SIGNAL through community activity' },
                  ].map(step => (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: step.done ? 'rgba(74,200,154,0.12)' : 'rgba(94,211,234,0.06)', border: `1px solid ${step.done ? 'rgba(74,200,154,0.35)' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: step.done ? C.green : C.textDim }}>
                        {step.done ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 13, color: step.done ? C.green : '#A8C8D8', fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
                    </div>
                  ))}
                </div>

                <a href="/join" className="ds-btn" style={btnPrimary}>
                  Mint Passport →
                </a>
              </>
            )}
          </div>

          {/* Identity card right */}
          <div style={{ position: 'relative' as const, overflow: 'hidden' as const, background: 'rgba(7,21,37,0.65)', border: `1px solid rgba(94,211,234,0.1)`, borderRadius: 20, padding: '36px 36px 32px' }}>
            <Image
              src="/assets/dual-signal/ui/Signal-butterfly.png"
              alt="" aria-hidden={true} width={220} height={220}
              style={{ position: 'absolute' as const, right: -40, bottom: -40, opacity: 0.1, filter: 'saturate(0.1) brightness(0.6)', pointerEvents: 'none' as const, userSelect: 'none' as const }}
            />
            <span style={{ ...eyebrow, marginBottom: 6 }}>Welcome Back</span>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#E8F4FC', letterSpacing: '-0.02em', margin: '0 0 16px', lineHeight: 1.05 }}>
              {data.username ?? data.email}
            </h1>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 28 }}>
              {badge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.green, background: 'rgba(74,200,154,0.08)', border: '1px solid rgba(74,200,154,0.2)', borderRadius: 6, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.06em' }}>
                  ✓ Passport Minted
                </span>
              )}
              {badge?.isOG && (
                <span style={{ fontSize: 10, letterSpacing: '0.14em', color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.25)', borderRadius: 4, padding: '3px 8px', fontWeight: 700 }}>OG</span>
              )}
              {badge?.isGenesis && (
                <span style={{ fontSize: 10, letterSpacing: '0.14em', color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.25)', borderRadius: 4, padding: '3px 8px', fontWeight: 700 }}>GENESIS</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
              {badge?.memberSince && (
                <div>
                  <span style={metaLbl}>Member Since</span>
                  <span style={{ ...metaVal, fontFamily: 'inherit' }}>{badge.memberSince}</span>
                </div>
              )}
              <div>
                <span style={metaLbl}>Chain</span>
                <span style={{ ...metaVal, fontFamily: 'inherit' }}>DUAL · 6301</span>
              </div>
              {badge && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={metaLbl}>Object ID</span>
                  <span style={{ ...metaVal, fontFamily: 'monospace', fontSize: 12 }}>
                    {badge.dualObjectId.length > 20 ? `${badge.dualObjectId.slice(0, 10)}···${badge.dualObjectId.slice(-8)}` : badge.dualObjectId}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid rgba(94,211,234,0.06)`, margin: 0 }} />

      {/* ── Signal Breakdown 2×2 grid ── */}
      {badge && (
        <div className="ds-sec">
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <span style={eyebrow}>Signal Breakdown</span>
            <h2 style={sectionH2}>How You Earned Points</h2>

            <div className="ds-ch-grid">
              {channels.map(ch => (
                <div key={ch.key} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: ch.color, letterSpacing: '0.04em', flexShrink: 0 }}>
                      {ch.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#E8F4FC', letterSpacing: '-0.01em' }}>{ch.label}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                        {ch.level > 0 ? `Level ${ch.level} · ${ch.levelName}` : 'Level 0 · Not started'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: ch.level > 0 ? '#E8F4FC' : C.textDim, fontVariantNumeric: 'tabular-nums' as const, letterSpacing: '-0.02em' }}>
                        {ch.level > 0 ? `+${ch.pts}` : '—'}
                      </div>
                      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>PTS</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map(l => (
                      <div key={l} style={{ flex: 1, height: 4, borderRadius: 2, background: l <= ch.level ? ch.color : 'rgba(94,211,234,0.1)', opacity: l <= ch.level ? 0.75 : 1 }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{ch.metric}</div>
                </div>
              ))}
            </div>

            {(badge.isOG || badge.isGenesis) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {badge.isOG     && <span style={{ fontSize: 11, color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.2)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>OG Bonus</span>}
                {badge.isGenesis && <span style={{ fontSize: 11, color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.2)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>Genesis Bonus</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {badge && <hr style={{ border: 'none', borderTop: `1px solid rgba(94,211,234,0.06)`, margin: 0 }} />}

      {/* ── Activity + Next Steps (two-column) ── */}
      {badge && (
        <div className="ds-sec">
          <div style={{ maxWidth: 1200, margin: '0 auto' }} className="ds-2col">

            {/* Recent Activity */}
            <div>
              <span style={eyebrow}>Timeline</span>
              <h2 style={sectionH2}>Recent Activity</h2>
              <div style={card}>
                {actLoading && <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center' as const, padding: '16px 0' }}>Loading…</p>}
                {!actLoading && activities.length === 0 && (
                  <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center' as const, padding: '16px 0' }}>No activity recorded yet.</p>
                )}
                {activities.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < activities.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(94,211,234,0.04)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: SOURCE_COLOR[a.source], letterSpacing: '0.04em', flexShrink: 0 }}>
                      {SOURCE_ICON[a.source]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#A8C8D8', fontWeight: 500 }}>{a.label}</div>
                      {a.detail && <div style={{ fontSize: 11, color: C.textMuted }}>{a.detail}</div>}
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, flexShrink: 0, textAlign: 'right' as const }}>{fmtDate(a.date)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <span style={eyebrow}>Progression</span>
              <h2 style={sectionH2}>Next Steps</h2>
              <div style={card}>
                {levelUpChannels.every(ch => ch.level >= 5) && (
                  <div style={{ fontSize: 13, color: C.green, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span>✓</span> All channels at max level.
                  </div>
                )}
                {levelUpChannels.map((ch, ci) => (
                  <div key={ch.key} style={{ paddingBottom: 18, marginBottom: ci < levelUpChannels.length - 1 ? 18 : 0, borderBottom: ci < levelUpChannels.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: ch.color }}>
                        {ch.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#A8C8D8' }}>{ch.label}</span>
                          <span style={{ fontSize: 10, color: '#6A8A9A' }}>{ch.level > 0 ? `Level ${ch.level} / 5` : 'Level 0 / 5'}</span>
                          {ch.level >= 5 && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.green, background: 'rgba(74,200,154,0.08)', border: '1px solid rgba(74,200,154,0.2)', borderRadius: 4, padding: '1px 6px' }}>MAX</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1, 2, 3, 4, 5].map(l => (
                            <div key={l} style={{ flex: 1, height: 4, borderRadius: 2, background: l <= ch.level ? ch.color : 'rgba(94,211,234,0.07)', opacity: l <= ch.level ? 0.75 : 1 }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: ch.level > 0 ? '#E8F4FC' : C.textDim }}>{ch.level > 0 ? `+${ch.levels[ch.level - 1]?.points ?? 0}` : '—'}</div>
                        <div style={{ fontSize: 9, color: '#6A8A9A', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>PTS</div>
                      </div>
                    </div>
                    {ch.nextStep && (
                      <div style={{ borderLeft: `2px solid ${ch.color}`, paddingLeft: 12, marginLeft: 42, fontSize: 11, color: C.text, lineHeight: 1.65 }}>
                        <span style={{ fontWeight: 700, color: ch.color }}>Next → </span>
                        {ch.nextStep}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {badge && <hr style={{ border: 'none', borderTop: `1px solid rgba(94,211,234,0.06)`, margin: 0 }} />}

      {/* ── Connected Identities + Passport (two-column) ── */}
      <div className="ds-sec">
        <div style={{ maxWidth: 1200, margin: '0 auto' }} className="ds-2col">

          {/* Connected Identities */}
          <div>
            <span style={eyebrow}>Connections</span>
            <h2 style={sectionH2}>Connected Identities</h2>
            <div style={card}>
              <AccountRow
                provider="x" icon="𝕏" iconColor="#E8F4FC" label="X (Twitter)" placeholder="@username"
                handle={badge?.xHandle ?? getHandle('TWITTER')}
                onUpdated={val => {
                  updateHandle('TWITTER', val);
                  setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, xHandle: val ?? '' } } : prev);
                }}
              />
              <AccountRow
                provider="telegram" icon="TG" iconColor="#5ED3EA" label="Telegram" placeholder="@username"
                handle={badge?.telegramHandle ?? getHandle('TELEGRAM')}
                onUpdated={val => {
                  updateHandle('TELEGRAM', val);
                  setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, telegramHandle: val ?? '' } } : prev);
                }}
              />
              <AccountRow
                provider="discord" icon="DC" iconColor="#7B83EB" label="Discord" placeholder="username"
                handle={badge?.discordHandle ?? getHandle('DISCORD')}
                labelSuffix={badge && badge.discordActiveDays > 0
                  ? <span style={{ fontSize: 9, letterSpacing: '0.14em', color: C.cyan, textTransform: 'uppercase' as const, fontWeight: 600 }}>
                      {badge.discordLevel > 0 ? `Lvl ${badge.discordLevel} · ` : ''}{badge.discordActiveDays} day{badge.discordActiveDays !== 1 ? 's' : ''}
                    </span>
                  : undefined}
                onUpdated={val => {
                  updateHandle('DISCORD', val);
                  setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, discordHandle: val ?? '' } } : prev);
                }}
              />
              <ForumRow handle={forumAccount?.handle ?? ''} onUpdated={val => updateHandle('DUAL_FORUM', val)} />
            </div>
          </div>

          {/* DUAL Passport + Wallet */}
          <div>
            <span style={eyebrow}>On-Chain Identity</span>
            <h2 style={sectionH2}>DUAL Passport</h2>
            <div style={card}>
              {badge ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 22 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.green, background: 'rgba(74,200,154,0.08)', border: '1px solid rgba(74,200,154,0.2)', borderRadius: 6, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.06em' }}>✓ Minted</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.cyan, background: 'rgba(94,211,234,0.06)', border: `1px solid rgba(94,211,234,0.18)`, borderRadius: 6, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.06em' }}>Active on DUAL</span>
                  </div>
                  <span style={metaLbl}>Object ID</span>
                  <span style={{ ...metaVal, fontFamily: 'monospace', fontSize: 12 }}>{badge.dualObjectId}</span>
                  {badge.memberSince && (
                    <>
                      <span style={metaLbl}>Member Since</span>
                      <span style={{ ...metaVal, fontFamily: 'inherit', marginBottom: 24 }}>{badge.memberSince}</span>
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                    <a href={`/badge/${badge.dualObjectId}`} className="ds-btn" style={btnPrimary}>View Passport →</a>
                    <a href={`https://explorer.dual.network/objects/${badge.dualObjectId}`} target="_blank" rel="noreferrer" className="ds-btn" style={btnOutline}>
                      View on DUAL →
                    </a>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' as const, padding: '16px 0' }}>
                  <p style={{ color: C.textDim, fontSize: 13, marginBottom: 16 }}>You haven&apos;t minted your Passport yet.</p>
                  <a href="/join" className="ds-btn" style={btnPrimary}>Mint Passport →</a>
                </div>
              )}
            </div>

            {/* Wallet coming soon */}
            <div style={{ marginTop: 16, background: 'rgba(7,21,37,0.4)', border: `1px dashed rgba(94,211,234,0.12)`, borderRadius: 12, padding: '20px 24px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: C.textDim, display: 'block', marginBottom: 5 }}>Coming Soon</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 5 }}>DUAL Wallet Integration</span>
              <span style={{ fontSize: 11, color: C.textDim, lineHeight: 1.65, display: 'block' }}>Your SIGNAL Passport and reputation will continue building in the meantime.</span>
            </div>
          </div>

        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `1px solid rgba(94,211,234,0.06)`, margin: 0 }} />

      {/* ── Account ── */}
      <div className="ds-sec" style={{ paddingBottom: 96 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <span style={eyebrow}>Settings</span>
          <div style={{ ...card, maxWidth: 480, marginTop: 20 }}>
            <span style={metaLbl}>Email</span>
            <span style={{ ...metaVal, fontFamily: 'inherit' }}>{data.email}</span>
            {data.username && (
              <>
                <span style={metaLbl}>SIGNAL Username</span>
                <span style={{ ...metaVal, fontFamily: 'inherit', color: C.cyan, fontWeight: 600 }}>{data.username}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="ds-footer" style={{ borderTop: `1px solid rgba(94,211,234,0.06)`, padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: '#1A2E3A' }}>
          DUAL <span style={{ color: '#1E3A4A' }}>//</span> SIGNAL
        </span>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#12202C' }}>
          DUAL Network · Chain 6301
        </span>
      </footer>

    </div>
  );
}
