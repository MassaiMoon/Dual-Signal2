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

// ── Signal gauge ──────────────────────────────────────────────────────────────
// 270° arc: r=78, starts bottom-left, sweeps CW to bottom-right
// circumference of 270° = 2π*78 * 0.75 ≈ 367.57; remaining 90° ≈ 122.52

const GAUGE_R    = 78;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;
const GAUGE_ARC  = GAUGE_CIRC * 0.75; // 270° portion
const GAUGE_GAP  = GAUGE_CIRC * 0.25; // 90° gap

function SignalGauge({ score, tier }: { score: number; tier: string }) {
  const fill       = (score / 1000) * GAUGE_ARC;
  const tierColor  = TIER_COLOR[tier] ?? C.cyan;
  const nextTier   = BUTTERFLY_TIERS.find(t => t.minScore > score);
  const ptsToNext  = nextTier ? nextTier.minScore - score : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 200 180" width="180" height="162" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="gauge-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0EB4D0" />
            <stop offset="100%" stopColor={tierColor} />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx="100" cy="100" r={GAUGE_R}
          fill="none"
          stroke="rgba(94,211,234,0.07)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${GAUGE_ARC} ${GAUGE_GAP}`}
          transform="rotate(135, 100, 100)"
        />
        {/* Score fill */}
        {score > 0 && (
          <circle
            cx="100" cy="100" r={GAUGE_R}
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${GAUGE_CIRC}`}
            transform="rotate(135, 100, 100)"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        )}
        {/* Center: score */}
        <text x="100" y="90" textAnchor="middle" fontSize="38" fontWeight="700" fill="#E8F4FC" fontFamily="inherit">
          {score.toLocaleString()}
        </text>
        <text x="100" y="110" textAnchor="middle" fontSize="10" fill={C.textMuted} letterSpacing="3" fontFamily="inherit">
          SIGNAL
        </text>
      </svg>

      {/* Tier badge */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
        color: tierColor, background: `${tierColor}18`,
        border: `1px solid ${tierColor}40`,
        borderRadius: 6, padding: '4px 14px',
        textTransform: 'uppercase' as const,
        marginBottom: 12,
      }}>
        {tier}
      </div>

      {/* Pts to next tier */}
      {nextTier ? (
        <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' as const }}>
          <span style={{ color: C.text, fontWeight: 600 }}>{ptsToNext}</span>
          {' '}pts to{' '}
          <span style={{ color: TIER_COLOR[nextTier.name] ?? C.cyan }}>{nextTier.name}</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.green, fontWeight: 600, letterSpacing: '0.1em' }}>
          ✓ MAX TIER — LEGEND
        </div>
      )}
    </div>
  );
}

// ── Tier progression bar ──────────────────────────────────────────────────────

function TierBar({ tier }: { tier: string }) {
  const currentIdx = BUTTERFLY_TIERS.findIndex(t => t.name === tier);
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '0.18em', color: C.textLabel, textTransform: 'uppercase' as const, marginBottom: 8 }}>
        Tier Progression
      </p>
      <div style={{ display: 'flex', gap: 3 }}>
        {BUTTERFLY_TIERS.map((t, i) => {
          const isActive  = t.name === tier;
          const isPast    = i < currentIdx;
          const color     = TIER_COLOR[t.name] ?? C.cyan;
          return (
            <div key={t.name} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
              <div style={{
                height:       5,
                width:        '100%',
                borderRadius: 3,
                background:   isPast || isActive ? color : 'rgba(94,211,234,0.07)',
                border:       isPast || isActive ? 'none' : `1px solid ${C.border}`,
                opacity:      isPast ? 0.5 : 1,
              }} />
              <span style={{
                fontSize:      7,
                letterSpacing: '0.08em',
                color:         isActive ? color : C.textDim,
                fontWeight:    isActive ? 700 : 400,
                whiteSpace:    'nowrap' as const,
                textTransform: 'uppercase' as const,
              }}>
                {t.name === 'STAKEHOLDER' ? 'S.HOLDER' : t.name}
              </span>
            </div>
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
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(currentHandle);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

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
    if (!window.confirm(`Remove your ${label} connection?`)) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch(`/api/me/accounts/${provider}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Remove failed.'); return; }
      onSaved(null); setEditing(false); setDraft('');
    } catch { setErr('Network error. Please try again.'); }
    finally  { setSaving(false); }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
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
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setDraft(currentHandle); setErr(''); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
        {currentHandle && (
          <button onClick={remove} disabled={saving} style={{ background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>
            Remove {label}
          </button>
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
  provider, icon, label, placeholder, handle, labelSuffix, onUpdated,
}: {
  provider:     string;
  icon:         string;
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

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderBottom: `1px solid ${C.border}`, gap: 12,
  };
  const iconStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 8,
    background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: '0.04em', flexShrink: 0,
  };

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={iconStyle}>{icon}</div>
        {editing ? (
          <HandleEditor provider={provider} currentHandle={currentHandle} label={label} placeholder={placeholder} onSaved={handleSaved} />
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#A8C8D8', marginBottom: 0 }}>{label}</p>
              {labelSuffix}
            </div>
            {currentHandle
              ? <p style={{ fontSize: 12, color: C.cyan }}>@{currentHandle}</p>
              : <p style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Not connected</p>
            }
          </div>
        )}
      </div>
      {!editing && (
        <button
          style={{ background: currentHandle ? 'transparent' : 'rgba(94,211,234,0.06)', border: `1px solid ${currentHandle ? C.border : 'rgba(94,211,234,0.15)'}`, borderRadius: 6, padding: '5px 12px', color: currentHandle ? C.textLabel : C.cyan, fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'inherit', flexShrink: 0 }}
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
    if (!window.confirm('Remove your DUAL Forum connection?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/me/accounts/forum', { method: 'DELETE' });
      if (!res.ok) return;
      setCurrentHandle(''); onUpdated(null); setEditing(false);
    } catch { /**/ } finally { setSaving(false); }
  }

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: 'none', gap: 12 };
  const iconStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: '0.04em', flexShrink: 0 };

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={iconStyle}>GOV</div>
        {editing ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="forum-username"
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setDraft(currentHandle); } }}
                style={{ flex: 1, background: C.bg, border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={save} disabled={saving} style={{ background: 'rgba(94,211,234,0.12)', border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 14px', color: C.cyan, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{saving ? '…' : 'Save'}</button>
              <button onClick={() => { setEditing(false); setDraft(currentHandle); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
            </div>
            {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
            {currentHandle && <button onClick={remove} style={{ background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>Remove Forum</button>}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#A8C8D8', marginBottom: 2 }}>DUAL Forum</p>
            {currentHandle ? <p style={{ fontSize: 12, color: C.cyan }}>{currentHandle}</p> : <p style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Not connected</p>}
          </div>
        )}
      </div>
      {!editing && (
        <button style={{ background: currentHandle ? 'transparent' : 'rgba(94,211,234,0.06)', border: `1px solid ${currentHandle ? C.border : 'rgba(94,211,234,0.15)'}`, borderRadius: 6, padding: '5px 12px', color: currentHandle ? C.textLabel : C.cyan, fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'inherit', flexShrink: 0 }}
          onClick={() => { setDraft(currentHandle); setEditing(true); }}>
          {currentHandle ? 'Edit' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// ── Shared card style ─────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: C.bgCard, border: `1px solid ${C.border}`,
  borderRadius: 16, padding: '28px 28px',
  marginBottom: 16,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
  color: C.textDim, textTransform: 'uppercase' as const,
  marginBottom: 20, display: 'block',
};
const metaLabel: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.16em', color: C.textLabel,
  textTransform: 'uppercase' as const, marginBottom: 2,
};
const metaValue: React.CSSProperties = {
  fontSize: 12, color: '#7AABBF', fontFamily: 'monospace',
  wordBreak: 'break-all' as const, marginBottom: 12,
};
const viewPassportBtn: React.CSSProperties = {
  display: 'inline-block', padding: '10px 20px',
  background: 'rgba(94,211,234,0.08)', border: `1px solid rgba(94,211,234,0.18)`,
  borderRadius: 8, color: C.cyan, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase' as const,
  textDecoration: 'none', cursor: 'pointer',
};

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
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(94,211,234,0.12)', borderTop: `2px solid ${C.cyan}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: C.textLabel, fontSize: 13, letterSpacing: '0.1em' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { badge } = data;
  const tier      = badge?.cachedTier ?? 'INITIATE';
  const score     = badge?.signalScore ?? 0;
  const forumAccount = data.accounts.find(a => a.source === 'DUAL_FORUM');

  // How to Level Up channels
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
      key: 'gov', icon: 'GOV', label: 'Governance', color: '#F7C873',
      level: badge.governanceLevel, levels: GOV_LEVELS,
      nextStep: badge.governanceLevel === 0
        ? 'Join the DUAL governance forum and comment on a topic or vote on a proposal. Just 10 activity points earns your first 50 pts (FIRST_VOICE).'
        : badge.governanceLevel >= 5 ? null
        : (() => { const n = GOV_LEVELS[badge.governanceLevel]; const r = n.activityPoints - badge.governanceActivityPoints; return `${r} more governance activity point${r !== 1 ? 's' : ''} to reach Level ${n.level} (${n.name}) and earn ${n.points} pts. Post topics, comment on proposals, or vote to accumulate points.`; })(),
    },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        .ds-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 720px) { .ds-hero { grid-template-columns: 1fr; } }
        .ds-gauge-card { display: flex; flex-direction: column; align-items: center; justify-content: center; }
        a.ds-passport-btn:hover { opacity: 0.85; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: '#050F1C', borderBottom: `1px solid ${C.border}`,
        padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky' as const, top: 0, zIndex: 50,
      }}>
        <a href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.2em', color: '#E8F4FC', textTransform: 'uppercase' as const, textDecoration: 'none' }}>
          DUAL <span style={{ color: C.cyan }}>//</span> SIGNAL
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(94,211,234,0.45)', textTransform: 'uppercase' as const, border: '1px solid rgba(94,211,234,0.15)', borderRadius: 4, padding: '3px 8px' }}>
            Alpha
          </span>
          <a href="/leaderboard" style={{ fontSize: 11, letterSpacing: '0.14em', color: C.textMuted, textDecoration: 'none', textTransform: 'uppercase' as const }}>Leaderboard</a>
          {badge && (
            <a href={`/badge/${badge.dualObjectId}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, letterSpacing: '0.14em', color: C.textMuted, textDecoration: 'none', textTransform: 'uppercase' as const }}>
              My Passport
            </a>
          )}
          <button onClick={logout} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 14px', color: C.textMuted, fontSize: 11, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: 'inherit' }}>
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* ── S01 + S02: Hero ── */}
        <div className="ds-hero" style={{ marginBottom: 16 }}>

          {/* S01: Signal gauge */}
          <div style={{ ...card, marginBottom: 0 }} className="ds-gauge-card">
            <span style={{ ...sectionTitle, marginBottom: 24 }}>Your Signal</span>
            <SignalGauge score={score} tier={tier} />
            {badge ? (
              <a href={`/badge/${badge.dualObjectId}`} className="ds-passport-btn" style={{ ...viewPassportBtn, marginTop: 24, display: 'inline-block' }}>
                View Passport →
              </a>
            ) : (
              <a href="/join" style={{ ...viewPassportBtn, marginTop: 24, background: C.cyanDim, border: 'none', color: '#fff' }}>
                Mint Passport →
              </a>
            )}
          </div>

          {/* S02: Identity */}
          <div style={{ ...card, marginBottom: 0, position: 'relative' as const, overflow: 'hidden' as const }}>
            {/* Butterfly — decorative */}
            <Image
              src="/assets/dual-signal/ui/Signal-butterfly.png"
              alt=""
              role="presentation"
              aria-hidden={true}
              width={220}
              height={220}
              style={{
                position: 'absolute' as const,
                right: -30, bottom: -30,
                opacity: 0.38,
                filter: 'saturate(0.2) brightness(0.55)',
                pointerEvents: 'none' as const,
                userSelect: 'none' as const,
              }}
            />

            <span style={sectionTitle}>Welcome Back</span>
            <h1 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 700, color: '#E8F4FC', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {data.username ?? data.email}
            </h1>

            {/* Status badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
              {badge && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.green, background: 'rgba(74,200,154,0.08)', border: '1px solid rgba(74,200,154,0.2)', borderRadius: 6, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.08em' }}>
                  ✓ Passport Minted
                </div>
              )}
              {badge?.isOG && (
                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.25)', borderRadius: 4, padding: '3px 8px', fontWeight: 700 }}>
                  OG
                </div>
              )}
              {badge?.isGenesis && (
                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.25)', borderRadius: 4, padding: '3px 8px', fontWeight: 700 }}>
                  GENESIS
                </div>
              )}
            </div>

            {/* Meta */}
            {badge?.memberSince && (
              <div style={{ marginBottom: 10 }}>
                <p style={metaLabel}>Member Since</p>
                <p style={{ ...metaValue, fontFamily: 'inherit', marginBottom: 6 }}>{badge.memberSince}</p>
              </div>
            )}
            {badge && (
              <div style={{ marginBottom: 20 }}>
                <p style={metaLabel}>Object ID</p>
                <p style={metaValue}>{badge.dualObjectId.length > 20 ? `${badge.dualObjectId.slice(0, 10)}···${badge.dualObjectId.slice(-8)}` : badge.dualObjectId}</p>
              </div>
            )}

            {/* Tier progression bar */}
            <TierBar tier={tier} />
          </div>
        </div>

        {/* ── S03: Channel Scores ── */}
        {badge && (
          <div style={card}>
            <span style={sectionTitle}>How You Earned Points</span>
            {[
              {
                key: 'x', icon: '𝕏', label: 'X Signal', color: '#E8F4FC',
                level: badge.xSignalLevel,
                pts:   X_LEVELS[badge.xSignalLevel - 1]?.points ?? 0,
                name:  X_LEVELS[badge.xSignalLevel - 1]?.name,
                metric: badge.xSignalLevel > 0
                  ? `${badge.xQualifyingPosts} qualifying post${badge.xQualifyingPosts !== 1 ? 's' : ''} · ${Number(badge.xSignalPublicViews).toLocaleString()} views`
                  : 'No qualifying posts yet',
              },
              {
                key: 'tg', icon: 'TG', label: 'Telegram', color: '#5ED3EA',
                level: badge.telegramLevel,
                pts:   TG_LEVELS[badge.telegramLevel - 1]?.points ?? 0,
                name:  TG_LEVELS[badge.telegramLevel - 1]?.name,
                metric: badge.telegramActiveDays > 0
                  ? `${badge.telegramActiveDays} active day${badge.telegramActiveDays !== 1 ? 's' : ''}`
                  : 'No activity yet',
              },
              {
                key: 'dc', icon: 'DC', label: 'Discord', color: '#7B83EB',
                level: badge.discordLevel,
                pts:   DC_LEVELS[badge.discordLevel - 1]?.points ?? 0,
                name:  DC_LEVELS[badge.discordLevel - 1]?.name,
                metric: badge.discordActiveDays > 0
                  ? `${badge.discordActiveDays} active day${badge.discordActiveDays !== 1 ? 's' : ''}`
                  : 'No activity yet',
              },
              {
                key: 'gov', icon: 'GOV', label: 'Governance', color: C.gold,
                level: badge.governanceLevel,
                pts:   GOV_LEVELS[badge.governanceLevel - 1]?.points ?? 0,
                name:  GOV_LEVELS[badge.governanceLevel - 1]?.name,
                metric: badge.governanceActivityPoints > 0
                  ? `${badge.governanceActivityPoints} activity pts · ${badge.governanceVotes} vote${badge.governanceVotes !== 1 ? 's' : ''}`
                  : 'No forum activity yet',
              },
            ].map((ch, i, arr) => (
              <div key={ch.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: ch.color, letterSpacing: '0.04em', flexShrink: 0 }}>
                    {ch.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#A8C8D8', marginBottom: 2 }}>
                      {ch.label}
                      {ch.level > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: '0.12em', color: ch.color, fontWeight: 700 }}>
                          Lvl {ch.level} · {ch.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{ch.metric}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: ch.level > 0 ? '#E8F4FC' : C.textDim, fontVariantNumeric: 'tabular-nums' }}>
                    {ch.level > 0 ? `+${ch.pts}` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim }}>pts</div>
                </div>
              </div>
            ))}

            {(badge.isOG || badge.isGenesis) && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 14 }}>
                {badge.isOG && <div style={{ fontSize: 11, color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.2)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>OG Bonus</div>}
                {badge.isGenesis && <div style={{ fontSize: 11, color: C.gold, background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.2)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>Genesis Bonus</div>}
              </div>
            )}
          </div>
        )}

        {/* ── S04: Activity History ── */}
        {badge && (
          <div style={card}>
            <span style={sectionTitle}>Activity History</span>

            {actLoading && <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center' as const, padding: '16px 0' }}>Loading…</p>}
            {!actLoading && activities.length === 0 && (
              <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center' as const, padding: '16px 0' }}>No activity recorded yet.</p>
            )}

            {activities.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < activities.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: 'rgba(94,211,234,0.04)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: SOURCE_COLOR[a.source], letterSpacing: '0.04em' }}>
                  {SOURCE_ICON[a.source]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#A8C8D8', fontWeight: 500 }}>{a.label}</div>
                  {a.detail && <div style={{ fontSize: 11, color: C.textMuted }}>{a.detail}</div>}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, flexShrink: 0, textAlign: 'right' as const }}>{fmtDate(a.date)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── S05: How to Level Up ── */}
        {badge && levelUpChannels.length > 0 && (
          <div style={card}>
            <span style={sectionTitle}>How to Level Up</span>
            <p style={{ fontSize: 12, color: '#7A9AAA', marginBottom: 20, lineHeight: 1.65, marginTop: -8 }}>
              Each channel contributes up to 250 pts. Reach Level 5 in all four to maximize your Signal Score.
            </p>

            {levelUpChannels.every(ch => ch.level >= 5) && (
              <div style={{ fontSize: 13, color: C.green, padding: '8px 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>✓</span> All channels at max level — your passport is fully powered.
              </div>
            )}

            {levelUpChannels.map((ch, ci) => (
              <div key={ch.key} style={{ paddingBottom: 18, marginBottom: ci < levelUpChannels.length - 1 ? 18 : 0, borderBottom: ci < levelUpChannels.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: ch.color, letterSpacing: '0.04em' }}>
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
                        <div key={l} style={{ flex: 1, height: 5, borderRadius: 3, background: l <= ch.level ? ch.color : 'rgba(94,211,234,0.07)', border: l <= ch.level ? 'none' : `1px solid ${C.border}` }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: ch.level > 0 ? '#E8F4FC' : C.textDim, fontVariantNumeric: 'tabular-nums' }}>
                      {ch.level > 0 ? `+${ch.levels[ch.level - 1]?.points ?? 0}` : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: '#6A8A9A', letterSpacing: '0.1em' }}>PTS</div>
                  </div>
                </div>
                {ch.nextStep && (
                  <div style={{ borderLeft: `2px solid ${ch.color}`, paddingLeft: 12, marginLeft: 42, fontSize: 12, color: '#C8D8E8', lineHeight: 1.65 }}>
                    <span style={{ fontWeight: 600, color: ch.color }}>Next → </span>
                    {ch.nextStep}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── S06: Connected Identities ── */}
        <div style={card}>
          <span style={sectionTitle}>Connected Identities</span>
          <AccountRow
            provider="x" icon="𝕏" label="X" placeholder="@username"
            handle={badge?.xHandle ?? getHandle('TWITTER')}
            onUpdated={val => {
              updateHandle('TWITTER', val);
              setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, xHandle: val ?? '' } } : prev);
            }}
          />
          <AccountRow
            provider="telegram" icon="TG" label="Telegram" placeholder="@username"
            handle={badge?.telegramHandle ?? getHandle('TELEGRAM')}
            onUpdated={val => {
              updateHandle('TELEGRAM', val);
              setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, telegramHandle: val ?? '' } } : prev);
            }}
          />
          <AccountRow
            provider="discord" icon="DC" label="Discord" placeholder="username"
            handle={badge?.discordHandle ?? getHandle('DISCORD')}
            labelSuffix={badge && badge.discordActiveDays > 0
              ? <span style={{ fontSize: 9, letterSpacing: '0.14em', color: C.cyan, textTransform: 'uppercase' as const, fontWeight: 600 }}>
                  {badge.discordLevel > 0 ? `Lvl ${badge.discordLevel} · ` : ''}{badge.discordActiveDays} active day{badge.discordActiveDays !== 1 ? 's' : ''}
                </span>
              : undefined}
            onUpdated={val => {
              updateHandle('DISCORD', val);
              setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, discordHandle: val ?? '' } } : prev);
            }}
          />
          <ForumRow handle={forumAccount?.handle ?? ''} onUpdated={val => updateHandle('DUAL_FORUM', val)} />
        </div>

        {/* ── S07: DUAL Passport ── */}
        <div style={card}>
          <span style={sectionTitle}>DUAL Passport</span>
          {badge ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.green, background: 'rgba(74,200,154,0.08)', border: '1px solid rgba(74,200,154,0.2)', borderRadius: 6, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.08em' }}>
                  ✓ Passport Minted
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.cyan, background: 'rgba(94,211,234,0.06)', border: '1px solid rgba(94,211,234,0.18)', borderRadius: 6, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.08em' }}>
                  ACTIVE ON DUAL
                </div>
              </div>
              <p style={metaLabel}>Object ID</p>
              <p style={metaValue}>{badge.dualObjectId}</p>
              {badge.memberSince && (
                <>
                  <p style={metaLabel}>Member Since</p>
                  <p style={{ ...metaValue, fontFamily: 'inherit' }}>{badge.memberSince}</p>
                </>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                <a href={`/badge/${badge.dualObjectId}`} style={viewPassportBtn}>View Passport →</a>
                <a href={`https://explorer.dual.network/objects/${badge.dualObjectId}`} target="_blank" rel="noreferrer" style={{ ...viewPassportBtn, background: 'transparent', border: `1px solid ${C.border}`, color: C.textLabel }}>
                  View on DUAL →
                </a>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' as const, padding: '16px 0' }}>
              <p style={{ color: C.textDim, fontSize: 13, marginBottom: 16 }}>You haven&apos;t minted your Passport yet.</p>
              <a href="/join" style={{ ...viewPassportBtn, background: C.cyanDim, border: 'none', color: '#fff' }}>Mint Passport →</a>
            </div>
          )}
        </div>

        {/* ── S08: DUAL Wallet ── */}
        <div style={card}>
          <span style={sectionTitle}>DUAL Wallet</span>
          <div style={{ background: C.bgDark, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: C.textDim, textTransform: 'uppercase' as const, marginBottom: 6 }}>Coming Soon</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>DUAL Wallet Integration</p>
            <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
              DUAL Wallet integration is coming soon. Your SIGNAL Passport and reputation will continue building in the meantime.
            </p>
          </div>
        </div>

        {/* ── S09: Account ── */}
        <div style={card}>
          <span style={sectionTitle}>Account</span>
          <p style={{ fontSize: 9, letterSpacing: '0.14em', color: C.textDim, textTransform: 'uppercase' as const, marginBottom: 4 }}>Email</p>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>{data.email}</p>
          {data.username && (
            <>
              <p style={{ fontSize: 9, letterSpacing: '0.14em', color: C.textDim, textTransform: 'uppercase' as const, marginBottom: 4 }}>SIGNAL Username</p>
              <p style={{ fontSize: 13, color: C.cyan, fontWeight: 600, marginBottom: 16 }}>{data.username}</p>
            </>
          )}
          <button onClick={logout} style={{ padding: '11px 20px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.textDim, fontSize: 11, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: 'inherit' }}>
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
