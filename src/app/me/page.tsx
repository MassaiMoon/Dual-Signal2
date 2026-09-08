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
  xSignalLevel:    number;
  telegramLevel:   number;
  governanceLevel: number;
  discordLevel:    number;
  isOG:            boolean;
  createdAt:       string;
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

export default function MePage() {
  const [data,    setData]    = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, [load]);

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
            labelSuffix={<span style={{ fontSize: 9, letterSpacing: '0.14em', color: 'rgba(94,211,234,0.35)', textTransform: 'uppercase' as const, fontWeight: 600 }}>Scoring Coming Soon</span>}
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
