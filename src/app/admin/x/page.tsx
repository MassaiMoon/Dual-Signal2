'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface XBadgeRow {
  badgeId:         string;
  username:        string;
  xHandle:         string;
  xUserId:         string | null;
  resolvedAt:      string | null;
  qualifyingPosts: number;
  cumulativeViews: number;
  xLevel:          number;
  xPoints:         number;
  signalScore:     number;
  cachedTier:      string;
  lastDiscovery:   string | null;
  lastRefresh:     string | null;
  syncStatus:      'resolved' | 'handle_only' | 'no_account';
}

interface BudgetInfo {
  cycleKey:       string;
  estimatedSpend: number;
  limit:          number;
  remaining:      number;
}

interface XPost {
  id:                 string;
  postId:             string;
  postUrl:            string;
  authorHandle:       string;
  matchedKeyword:     string | null;
  publicViews:        number;
  firstObservedViews: number;
  postedAt:           string;
  firstSeenAt:        string | null;
  lastCheckedAt:      string | null;
  nextCheckAt:        string | null;
  checkCount:         number;
  status:             string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const TIER_COLOR: Record<string, string> = {
  INITIATE:    '#4A7A8A',
  EXPLORER:    '#5ED3EA',
  BUILDER:     '#7FE4F4',
  STAKEHOLDER: '#A8EDF9',
  GENESIS:     '#F7C873',
  LEGEND:      '#FFD700',
};

const X_LEVEL_NAME = ['—', 'FIRST SIGNAL', 'SPARK', 'PULSE', 'WAVE', 'IMPACT'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function XReviewPage() {
  const [token,        setToken]        = useState('');
  const [authed,       setAuthed]       = useState(false);
  const [badges,       setBadges]       = useState<XBadgeRow[]>([]);
  const [budget,       setBudget]       = useState<BudgetInfo | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [selected,     setSelected]     = useState<string | null>(null);
  const [posts,        setPosts]        = useState<XPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [syncResult,   setSyncResult]   = useState('');
  const [testHandle,   setTestHandle]   = useState('');

  useEffect(() => {
    try {
      const t = sessionStorage.getItem('ds_admin_token');
      if (t) { setToken(t); setAuthed(true); }
    } catch { /* private mode */ }
  }, []);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/x', { headers: { authorization: `Bearer ${t}` } });
      if (res.status === 401) { setError('Invalid token'); setAuthed(false); return; }
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setBadges(json.badges);
      setBudget(json.budget);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed && token) load(token); }, [authed, token, load]);

  async function loadPosts(badgeId: string) {
    setSelected(badgeId);
    setPostsLoading(true);
    setPosts([]);
    try {
      const res = await fetch(`/api/admin/x/posts/${badgeId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setPosts(json.posts ?? []);
    } catch { setPosts([]); }
    finally { setPostsLoading(false); }
  }

  async function triggerSync(handle?: string) {
    setSyncing(true);
    setSyncResult('');
    try {
      const res = await fetch('/api/admin/sync-x', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(handle ? { testHandle: handle } : {}),
      });
      const json = await res.json();
      if (!res.ok) { setSyncResult(`Error: ${json.error}`); return; }
      const errLines = (json.errors as Array<{ handle: string; error: string }> ?? [])
        .map(e => `  @${e.handle}: ${e.error}`)
        .join('\n');
      setSyncResult(
        `Done — ${json.accountsConsidered} accounts, ${json.newPostsDiscovered} new posts, ` +
        `${json.qualifyingPosts} qualifying, ${json.postsRefreshed} refreshed, ` +
        `${json.usersWithStateChanges} changed · Est. $${json.estimatedCostThisSync?.toFixed(4)} this sync / ` +
        `$${json.estimatedCycleTotal?.toFixed(4)} cycle` +
        (errLines ? `\n\nErrors:\n${errLines}` : ''),
      );
      await load(token);
    } catch (e) { setSyncResult(`Error: ${e}`); }
    finally { setSyncing(false); }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try { sessionStorage.setItem('ds_admin_token', token); } catch { /* */ }
    setAuthed(true);
  }

  if (!authed) {
    return (
      <div style={s.page}>
        <form onSubmit={handleLogin} style={s.loginBox}>
          <div style={s.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070', marginBottom: 24 }}>X REVIEW</div>
          <input type="password" placeholder="Admin token" value={token}
            onChange={e => setToken(e.target.value)} style={s.input} autoFocus />
          {error && <div style={{ color: '#F87171', fontSize: 13 }}>{error}</div>}
          <button type="submit" style={s.btnPrimary}>Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070' }}>X REVIEW</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/admin" style={{ ...s.btnGhost, textDecoration: 'none', lineHeight: '1.6' }}>← Admin</a>
          <button onClick={() => load(token)} style={s.btnGhost} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Budget bar */}
      {budget && (
        <div style={s.budgetBar}>
          <span style={{ color: '#5ED3EA', fontWeight: 600 }}>Estimated X API spend</span>
          <span style={{ color: '#A0C8D8', marginLeft: 12 }}>
            ${budget.estimatedSpend.toFixed(4)} / ${budget.limit.toFixed(2)} internal budget
            {' '}· ${budget.remaining.toFixed(4)} remaining · Cycle: {budget.cycleKey}
          </span>
          <div style={s.budgetTrack}>
            <div style={{
              ...s.budgetFill,
              width: `${Math.min(100, (budget.estimatedSpend / budget.limit) * 100)}%`,
              background: budget.estimatedSpend > budget.limit * 0.8 ? '#F87171' : '#5ED3EA',
            }} />
          </div>
        </div>
      )}

      {/* Sync controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={s.btnAction} onClick={() => triggerSync()} disabled={syncing}>
          {syncing ? '…' : '𝕏 Sync Views (all)'}
        </button>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            style={{ ...s.input, width: 160, padding: '8px 10px' }}
            placeholder="@handle (test 1 account)"
            value={testHandle}
            onChange={e => setTestHandle(e.target.value)}
          />
          <button
            style={{ ...s.btnAction, borderColor: 'rgba(247,200,115,0.4)', color: '#F7C873' }}
            onClick={() => triggerSync(testHandle.replace(/^@/, ''))}
            disabled={syncing || !testHandle.trim()}
          >
            Test Single
          </button>
        </div>
      </div>

      {syncResult && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(94,211,234,0.06)', border: '1px solid rgba(94,211,234,0.2)',
          fontSize: 13, color: syncResult.startsWith('Error') || syncResult.includes('\nErrors:') ? '#F87171' : '#5ED3EA',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {syncResult}
        </div>
      )}

      {/* Two-column: badges table + posts detail */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Badges table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...s.sectionTitle, marginBottom: 8 }}>
            X-connected accounts ({badges.length})
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['User', 'X Handle', 'X ID', 'Posts', 'Views', 'X Level', 'Pts', 'Last Check', 'Status'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {badges.map(b => (
                  <tr
                    key={b.badgeId}
                    style={{ ...s.tr, cursor: 'pointer', background: selected === b.badgeId ? 'rgba(94,211,234,0.06)' : undefined }}
                    onClick={() => loadPosts(b.badgeId)}
                  >
                    <td style={s.td}>{b.username}</td>
                    <td style={s.td}>
                      <a
                        href={`https://x.com/${b.xHandle}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: '#5ED3EA', textDecoration: 'none' }}
                      >
                        @{b.xHandle} ↗
                      </a>
                      <div style={{ marginTop: 4 }}>
                        <a
                          href={`https://x.com/search?q=from%3A${b.xHandle}+DUAL&src=typed_query`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 10, color: '#3A6070' }}
                        >
                          search DUAL ↗
                        </a>
                      </div>
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11 }}>
                      {b.xUserId ?? <span style={{ color: '#3A6070' }}>unresolved</span>}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{b.qualifyingPosts}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmtViews(b.cumulativeViews)}</td>
                    <td style={s.td}>
                      <span style={{ color: '#5ED3EA', fontSize: 11 }}>
                        L{b.xLevel} {X_LEVEL_NAME[b.xLevel] ?? ''}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{b.xPoints}</td>
                    <td style={{ ...s.td, fontSize: 11, color: '#5A8A9A' }}>{fmt(b.lastRefresh)}</td>
                    <td style={s.td}>
                      <span style={{
                        fontSize: 10,
                        color: b.syncStatus === 'resolved' ? '#5ED3EA' : b.syncStatus === 'handle_only' ? '#F7C873' : '#F87171',
                      }}>
                        {b.syncStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {badges.length === 0 && (
                  <tr><td colSpan={9} style={{ ...s.td, color: '#3A6070', textAlign: 'center' }}>
                    No X-connected accounts
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Posts detail panel */}
        {selected && (
          <div style={s.detailPanel}>
            <div style={s.sectionTitle}>
              Qualifying posts {postsLoading ? '…' : `(${posts.length})`}
            </div>
            {postsLoading ? (
              <div style={{ color: '#3A6070', padding: 20 }}>Loading…</div>
            ) : posts.length === 0 ? (
              <div style={{ color: '#3A6070', padding: 20 }}>No qualifying posts yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {posts.map(p => (
                  <div key={p.id} style={s.postCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <a href={p.postUrl} target="_blank" rel="noreferrer"
                        style={{ color: '#5ED3EA', fontSize: 12 }}>
                        {new Date(p.postedAt).toLocaleDateString('en-GB')} ↗
                      </a>
                      <span style={{ fontSize: 11, color: '#F7C873', fontWeight: 600 }}>
                        {fmtViews(p.publicViews)} views
                      </span>
                    </div>
                    {p.matchedKeyword && (
                      <div style={{ fontSize: 10, color: '#5ED3EA', marginTop: 4 }}>
                        keyword: <code>{p.matchedKeyword}</code>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#3A6070', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div>First seen: {fmt(p.firstSeenAt)}</div>
                      <div>Last checked: {fmt(p.lastCheckedAt)}</div>
                      <div>Next check: {fmt(p.nextCheckAt)}</div>
                      <div>Checks: {p.checkCount} · Status: <span style={{ color: p.status === 'ACTIVE' ? '#5ED3EA' : '#F87171' }}>{p.status}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh', background: '#00111E', color: '#D4E8F0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '40px 32px', boxSizing: 'border-box' as const,
  },
  loginBox: {
    margin: 'auto', marginTop: '20vh', width: 320,
    padding: '40px 32px', background: 'rgba(94,211,234,0.04)',
    border: '1px solid rgba(94,211,234,0.12)', borderRadius: 14,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24,
  },
  wordmark: { fontSize: 18, fontWeight: 700, letterSpacing: 3, color: '#5ED3EA' },
  budgetBar: {
    marginBottom: 20, padding: '12px 16px',
    background: 'rgba(94,211,234,0.04)', border: '1px solid rgba(94,211,234,0.1)',
    borderRadius: 8, fontSize: 13,
  },
  budgetTrack: {
    marginTop: 8, height: 4, background: 'rgba(94,211,234,0.1)', borderRadius: 2, overflow: 'hidden',
  },
  budgetFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  btnAction: {
    padding: '9px 16px', background: 'rgba(94,211,234,0.06)',
    border: '1px solid rgba(94,211,234,0.2)', borderRadius: 7,
    color: '#5ED3EA', fontSize: 12, letterSpacing: 1, cursor: 'pointer',
  },
  btnPrimary: {
    padding: '11px 16px', background: 'rgba(94,211,234,0.12)',
    border: '1px solid rgba(94,211,234,0.3)', borderRadius: 8,
    color: '#5ED3EA', fontSize: 12, fontWeight: 600,
    letterSpacing: 2, textTransform: 'uppercase' as const, cursor: 'pointer', width: '100%',
  },
  btnGhost: {
    padding: '8px 14px', background: 'transparent',
    border: '1px solid rgba(94,211,234,0.15)', borderRadius: 7,
    color: '#4A7A8A', fontSize: 12, cursor: 'pointer',
  },
  input: {
    background: 'rgba(0,17,30,0.6)', border: '1px solid rgba(94,211,234,0.15)',
    borderRadius: 7, padding: '10px 12px', color: '#D4E8F0', fontSize: 13,
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  },
  sectionTitle: {
    fontSize: 11, letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase' as const,
  },
  tableWrap: {
    overflowX: 'auto' as const, background: 'rgba(94,211,234,0.02)',
    border: '1px solid rgba(94,211,234,0.08)', borderRadius: 10,
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: {
    padding: '10px 12px', textAlign: 'left' as const, fontSize: 10,
    letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(94,211,234,0.08)', whiteSpace: 'nowrap' as const,
  },
  tr: { borderBottom: '1px solid rgba(94,211,234,0.05)' },
  td: { padding: '10px 12px', verticalAlign: 'top' as const, color: '#A0C8D8' },
  detailPanel: {
    width: 280, flexShrink: 0, background: 'rgba(94,211,234,0.03)',
    border: '1px solid rgba(94,211,234,0.1)', borderRadius: 10,
    padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: 12,
  },
  postCard: {
    background: 'rgba(94,211,234,0.04)', border: '1px solid rgba(94,211,234,0.1)',
    borderRadius: 8, padding: '10px 12px',
  },
} as const;
