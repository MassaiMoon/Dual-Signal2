'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentActivity {
  id:            string;
  activityType:  string;
  pointsAwarded: number;
  topicId:       number;
  topicUrl:      string;
  occurredAt:    string;
  status:        string;
}

interface BadgeRow {
  badgeId:                  string;
  username:                 string;
  forumUsername:            string | null;
  forumUserId:              number | null;
  forumSyncedAt:            string | null;
  governanceActivityPoints: number;
  governanceLevel:          number;
  signalScore:              number;
  cachedTier:               string;
  recentActivities:         RecentActivity[];
}

interface EvidenceActivity {
  id:            string;
  activityType:  string;
  pointsAwarded: number;
  topicId:       number;
  postId:        string;
  topicUrl:      string;
  occurredAt:    string;
  status:        string;
  source:        string;
}

interface EvidenceData {
  badge: {
    id:                       string;
    governanceActivityPoints: number;
    governanceLevel:          number;
    user:                     { username: string | null };
  };
  activities: EvidenceActivity[];
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight:  '100vh',
    background: '#00111E',
    color:      '#D4E8F0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding:    '40px 32px',
    boxSizing:  'border-box' as const,
  },
  wordmark: { fontSize: 18, fontWeight: 700, letterSpacing: 3, color: '#5ED3EA' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  input: {
    background:   'rgba(0,17,30,0.6)',
    border:       '1px solid rgba(94,211,234,0.15)',
    borderRadius: 7,
    padding:      '8px 10px',
    color:        '#D4E8F0',
    fontSize:     12,
    outline:      'none',
    boxSizing:    'border-box' as const,
  },
  btnPrimary: {
    padding:       '9px 16px',
    background:    'rgba(94,211,234,0.12)',
    border:        '1px solid rgba(94,211,234,0.3)',
    borderRadius:  8,
    color:         '#5ED3EA',
    fontSize:      12,
    fontWeight:    600,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    cursor:        'pointer',
  },
  btnGhost: {
    padding:      '8px 14px',
    background:   'transparent',
    border:       '1px solid rgba(94,211,234,0.15)',
    borderRadius: 7,
    color:        '#4A7A8A',
    fontSize:     12,
    cursor:       'pointer',
  },
  btnSmall: {
    padding:      '4px 8px',
    background:   'rgba(94,211,234,0.08)',
    border:       '1px solid rgba(94,211,234,0.2)',
    borderRadius: 5,
    color:        '#5ED3EA',
    fontSize:     11,
    cursor:       'pointer',
    whiteSpace:   'nowrap' as const,
  },
  btnWarn: {
    padding:      '4px 8px',
    background:   'rgba(247,200,115,0.08)',
    border:       '1px solid rgba(247,200,115,0.3)',
    borderRadius: 5,
    color:        '#F7C873',
    fontSize:     11,
    cursor:       'pointer',
    whiteSpace:   'nowrap' as const,
  },
  th: {
    padding:       '10px 12px',
    textAlign:     'left' as const,
    fontSize:      10,
    letterSpacing: 2,
    color:         '#3A6070',
    textTransform: 'uppercase' as const,
    borderBottom:  '1px solid rgba(94,211,234,0.08)',
    whiteSpace:    'nowrap' as const,
  },
  td:    { padding: '10px 12px', verticalAlign: 'top' as const, color: '#A0C8D8', fontSize: 13 },
  tr:    { borderBottom: '1px solid rgba(94,211,234,0.05)' },
  toast: {
    position:     'fixed' as const,
    bottom:       24,
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   'rgba(0,17,30,0.95)',
    border:       '1px solid rgba(94,211,234,0.3)',
    borderRadius: 8,
    padding:      '10px 20px',
    fontSize:     13,
    color:        '#5ED3EA',
    zIndex:       999,
    maxWidth:     '90vw',
    wordBreak:    'break-all' as const,
  },
  loginBox: {
    margin:        'auto',
    marginTop:     '20vh',
    width:         320,
    padding:       '40px 32px',
    background:    'rgba(94,211,234,0.04)',
    border:        '1px solid rgba(94,211,234,0.12)',
    borderRadius:  14,
    display:       'flex',
    flexDirection: 'column' as const,
    alignItems:    'center',
  },
  modal: {
    position:     'fixed' as const,
    inset:        0,
    background:   'rgba(0,10,18,0.85)',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    zIndex:       1000,
  },
  modalBox: {
    background:   '#00111E',
    border:       '1px solid rgba(94,211,234,0.2)',
    borderRadius: 12,
    padding:      '28px 28px',
    width:        380,
    display:      'flex',
    flexDirection: 'column' as const,
    gap:          12,
  },
} as const;

const ACTIVITY_COLORS: Record<string, string> = {
  COMMENT:            '#5ED3EA',
  TOPIC_CREATED:      '#7FE4F4',
  FORMAL_PROPOSAL:    '#F7C873',
  POLL_PARTICIPATION: '#A8EDF9',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Poll Vote Modal ────────────────────────────────────────────────────────────

function PollVoteModal({
  badge,
  token,
  onClose,
  onSaved,
}: {
  badge: BadgeRow;
  token: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [topicUrl,   setTopicUrl]   = useState('');
  const [topicId,    setTopicId]    = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [adminNote,  setAdminNote]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');

  // Auto-extract topic ID from URL
  function handleUrlChange(url: string) {
    setTopicUrl(url);
    const m = url.match(/\/(\d+)(?:\/|$)/);
    if (m) setTopicId(m[1]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(topicId, 10);
    if (!id) { setErr('Enter a valid topic ID or URL'); return; }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/governance/activity', {
        method:  'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          badgeId:      badge.badgeId,
          activityType: 'POLL_PARTICIPATION',
          topicId:      id,
          topicUrl,
          occurredAt,
          adminNote,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? 'Error'); return; }
      onSaved(`Poll vote recorded · +5 pts · Level ${json.governanceLevel} · ${json.signalScore} SIGNAL`);
      onClose();
    } catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: '#5ED3EA', textTransform: 'uppercase' as const }}>
          Manual Poll Vote
        </div>
        <div style={{ fontSize: 12, color: '#3A6070' }}>
          {badge.username || badge.badgeId} · +5 pts (POLL_PARTICIPATION)
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#3A6070', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' as const }}>
              Topic URL (auto-fills ID)
            </div>
            <input
              style={{ ...s.input, width: '100%' }}
              placeholder="https://forum.dual.org/t/slug/123"
              value={topicUrl}
              onChange={e => handleUrlChange(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#3A6070', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' as const }}>
              Topic ID
            </div>
            <input
              style={{ ...s.input, width: '100%' }}
              placeholder="123"
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              required
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#3A6070', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' as const }}>
              Vote Date
            </div>
            <input
              type="date"
              style={{ ...s.input, width: '100%' }}
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#3A6070', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' as const }}>
              Admin Note (optional)
            </div>
            <input
              style={{ ...s.input, width: '100%' }}
              placeholder="Voted 'For' on proposal #3"
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
            />
          </div>
          {err && <div style={{ fontSize: 12, color: '#F87171' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" style={s.btnGhost} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Record Vote (+5 pts)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Connect Modal ─────────────────────────────────────────────────────────────

function ConnectModal({
  badge,
  token,
  onClose,
  onSaved,
}: {
  badge: BadgeRow;
  token: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [forumUser, setForumUser] = useState(badge.forumUsername ?? '');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!forumUser.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/sync-governance', {
        method:  'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ resolve: { badgeId: badge.badgeId, forumUsername: forumUser.trim() } }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? 'Error'); return; }
      onSaved(`Connected — Discourse User ID: ${json.forumUserId}`);
      onClose();
    } catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: '#5ED3EA', textTransform: 'uppercase' as const }}>
          Connect Forum Account
        </div>
        <div style={{ fontSize: 12, color: '#3A6070' }}>
          Badge: {badge.username || badge.badgeId}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#3A6070', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' as const }}>
              Discourse Username
            </div>
            <input
              style={{ ...s.input, width: '100%' }}
              placeholder="forum_username"
              value={forumUser}
              onChange={e => setForumUser(e.target.value)}
              autoFocus
              required
            />
          </div>
          {err && <div style={{ fontSize: 12, color: '#F87171' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" style={s.btnGhost} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.btnPrimary} disabled={saving}>
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const [token,      setToken]      = useState('');
  const [authed,     setAuthed]     = useState(false);
  const [badges,     setBadges]     = useState<BadgeRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [toasting,   setToasting]   = useState('');
  const [syncing,    setSyncing]    = useState(false);
  const [evidence,   setEvidence]   = useState<EvidenceData | null>(null);
  const [pollModal,  setPollModal]  = useState<BadgeRow | null>(null);
  const [connectModal, setConnectModal] = useState<BadgeRow | null>(null);
  const [testUsername, setTestUsername] = useState('');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('ds_admin_token');
      if (stored) { setToken(stored); setAuthed(true); }
    } catch { /* private mode */ }
  }, []);

  const loadBadges = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/governance', {
        headers: { authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { setAuthed(false); return; }
      const json = await res.json();
      setBadges(json.badges ?? []);
    } catch (e) { toast(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed && token) loadBadges(token); }, [authed, token, loadBadges]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try { sessionStorage.setItem('ds_admin_token', token); } catch { /* */ }
    setAuthed(true);
  }

  function toast(msg: string, ms = 5000) {
    setToasting(msg);
    setTimeout(() => setToasting(''), ms);
  }

  async function runSync(testForumUsername?: string) {
    setSyncing(true);
    try {
      const body = testForumUsername ? { testForumUsername } : {};
      const res = await fetch('/api/admin/sync-governance', {
        method:  'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { toast(`Error: ${json.error}`); return; }
      toast(
        `Sync done · ${json.newActivities} new activities · ${json.stateChanges} state changes` +
        (json.errors?.length ? ` · ${json.errors.length} errors` : ''),
        6000,
      );
      await loadBadges(token);
    } catch (e) { toast(`Error: ${e}`); }
    finally { setSyncing(false); }
  }

  async function loadEvidence(badgeId: string) {
    try {
      const res = await fetch(`/api/admin/governance/evidence/${badgeId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      setEvidence(await res.json());
    } catch (e) { toast(String(e)); }
  }

  // ── Login gate ─────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={s.page}>
        <div style={s.loginBox}>
          <div style={s.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 12, letterSpacing: 3, color: '#3A6070', marginBottom: 32 }}>
            GOVERNANCE ADMIN
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <input
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={e => setToken(e.target.value)}
              style={{ ...s.input, width: '100%' }}
              autoFocus
            />
            <button type="submit" style={s.btnPrimary}>Enter</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Evidence drill-down ────────────────────────────────────────────────────

  if (evidence) {
    const b = evidence.badge;
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <div style={s.wordmark}>DUAL // SIGNAL</div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070' }}>GOVERNANCE · EVIDENCE</div>
          </div>
          <button onClick={() => setEvidence(null)} style={s.btnGhost}>← Back</button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <span style={{ color: '#5ED3EA', fontWeight: 600 }}>{b.user.username ?? b.id}</span>
          {' · '}
          <span style={{ color: '#A0C8D8' }}>{b.governanceActivityPoints} pts · Level {b.governanceLevel}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Type', 'Points', 'Topic', 'Post ID', 'Occurred', 'Status', 'Source'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidence.activities.map(a => (
                <tr key={a.id} style={s.tr}>
                  <td style={s.td}>
                    <span style={{ color: ACTIVITY_COLORS[a.activityType] ?? '#5ED3EA', fontWeight: 600, fontSize: 11 }}>
                      {a.activityType}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' as const }}>+{a.pointsAwarded}</td>
                  <td style={s.td}>
                    {a.topicUrl
                      ? <a href={a.topicUrl} target="_blank" rel="noreferrer" style={{ color: '#4A7A8A', fontSize: 11 }}>{a.topicId} ↗</a>
                      : a.topicId}
                  </td>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11 }}>{a.postId}</td>
                  <td style={{ ...s.td, fontSize: 11, color: '#5A8A9A' }}>{fmtDate(a.occurredAt)}</td>
                  <td style={{ ...s.td, fontSize: 11 }}>{a.status}</td>
                  <td style={{ ...s.td, fontSize: 11, color: '#3A6070' }}>{a.source}</td>
                </tr>
              ))}
              {evidence.activities.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...s.td, textAlign: 'center' as const, color: '#3A6070' }}>
                    No activities recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {toasting && <div style={s.toast}>{toasting}</div>}

      {/* Modals */}
      {pollModal && (
        <PollVoteModal
          badge={pollModal}
          token={token}
          onClose={() => setPollModal(null)}
          onSaved={msg => { toast(msg, 6000); setPollModal(null); loadBadges(token); }}
        />
      )}
      {connectModal && (
        <ConnectModal
          badge={connectModal}
          token={token}
          onClose={() => setConnectModal(null)}
          onSaved={msg => { toast(msg, 5000); setConnectModal(null); loadBadges(token); }}
        />
      )}

      <div style={s.header}>
        <div>
          <div style={s.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070' }}>GOVERNANCE ADMIN</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => loadBadges(token)} style={s.btnGhost} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
          <a href="/admin" style={{ ...s.btnGhost, textDecoration: 'none', lineHeight: '1.6' }}>← Admin</a>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#3A6070', marginBottom: 6, textTransform: 'uppercase' as const }}>
            Sync All Forum Accounts
          </div>
          <button style={s.btnPrimary} onClick={() => runSync()} disabled={syncing}>
            {syncing ? 'Syncing…' : '▶ Run Governance Sync'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#3A6070', marginBottom: 6, textTransform: 'uppercase' as const }}>
              Test — Single User
            </div>
            <input
              style={{ ...s.input, width: 180 }}
              placeholder="forum username"
              value={testUsername}
              onChange={e => setTestUsername(e.target.value)}
            />
          </div>
          <button
            style={s.btnSmall}
            onClick={() => { if (testUsername.trim()) runSync(testUsername.trim()); }}
            disabled={syncing || !testUsername.trim()}
          >
            Test
          </button>
        </div>
      </div>

      {/* Info note about what's tracked */}
      <div style={{
        fontSize:     12,
        color:        '#3A6070',
        background:   'rgba(94,211,234,0.03)',
        border:       '1px solid rgba(94,211,234,0.08)',
        borderRadius: 8,
        padding:      '10px 14px',
        marginBottom: 20,
      }}>
        <strong style={{ color: '#4A7A8A' }}>Auto-tracked:</strong> replies/comments (+3 first, +1 each, max 5 pts/topic), topic creation (+10), formal proposals (+20) in categories 6, 7, 8.
        {' '}<strong style={{ color: '#F7C873' }}>Manual only:</strong> poll votes (+5) — use the Poll Vote button per row.
      </div>

      {/* Badge table */}
      <div style={{ overflowX: 'auto', background: 'rgba(94,211,234,0.02)', border: '1px solid rgba(94,211,234,0.08)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Username', 'Forum Account', 'Points', 'Level', 'Signal', 'Tier', 'Last Sync', 'Recent', 'Actions'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {badges.map(b => (
              <tr key={b.badgeId} style={s.tr}>
                <td style={s.td}>{b.username || '—'}</td>

                {/* Forum Account cell */}
                <td style={s.td}>
                  {b.forumUsername && b.forumUserId ? (
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {b.forumUsername}
                      <span style={{ color: '#3A5060' }}> #{b.forumUserId}</span>
                    </span>
                  ) : b.forumUsername && !b.forumUserId ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#F7C873', fontSize: 11 }}>{b.forumUsername} (bad ID)</span>
                      <button style={s.btnWarn} onClick={() => setConnectModal(b)}>Fix</button>
                    </span>
                  ) : (
                    <button style={s.btnSmall} onClick={() => setConnectModal(b)}>+ Connect</button>
                  )}
                </td>

                <td style={{ ...s.td, textAlign: 'center' as const, fontVariantNumeric: 'tabular-nums' }}>
                  {b.governanceActivityPoints}
                </td>
                <td style={{ ...s.td, textAlign: 'center' as const }}>
                  <span style={{ color: b.governanceLevel > 0 ? '#5ED3EA' : '#2A3A48', fontWeight: 600 }}>
                    {b.governanceLevel}
                  </span>
                </td>
                <td style={{ ...s.td, textAlign: 'center' as const }}>{b.signalScore}</td>
                <td style={s.td}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#5ED3EA' }}>{b.cachedTier}</span>
                </td>
                <td style={{ ...s.td, fontSize: 11, color: '#5A8A9A' }}>
                  {b.forumSyncedAt ? fmtDate(b.forumSyncedAt) : '—'}
                </td>
                <td style={s.td}>
                  {b.recentActivities.slice(0, 3).map(a => (
                    <span key={a.id} style={{
                      display:      'inline-block',
                      fontSize:     9,
                      color:        ACTIVITY_COLORS[a.activityType] ?? '#5ED3EA',
                      background:   'rgba(94,211,234,0.06)',
                      borderRadius: 3,
                      padding:      '1px 4px',
                      marginRight:  3,
                      marginBottom: 2,
                    }}>
                      {a.activityType.slice(0, 4)}+{a.pointsAwarded}
                    </span>
                  ))}
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <button style={s.btnSmall} onClick={() => loadEvidence(b.badgeId)}>Evidence</button>
                    <button style={{ ...s.btnSmall, color: '#A8EDF9', borderColor: 'rgba(168,237,249,0.3)' }}
                      onClick={() => setPollModal(b)}>
                      Poll Vote
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {badges.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...s.td, textAlign: 'center' as const, color: '#3A6070' }}>
                  {loading ? 'Loading…' : 'No governance data yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
