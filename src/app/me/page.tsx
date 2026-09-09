'use client';

/**
 * /me — Member dashboard.
 *
 * Protected by session cookie. Fetches GET /api/me on load.
 * Unauthenticated users are redirected to /login.
 */

import { useState, useEffect, useCallback } from 'react';

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
  xSignalLevel:         number;
  xQualifyingPosts:     number;
  xSignalPublicViews:   number;
  telegramLevel:        number;
  telegramActiveDays:   number;
  governanceLevel:      number;
  governanceVotes:      number;
  governanceActivityPoints: number;
  discordLevel:         number;
  discordActiveDays:    number;
  isOG:                 boolean;
  isGenesis:            boolean;
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

// ── Style tokens ──────────────────────────────────────────────────────────────

const C = {
  bg:          '#040E1A',
  bgCard:      '#071525',
  bgDark:      '#020C16',
  border:      'rgba(94,211,234,0.09)',
  borderMid:   'rgba(94,211,234,0.14)',
  cyan:        '#5ED3EA',
  cyanDim:     '#0EB4D0',
  text:        '#C8D8E8',
  textMuted:   '#4A6A7A',
  textDim:     '#2A3A4A',
  textLabel:   '#3A5A6A',
  green:       '#4AC89A',
  red:         '#F87171',
  gold:        '#F7C873',
};

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:     '100vh',
    background:    C.bg,
    color:         C.text,
    fontFamily:    "'Inter', 'SF Pro Display', system-ui, sans-serif",
  },
  header: {
    background:     '#050F1C',
    borderBottom:   `1px solid ${C.border}`,
    padding:        '18px 32px',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize:      16,
    fontWeight:    700,
    letterSpacing: '0.2em',
    color:         '#E8F4FC',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
  },
  logoSlash: { color: C.cyan },
  headerRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        16,
  },
  navLink: {
    fontSize:      11,
    letterSpacing: '0.14em',
    color:         C.textMuted,
    textDecoration: 'none',
    textTransform: 'uppercase' as const,
  },
  logoutBtn: {
    background:    'transparent',
    border:        `1px solid ${C.border}`,
    borderRadius:  7,
    padding:       '7px 14px',
    color:         C.textMuted,
    fontSize:      11,
    cursor:        'pointer',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontFamily:    'inherit',
  },
  body: {
    maxWidth:  680,
    margin:    '0 auto',
    padding:   '40px 24px 80px',
  },
  welcomeRow: {
    marginBottom: 32,
  },
  welcomeLabel: {
    fontSize:      10,
    letterSpacing: '0.24em',
    color:         C.textDim,
    textTransform: 'uppercase' as const,
    marginBottom:  4,
  },
  welcomeUser: {
    fontSize:      26,
    fontWeight:    700,
    color:         '#E8F4FC',
    letterSpacing: '-0.01em',
  },
  section: {
    background:    C.bgCard,
    border:        `1px solid ${C.border}`,
    borderRadius:  14,
    padding:       '24px 24px',
    marginBottom:  16,
  },
  sectionTitle: {
    fontSize:      9,
    fontWeight:    700,
    letterSpacing: '0.22em',
    color:         C.textDim,
    textTransform: 'uppercase' as const,
    marginBottom:  20,
    display:       'block',
  },
  scoreRow: {
    display:    'flex',
    alignItems: 'baseline',
    gap:        8,
    marginBottom: 6,
  },
  scoreNum: {
    fontSize:   36,
    fontWeight: 700,
    color:      '#E8F4FC',
    fontVariantNumeric: 'tabular-nums',
  },
  scoreMax: {
    fontSize:   18,
    color:      C.textDim,
  },
  tierTag: {
    display:       'inline-block',
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: '0.18em',
    padding:       '3px 10px',
    borderRadius:   6,
    marginBottom:  16,
    textTransform: 'uppercase' as const,
  },
  progressBar: {
    height:       4,
    background:   'rgba(94,211,234,0.08)',
    borderRadius: 4,
    overflow:     'hidden',
    marginBottom: 20,
  },
  progressFill: {
    height:       '100%',
    background:   'linear-gradient(to right, #0EB4D0, #5ED3EA)',
    borderRadius: 4,
    transition:   'width 0.6s ease',
  },
  viewPassportBtn: {
    display:       'inline-block',
    padding:       '10px 20px',
    background:    'rgba(94,211,234,0.08)',
    border:        `1px solid ${C.borderMid}`,
    borderRadius:   8,
    color:         C.cyan,
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
    cursor:        'pointer',
  },
  accountRow: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '14px 0',
    borderBottom:   `1px solid ${C.border}`,
    gap:            12,
  },
  accountLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    minWidth:   0,
  },
  providerIcon: {
    width:          36,
    height:         36,
    borderRadius:    8,
    background:     'rgba(94,211,234,0.06)',
    border:         `1px solid ${C.border}`,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       11,
    fontWeight:     700,
    color:          C.cyan,
    letterSpacing:  '0.04em',
    flexShrink:     0,
  },
  accountName: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#A8C8D8',
    marginBottom: 2,
  },
  accountHandle: {
    fontSize:  12,
    color:     C.cyan,
  },
  accountNotConnected: {
    fontSize:  12,
    color:     C.textDim,
    fontStyle: 'italic',
  },
  editBtn: {
    background:    'transparent',
    border:        `1px solid ${C.border}`,
    borderRadius:   6,
    padding:       '5px 12px',
    color:         C.textLabel,
    fontSize:      11,
    cursor:        'pointer',
    letterSpacing: '0.08em',
    fontFamily:    'inherit',
    flexShrink:    0,
  },
  connectBtn: {
    background:    'rgba(94,211,234,0.06)',
    border:        `1px solid rgba(94,211,234,0.15)`,
    borderRadius:   6,
    padding:       '5px 12px',
    color:         C.cyan,
    fontSize:      11,
    cursor:        'pointer',
    letterSpacing: '0.08em',
    fontFamily:    'inherit',
    flexShrink:    0,
  },
  passportRow: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        16,
    marginBottom: 16,
  },
  mintedBadge: {
    display:    'inline-flex',
    alignItems: 'center',
    gap:        6,
    fontSize:   11,
    color:      C.green,
    background: 'rgba(74,200,154,0.08)',
    border:     '1px solid rgba(74,200,154,0.2)',
    borderRadius: 6,
    padding:    '3px 10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize:   10,
    color:      C.textDim,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    marginBottom:  2,
  },
  metaValue: {
    fontSize:     12,
    color:        '#7AABBF',
    fontFamily:   'monospace',
    wordBreak:    'break-all' as const,
    marginBottom: 14,
  },
  passportLinks: {
    display:  'flex',
    gap:      10,
    flexWrap: 'wrap' as const,
  },
  walletCard: {
    background: C.bgDark,
    border:     `1px solid ${C.border}`,
    borderRadius: 10,
    padding:    '18px 20px',
  },
  walletLabel: {
    fontSize:      9,
    fontWeight:    700,
    letterSpacing: '0.22em',
    color:         C.textDim,
    textTransform: 'uppercase' as const,
    marginBottom:  6,
  },
  walletTitle: {
    fontSize:   13,
    fontWeight: 600,
    color:      C.textMuted,
    marginBottom: 8,
  },
  walletDesc: {
    fontSize:   12,
    color:      C.textDim,
    lineHeight: 1.7,
  },
  accountSection: {
    borderTop:  `1px solid ${C.border}`,
    paddingTop: 16,
    marginTop:  16,
  },
  emailLabel: {
    fontSize:   10,
    color:      C.textDim,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  emailValue: {
    fontSize:     13,
    color:        C.textMuted,
    marginBottom: 16,
  },
  logoutBtnLarge: {
    padding:       '11px 20px',
    background:    'transparent',
    border:        `1px solid ${C.border}`,
    borderRadius:   8,
    color:         C.textDim,
    fontSize:      11,
    cursor:        'pointer',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontFamily:    'inherit',
  },
};

// ── Tier colours ──────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  INITIATE:    '#4A7A8A',
  EXPLORER:    '#5ED3EA',
  BUILDER:     '#7FE4F4',
  STAKEHOLDER: '#A8EDF9',
  GENESIS:     '#F7C873',
  LEGEND:      '#FFD700',
};
const TIER_BG: Record<string, string> = {
  INITIATE:    'rgba(74,122,138,0.12)',
  EXPLORER:    'rgba(94,211,234,0.10)',
  BUILDER:     'rgba(127,228,244,0.10)',
  STAKEHOLDER: 'rgba(168,237,249,0.10)',
  GENESIS:     'rgba(247,200,115,0.12)',
  LEGEND:      'rgba(255,215,0,0.12)',
};

// ── Inline handle editor ──────────────────────────────────────────────────────

function HandleEditor({
  provider,
  currentHandle,
  label,
  icon,
  placeholder,
  onSaved,
}: {
  provider:      string;
  currentHandle: string;
  label:         string;
  icon:          string;
  placeholder:   string;
  onSaved:       (handle: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(currentHandle);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  async function save() {
    const value = draft.replace(/^@/, '').trim();
    setSaving(true);
    setErr('');
    try {
      const res  = await fetch(`/api/me/accounts/${provider}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ handle: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? 'Update failed.');
        return;
      }
      onSaved(data.handle ?? value);
      setEditing(false);
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove your ${label} connection?`)) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/me/accounts/${provider}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setErr(data.error ?? 'Remove failed.');
        return;
      }
      onSaved(null);
      setEditing(false);
      setDraft('');
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setEditing(false); setDraft(currentHandle); setErr(''); }
            }}
            style={{
              flex:        1,
              background:  '#040E1A',
              border:      '1px solid rgba(94,211,234,0.3)',
              borderRadius: 6,
              padding:     '8px 12px',
              fontSize:    13,
              color:       '#C8D8E8',
              fontFamily:  'inherit',
              outline:     'none',
            }}
          />
          <button
            onClick={save}
            disabled={saving}
            style={{
              background:  'rgba(94,211,234,0.12)',
              border:      '1px solid rgba(94,211,234,0.3)',
              borderRadius: 6,
              padding:     '8px 14px',
              color:       C.cyan,
              fontSize:    11,
              cursor:      'pointer',
              fontFamily:  'inherit',
              fontWeight:  600,
            }}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(currentHandle); setErr(''); }}
            style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
          >
            ×
          </button>
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
        {currentHandle && (
          <button
            onClick={remove}
            disabled={saving}
            style={{ background: 'none', border: 'none', color: '#F87171', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
          >
            Remove {label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={S.accountName}>{label}</p>
      {currentHandle ? (
        <p style={S.accountHandle}>@{currentHandle}</p>
      ) : (
        <p style={S.accountNotConnected}>Not connected</p>
      )}
    </div>
  );

  void icon; // used in the row component above
}

// ── Provider row ──────────────────────────────────────────────────────────────

function AccountRow({
  provider,
  icon,
  label,
  placeholder,
  handle,
  labelSuffix,
  onUpdated,
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

  return (
    <div style={S.accountRow}>
      <div style={S.accountLeft}>
        <div style={S.providerIcon}>{icon}</div>
        {editing ? (
          <HandleEditor
            provider={provider}
            currentHandle={currentHandle}
            label={label}
            icon={icon}
            placeholder={placeholder}
            onSaved={handleSaved}
          />
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ ...S.accountName, marginBottom: 0 }}>{label}</p>
              {labelSuffix}
            </div>
            {currentHandle ? (
              <p style={S.accountHandle}>@{currentHandle}</p>
            ) : (
              <p style={S.accountNotConnected}>Not connected</p>
            )}
          </div>
        )}
      </div>
      {!editing && (
        <button
          style={currentHandle ? S.editBtn : S.connectBtn}
          onClick={() => setEditing(true)}
        >
          {currentHandle ? 'Edit' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// ── Forum row (special: no badge handle field) ────────────────────────────────

function ForumRow({ handle, onUpdated }: { handle: string; onUpdated: (h: string | null) => void }) {
  const [editing,       setEditing]       = useState(false);
  const [currentHandle, setCurrentHandle] = useState(handle);
  const [draft,         setDraft]         = useState(handle);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');

  async function save() {
    const value = draft.replace(/^@/, '').trim();
    setSaving(true);
    setErr('');
    try {
      const res  = await fetch('/api/me/accounts/forum', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ handle: value }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Update failed.'); return; }
      setCurrentHandle(value);
      onUpdated(value);
      setEditing(false);
    } catch {
      setErr('Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Remove your DUAL Forum connection?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/me/accounts/forum', { method: 'DELETE' });
      if (!res.ok) return;
      setCurrentHandle('');
      onUpdated(null);
      setEditing(false);
    } catch { /* */ } finally { setSaving(false); }
  }

  return (
    <div style={{ ...S.accountRow, borderBottom: 'none' }}>
      <div style={S.accountLeft}>
        <div style={S.providerIcon}>GOV</div>
        {editing ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="forum-username"
                onKeyDown={e => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') { setEditing(false); setDraft(currentHandle); }
                }}
                style={{
                  flex: 1, background: '#040E1A', border: '1px solid rgba(94,211,234,0.3)',
                  borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#C8D8E8',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button onClick={save} disabled={saving} style={{ background: 'rgba(94,211,234,0.12)', border: '1px solid rgba(94,211,234,0.3)', borderRadius: 6, padding: '8px 14px', color: C.cyan, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setDraft(currentHandle); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
            </div>
            {err && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{err}</p>}
            {currentHandle && (
              <button onClick={remove} style={{ background: 'none', border: 'none', color: '#F87171', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>
                Remove Forum
              </button>
            )}
          </div>
        ) : (
          <div>
            <p style={S.accountName}>DUAL Forum</p>
            {currentHandle ? <p style={S.accountHandle}>{currentHandle}</p> : <p style={S.accountNotConnected}>Not connected</p>}
          </div>
        )}
      </div>
      {!editing && (
        <button style={currentHandle ? S.editBtn : S.connectBtn} onClick={() => { setDraft(currentHandle); setEditing(true); }}>
          {currentHandle ? 'Edit' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

// ── Scoring config (mirrors src/lib/config.ts) ────────────────────────────────

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function MePage() {
  const [data,       setData]       = useState<MeData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [actLoading, setActLoading] = useState(false);
  const [actExpanded] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    try {
      const res = await fetch('/api/me/activity');
      if (res.ok) {
        const json = await res.json();
        setActivities(json.activities ?? []);
      }
    } finally {
      setActLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // Find account handle by provider
  function getHandle(source: string): string {
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
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid rgba(94,211,234,0.12)', borderTop: '2px solid #5ED3EA', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: C.textLabel, fontSize: 13, letterSpacing: '0.1em' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { badge } = data;
  const appUrl    = (typeof window !== 'undefined' ? window.location.origin : '');
  const tier      = badge?.cachedTier ?? 'INITIATE';
  const score     = badge?.signalScore ?? 0;
  const progress  = Math.min(100, (score / 1000) * 100);

  const forumAccount = data.accounts.find(a => a.source === 'DUAL_FORUM');

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <header style={S.header}>
        <a href="/" style={S.logo}>DUAL <span style={S.logoSlash}>//</span> SIGNAL</a>
        <div style={S.headerRight}>
          <span style={{
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: '0.18em',
            color:         'rgba(94,211,234,0.45)',
            textTransform: 'uppercase' as const,
            border:        '1px solid rgba(94,211,234,0.15)',
            borderRadius:  4,
            padding:       '3px 8px',
          }}>
            Alpha
          </span>
          <a href="/leaderboard" style={S.navLink}>Leaderboard</a>
          {badge && (
            <a href={`/badge/${badge.dualObjectId}`} target="_blank" rel="noreferrer" style={S.navLink}>
              My Passport
            </a>
          )}
          <button style={S.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </header>

      <div style={S.body}>

        {/* Welcome */}
        <div style={S.welcomeRow}>
          <p style={S.welcomeLabel}>Welcome back</p>
          <h1 style={S.welcomeUser}>{data.username ?? data.email}</h1>
        </div>

        {/* Signal score */}
        <div style={S.section}>
          <span style={S.sectionTitle}>Your Signal</span>

          <div style={S.scoreRow}>
            <span style={S.scoreNum}>{score.toLocaleString()}</span>
            <span style={S.scoreMax}> / 1,000</span>
          </div>

          <span style={{
            ...S.tierTag,
            color:      TIER_COLOR[tier] ?? C.cyan,
            background: TIER_BG[tier] ?? 'rgba(94,211,234,0.08)',
            border:     `1px solid ${TIER_COLOR[tier] ?? C.cyan}33`,
          }}>
            {tier}
          </span>

          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress}%` }} />
          </div>

          {badge && (
            <a href={`/badge/${badge.dualObjectId}`} style={S.viewPassportBtn}>
              View Passport →
            </a>
          )}
        </div>

        {/* Score Breakdown */}
        {badge && (
          <div style={S.section}>
            <span style={S.sectionTitle}>How You Earned Points</span>

            {[
              {
                key:   'x',
                icon:  '𝕏',
                label: 'X Signal',
                level: badge.xSignalLevel,
                pts:   X_LEVELS[badge.xSignalLevel - 1]?.points ?? 0,
                name:  X_LEVELS[badge.xSignalLevel - 1]?.name,
                metric: badge.xSignalLevel > 0
                  ? `${badge.xQualifyingPosts} qualifying post${badge.xQualifyingPosts !== 1 ? 's' : ''} · ${Number(badge.xSignalPublicViews).toLocaleString()} views`
                  : 'No qualifying posts yet',
                nextName:  X_LEVELS[badge.xSignalLevel]?.name,
                color: '#E8F4FC',
              },
              {
                key:   'tg',
                icon:  'TG',
                label: 'Telegram',
                level: badge.telegramLevel,
                pts:   TG_LEVELS[badge.telegramLevel - 1]?.points ?? 0,
                name:  TG_LEVELS[badge.telegramLevel - 1]?.name,
                metric: badge.telegramActiveDays > 0
                  ? `${badge.telegramActiveDays} active day${badge.telegramActiveDays !== 1 ? 's' : ''}`
                  : 'No activity yet',
                nextDays: TG_LEVELS[badge.telegramLevel]?.activeDays,
                color: '#5ED3EA',
              },
              {
                key:   'dc',
                icon:  'DC',
                label: 'Discord',
                level: badge.discordLevel,
                pts:   DC_LEVELS[badge.discordLevel - 1]?.points ?? 0,
                name:  DC_LEVELS[badge.discordLevel - 1]?.name,
                metric: badge.discordActiveDays > 0
                  ? `${badge.discordActiveDays} active day${badge.discordActiveDays !== 1 ? 's' : ''}`
                  : 'No activity yet',
                nextDays: DC_LEVELS[badge.discordLevel]?.activeDays,
                color: '#7B83EB',
              },
              {
                key:   'gov',
                icon:  'GOV',
                label: 'Governance',
                level: badge.governanceLevel,
                pts:   GOV_LEVELS[badge.governanceLevel - 1]?.points ?? 0,
                name:  GOV_LEVELS[badge.governanceLevel - 1]?.name,
                metric: badge.governanceActivityPoints > 0
                  ? `${badge.governanceActivityPoints} activity pts · ${badge.governanceVotes} vote${badge.governanceVotes !== 1 ? 's' : ''}`
                  : 'No forum activity yet',
                nextPts: GOV_LEVELS[badge.governanceLevel]?.activityPoints,
                color: '#F7C873',
              },
            ].map(ch => (
              <div key={ch.key} style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '14px 0',
                borderBottom:   `1px solid ${C.border}`,
                gap:            12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(94,211,234,0.06)',
                    border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: ch.color,
                    letterSpacing: '0.04em', flexShrink: 0,
                  }}>{ch.icon}</div>
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
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: ch.level > 0 ? '#E8F4FC' : C.textDim, fontVariantNumeric: 'tabular-nums' }}>
                    {ch.level > 0 ? `+${ch.pts}` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim }}>pts</div>
                </div>
              </div>
            ))}

            {/* OG / Genesis bonuses */}
            {(badge.isOG || badge.isGenesis) && (
              <div style={{ display: 'flex', gap: 12, paddingTop: 14 }}>
                {badge.isOG && (
                  <div style={{ fontSize: 11, color: '#F7C873', background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.2)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>
                    OG Bonus
                  </div>
                )}
                {badge.isGenesis && (
                  <div style={{ fontSize: 11, color: '#F7C873', background: 'rgba(247,200,115,0.08)', border: '1px solid rgba(247,200,115,0.2)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>
                    Genesis Bonus
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Activity History */}
        {badge && (
          <div style={S.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ ...S.sectionTitle, marginBottom: 0 }}>Activity History</span>
            </div>

            {actLoading && (
              <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '16px 0' }}>Loading…</p>
            )}

            {!actLoading && actExpanded && activities.length === 0 && (
              <p style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: '16px 0' }}>No activity recorded yet.</p>
            )}

            {activities.length > 0 && (
              <div>
                {activities.map((a, i) => (
                  <div key={a.id} style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          12,
                    padding:      '10px 0',
                    borderBottom: i < activities.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(94,211,234,0.04)', border: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700, color: SOURCE_COLOR[a.source],
                      letterSpacing: '0.04em',
                    }}>
                      {SOURCE_ICON[a.source]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#A8C8D8', fontWeight: 500 }}>{a.label}</div>
                      {a.detail && <div style={{ fontSize: 11, color: C.textMuted }}>{a.detail}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, flexShrink: 0, textAlign: 'right' }}>
                      {fmtDate(a.date)}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ── How to Level Up ──────────────────────────────────────────── */}
        {badge && (() => {
          const channels = [
            {
              key:   'x',
              icon:  '𝕏',
              label: 'X Signal',
              color: '#E8F4FC',
              level: badge.xSignalLevel,
              levels: X_LEVELS,
              nextStep: (() => {
                if (badge.xSignalLevel === 0)
                  return 'Post on X mentioning DUAL or SIGNAL with relevant keywords. Your first qualifying post earns 50 pts and unlocks FIRST_SIGNAL.';
                if (badge.xSignalLevel >= 5)
                  return null;
                const next = X_LEVELS[badge.xSignalLevel];
                return `Keep posting qualifying X content to reach ${next.name} (Level ${next.level}) and earn ${next.points} pts.`;
              })(),
            },
            {
              key:   'tg',
              icon:  'TG',
              label: 'Telegram',
              color: '#5ED3EA',
              level: badge.telegramLevel,
              levels: TG_LEVELS,
              nextStep: (() => {
                if (badge.telegramLevel === 0)
                  return 'Send a message in the DUAL Telegram group. Just 1 active day earns your first 50 pts (FIRST_CONTACT).';
                if (badge.telegramLevel >= 5)
                  return null;
                const next = TG_LEVELS[badge.telegramLevel];
                const remaining = next.activeDays - badge.telegramActiveDays;
                return `${remaining} more active day${remaining !== 1 ? 's' : ''} in the DUAL Telegram to reach Level ${next.level} (${next.name}) and earn ${next.points} pts. You have ${badge.telegramActiveDays} of ${next.activeDays} needed.`;
              })(),
            },
            {
              key:   'dc',
              icon:  'DC',
              label: 'Discord',
              color: '#7B83EB',
              level: badge.discordLevel,
              levels: DC_LEVELS,
              nextStep: (() => {
                if (badge.discordLevel === 0)
                  return 'Participate in the DUAL Discord server. Your first active day earns 50 pts (FIRST_CONTACT).';
                if (badge.discordLevel >= 5)
                  return null;
                const next = DC_LEVELS[badge.discordLevel];
                const remaining = next.activeDays - badge.discordActiveDays;
                return `${remaining} more active day${remaining !== 1 ? 's' : ''} in DUAL Discord to reach Level ${next.level} (${next.name}) and earn ${next.points} pts. You have ${badge.discordActiveDays} of ${next.activeDays} needed.`;
              })(),
            },
            {
              key:   'gov',
              icon:  'GOV',
              label: 'Governance',
              color: '#F7C873',
              level: badge.governanceLevel,
              levels: GOV_LEVELS,
              nextStep: (() => {
                if (badge.governanceLevel === 0)
                  return 'Join the DUAL governance forum and comment on a topic or vote on a proposal. Just 10 activity points earns your first 50 pts (FIRST_VOICE).';
                if (badge.governanceLevel >= 5)
                  return null;
                const next = GOV_LEVELS[badge.governanceLevel];
                const remaining = next.activityPoints - badge.governanceActivityPoints;
                return `${remaining} more governance activity point${remaining !== 1 ? 's' : ''} to reach Level ${next.level} (${next.name}) and earn ${next.points} pts. Post topics, comment on proposals, or vote to accumulate points.`;
              })(),
            },
          ];

          const allMaxed = channels.every(ch => ch.level >= 5);

          return (
            <div style={S.section}>
              <span style={S.sectionTitle}>How to Level Up</span>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20, lineHeight: 1.65, marginTop: -8 }}>
                Each channel contributes up to 250 pts. Reach Level 5 in all four to maximize your Signal Score.
              </p>

              {allMaxed && (
                <div style={{ fontSize: 13, color: C.green, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>✓</span> All channels at max level — your passport is fully powered.
                </div>
              )}

              {channels.map((ch, ci) => (
                <div key={ch.key} style={{
                  paddingBottom: 18,
                  marginBottom:  ci < channels.length - 1 ? 18 : 0,
                  borderBottom:  ci < channels.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                      background: 'rgba(94,211,234,0.06)', border: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: ch.color, letterSpacing: '0.04em',
                    }}>
                      {ch.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#A8C8D8' }}>{ch.label}</span>
                        <span style={{ fontSize: 10, color: C.textDim }}>
                          {ch.level > 0 ? `Level ${ch.level} / 5` : 'Level 0 / 5'}
                        </span>
                        {ch.level >= 5 && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.green,
                            background: 'rgba(74,200,154,0.08)', border: '1px solid rgba(74,200,154,0.2)',
                            borderRadius: 4, padding: '1px 6px' }}>MAX</span>
                        )}
                      </div>

                      {/* 5-segment level bar */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5].map(l => (
                          <div key={l} style={{
                            flex: 1, height: 5, borderRadius: 3,
                            background: l <= ch.level
                              ? ch.color
                              : 'rgba(94,211,234,0.07)',
                            border: l <= ch.level
                              ? 'none'
                              : `1px solid ${C.border}`,
                            transition: 'background 0.3s',
                          }} />
                        ))}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: ch.level > 0 ? '#E8F4FC' : C.textDim, fontVariantNumeric: 'tabular-nums' }}>
                        {ch.level > 0 ? `+${ch.levels[ch.level - 1]?.points ?? 0}` : '—'}
                      </div>
                      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.1em' }}>PTS</div>
                    </div>
                  </div>

                  {/* Next step callout */}
                  {ch.nextStep && (
                    <div style={{
                      borderLeft:   `2px solid ${ch.color}`,
                      paddingLeft:  12,
                      marginLeft:   42,
                      fontSize:     12,
                      color:        '#8AABBB',
                      lineHeight:   1.65,
                    }}>
                      <span style={{ fontWeight: 600, color: ch.color }}>Next → </span>
                      {ch.nextStep}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Connected accounts */}
        <div style={S.section}>
          <span style={S.sectionTitle}>Connected Accounts</span>

          <AccountRow
            provider="x"
            icon="𝕏"
            label="X"
            placeholder="@username"
            handle={badge?.xHandle ?? getHandle('TWITTER')}
            onUpdated={val => {
              updateHandle('TWITTER', val);
              setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, xHandle: val ?? '' } } : prev);
            }}
          />
          <AccountRow
            provider="telegram"
            icon="TG"
            label="Telegram"
            placeholder="@username"
            handle={badge?.telegramHandle ?? getHandle('TELEGRAM')}
            onUpdated={val => {
              updateHandle('TELEGRAM', val);
              setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, telegramHandle: val ?? '' } } : prev);
            }}
          />
          <AccountRow
            provider="discord"
            icon="DC"
            label="Discord"
            placeholder="username"
            handle={badge?.discordHandle ?? getHandle('DISCORD')}
            labelSuffix={badge && badge.discordActiveDays > 0
              ? <span style={{ fontSize: 9, letterSpacing: '0.14em', color: '#5ED3EA', textTransform: 'uppercase' as const, fontWeight: 600 }}>
                  {badge.discordLevel > 0 ? `Lvl ${badge.discordLevel} · ` : ''}{badge.discordActiveDays} active day{badge.discordActiveDays !== 1 ? 's' : ''}
                </span>
              : undefined}
            onUpdated={val => {
              updateHandle('DISCORD', val);
              setData(prev => prev && badge ? { ...prev, badge: { ...prev.badge!, discordHandle: val ?? '' } } : prev);
            }}
          />
          <ForumRow
            handle={forumAccount?.handle ?? ''}
            onUpdated={val => updateHandle('DUAL_FORUM', val)}
          />
        </div>

        {/* DUAL Passport */}
        <div style={S.section}>
          <span style={S.sectionTitle}>DUAL Passport</span>

          {badge ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 }}>
                <div style={S.mintedBadge}>✓ Passport Minted</div>
                <div style={{
                  display:    'inline-flex',
                  alignItems: 'center',
                  gap:        6,
                  fontSize:   11,
                  color:      C.cyan,
                  background: 'rgba(94,211,234,0.06)',
                  border:     '1px solid rgba(94,211,234,0.18)',
                  borderRadius: 6,
                  padding:    '3px 10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                }}>
                  ACTIVE ON DUAL
                </div>
              </div>

              <p style={S.metaLabel}>Object ID</p>
              <p style={S.metaValue}>{badge.dualObjectId}</p>

              {badge.memberSince && (
                <>
                  <p style={S.metaLabel}>Member Since</p>
                  <p style={{ ...S.metaValue, fontFamily: 'inherit' }}>{badge.memberSince}</p>
                </>
              )}

              <div style={S.passportLinks}>
                <a href={`/badge/${badge.dualObjectId}`} style={S.viewPassportBtn}>
                  View Passport →
                </a>
                <a
                  href={`https://explorer.dual.network/objects/${badge.dualObjectId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.viewPassportBtn, background: 'transparent', border: `1px solid ${C.border}`, color: C.textLabel }}
                >
                  View on DUAL →
                </a>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ color: C.textDim, fontSize: 13, marginBottom: 16 }}>
                You haven&apos;t minted your Passport yet.
              </p>
              <a href="/join" style={{ ...S.viewPassportBtn, background: '#0EB4D0', border: 'none', color: '#fff' }}>
                Mint Passport →
              </a>
            </div>
          )}
        </div>

        {/* DUAL Wallet placeholder */}
        <div style={S.section}>
          <span style={S.sectionTitle}>DUAL Wallet</span>
          <div style={S.walletCard}>
            <p style={S.walletLabel}>Coming Soon</p>
            <p style={S.walletTitle}>DUAL Wallet Integration</p>
            <p style={S.walletDesc}>
              DUAL Wallet integration is coming soon. Your SIGNAL Passport and reputation will continue building in the meantime.
            </p>
          </div>
        </div>

        {/* Account */}
        <div style={S.section}>
          <span style={S.sectionTitle}>Account</span>
          <p style={S.emailLabel}>Email</p>
          <p style={S.emailValue}>{data.email}</p>
          {data.username && (
            <>
              <p style={S.emailLabel}>SIGNAL Username</p>
              <p style={{ ...S.emailValue, color: C.cyan, fontFamily: 'inherit', fontWeight: 600 }}>{data.username}</p>
            </>
          )}
          <button style={S.logoutBtnLarge} onClick={logout}>Sign Out</button>
        </div>

      </div>

      {void appUrl}
    </div>
  );
}
