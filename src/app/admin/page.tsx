'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BadgeRow {
  id:             string;
  dualObjectId:   string;
  walletAddress:  string;
  cachedTier:     string;
  signalScore:    number;
  memberSince:    string;
  discordHandle:  string;
  telegramHandle: string;
  xHandle:        string;
  isOG:           boolean;
  createdAt:      string;
  xSignalLevel:    number;
  telegramLevel:   number;
  governanceLevel: number;
  discordLevel:    number;
}

interface EventRow {
  id:              string;
  source:          string;
  type:            string;
  status:          string;
  occurredAt:      string;
  createdAt:       string;
  rejectionReason: string | null;
}

interface UpdateRow {
  id:        string;
  badgeId:   string;
  status:    string;
  attempts:  number;
  createdAt: string;
  badge:     { walletAddress: string; dualObjectId: string };
}

interface DashboardData {
  stats: {
    totalBadges:    number;
    byTier:         Record<string, number>;
    pendingEvents:  number;
    pendingUpdates: number;
  };
  badges:         BadgeRow[];
  recentEvents:   EventRow[];
  pendingUpdates: UpdateRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_ORDER = ['LEGEND', 'GENESIS', 'STAKEHOLDER', 'BUILDER', 'EXPLORER', 'INITIATE'];
const TIER_COLOR: Record<string, string> = {
  INITIATE:    '#4A7A8A',
  EXPLORER:    '#5ED3EA',
  BUILDER:     '#7FE4F4',
  STAKEHOLDER: '#A8EDF9',
  GENESIS:     '#F7C873',
  LEGEND:      '#FFD700',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING:    '#F7C873',
  PROCESSED:  '#5ED3EA',
  COMPLETED:  '#5ED3EA',
  REJECTED:   '#F87171',
  FAILED:     '#F87171',
  PROCESSING: '#A8EDF9',
  DUPLICATE:  '#4A7A8A',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function short(wallet: string) {
  return wallet ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}` : '—';
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token,    setToken]    = useState('');
  const [authed,   setAuthed]   = useState(false);
  const [data,     setData]     = useState<DashboardData | null>(null);

  function patchBadgeHandle(badgeId: string, field: 'discordHandle' | 'telegramHandle' | 'xHandle', value: string) {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        badges: prev.badges.map(b =>
          b.id === badgeId ? { ...b, [field]: value } : b,
        ),
      };
    });
  }
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [tab,      setTab]      = useState<'badges' | 'events' | 'queue'>('badges');
  const [toasting, setToasting] = useState('');
  const [rightPanel, setRightPanel] = useState<'mint' | 'update'>('mint');

  // Mint form state
  const [mintUsername, setMintUsername] = useState('');
  const [mintWallet,   setMintWallet]   = useState('');
  const [mintX,        setMintX]        = useState('');
  const [mintTg,       setMintTg]       = useState('');
  const [mintDiscord,  setMintDiscord]  = useState('');
  const [mintOG,       setMintOG]       = useState(false);
  const [minting,      setMinting]      = useState(false);
  const [mintResult,   setMintResult]   = useState('');

  // Update score form state (identifier: dualObjectId preferred, wallet as fallback)
  const [updId,     setUpdId]     = useState('');
  const [updX,      setUpdX]      = useState('');
  const [updTg,     setUpdTg]     = useState('');
  const [updGov,    setUpdGov]    = useState('');
  const [updDc,     setUpdDc]     = useState('');
  const [updating,  setUpdating]  = useState(false);
  const [updResult, setUpdResult] = useState('');

  // Restore token from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('ds_admin_token');
      if (stored) { setToken(stored); setAuthed(true); }
    } catch { /* private mode */ }
  }, []);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { setError('Invalid token'); setAuthed(false); return; }
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authed && token) load(token); }, [authed, token, load]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try { sessionStorage.setItem('ds_admin_token', token); } catch { /* */ }
    setAuthed(true);
  }

  async function triggerCron(path: string, label: string) {
    setToasting(`Running ${label}…`);
    try {
      const res = await fetch(path, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const json = await res.json();
      setToasting(`${label}: ${JSON.stringify(json)}`);
    } catch (e) { setToasting(`Error: ${e}`); }
    setTimeout(() => { setToasting(''); load(token); }, 3000);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    setUpdResult('');
    try {
      const id = updId.trim();
      // Detect identifier type: DUAL object IDs start with known prefix, otherwise treat as username
      const body: Record<string, unknown> = id.startsWith('0x')
        ? { walletAddress: id }
        : id.length > 20 && !id.includes(' ')
          ? { dualObjectId: id }
          : { username: id };

      if (updX   !== '') body.xPublicViews       = Number(updX);
      if (updTg  !== '') body.telegramActiveDays  = Number(updTg);
      if (updGov !== '') body.governanceVotes     = Number(updGov);
      if (updDc  !== '') body.discordActiveDays   = Number(updDc);

      const res = await fetch('/api/admin/update-score', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setUpdResult(`Error: ${json.error}`); return; }
      const { status, signalScore, tier, dualUpdateQueued } = json;
      setUpdResult(
        status === 'no_change'
          ? 'No change — score already matches.'
          : `Updated → ${tier} · ${signalScore} SIGNAL${dualUpdateQueued ? ' · DUAL write queued' : ''}`,
      );
      setUpdId(''); setUpdX(''); setUpdTg(''); setUpdGov(''); setUpdDc('');
      setTimeout(() => { setUpdResult(''); load(token); }, 3500);
    } catch (e) { setUpdResult(`Error: ${e}`); }
    finally { setUpdating(false); }
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    setMinting(true);
    setMintResult('');
    try {
      const res = await fetch('/api/admin/mint-badge', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username:       mintUsername.trim() || undefined,
          walletAddress:  mintWallet.trim()   || undefined,
          xHandle:        mintX.trim(),
          telegramHandle: mintTg.trim(),
          discordHandle:  mintDiscord.trim(),
          isOG:           mintOG,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMintResult(`Error: ${json.error}`); return; }
      setMintResult(`Minted! Object: ${json.dualObjectId}`);
      setMintUsername(''); setMintWallet(''); setMintX(''); setMintTg(''); setMintDiscord(''); setMintOG(false);
      setTimeout(() => { setMintResult(''); load(token); }, 3000);
    } catch (e) { setMintResult(`Error: ${e}`); }
    finally { setMinting(false); }
  }

  // ── Login gate ───────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.loginBox}>
          <div style={styles.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 12, letterSpacing: 3, color: '#3A6070', marginBottom: 32 }}>
            ADMIN CONSOLE
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={e => setToken(e.target.value)}
              style={styles.input}
              autoFocus
            />
            {error && <div style={{ color: '#F87171', fontSize: 13 }}>{error}</div>}
            <button type="submit" style={styles.btnPrimary}>Enter</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  const d = data;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070' }}>ADMIN CONSOLE</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => load(token)} style={styles.btnGhost} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
          <button
            onClick={() => { setAuthed(false); setData(null); try { sessionStorage.removeItem('ds_admin_token'); } catch { /* */ } }}
            style={styles.btnGhost}
          >
            Sign out
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Toast */}
      {toasting && (
        <div style={styles.toast}>{toasting}</div>
      )}

      {/* Stats row */}
      {d && (
        <div style={styles.statsRow}>
          <StatCard label="Total Badges"     value={d.stats.totalBadges} />
          <StatCard label="Pending Events"   value={d.stats.pendingEvents}  warn={d.stats.pendingEvents > 0} />
          <StatCard label="Pending Updates"  value={d.stats.pendingUpdates} warn={d.stats.pendingUpdates > 0} />
          {TIER_ORDER.filter(t => d.stats.byTier[t]).map(t => (
            <StatCard key={t} label={t} value={d.stats.byTier[t]} color={TIER_COLOR[t]} />
          ))}
        </div>
      )}

      {/* Cron actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button style={styles.btnAction} onClick={() => triggerCron('/api/cron/process-events', 'process-events')}>
          ▶ Process Events
        </button>
        <button style={styles.btnAction} onClick={() => triggerCron('/api/cron/flush-updates', 'flush-updates')}>
          ▶ Flush Updates
        </button>
        <button style={{ ...styles.btnAction, borderColor: 'rgba(94,211,234,0.35)' }} onClick={() => triggerCron('/api/admin/sync-x', 'Sync X')}>
          𝕏 Sync Impressions
        </button>
        <a href="/admin/telegram-import"
          style={{ ...styles.btnAction, textDecoration: 'none', lineHeight: '1.6', borderColor: 'rgba(94,211,234,0.25)' }}>
          Telegram Imports →
        </a>
      </div>

      {/* Two-column layout: main table + mint form */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Left: tabbed table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {(['badges', 'events', 'queue'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              >
                {t === 'badges' ? `Badges (${d?.badges.length ?? '…'})` :
                 t === 'events' ? `Recent Events (${d?.recentEvents.length ?? '…'})` :
                                  `Pending Updates (${d?.pendingUpdates.length ?? '…'})`}
              </button>
            ))}
          </div>

          {/* Badges table */}
          {tab === 'badges' && d && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Wallet / Username', 'Handles', 'Tier', 'Signal', 'Since', 'xS', 'TG', 'GOV', 'DC', 'OG', 'View'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.badges.map(b => (
                    <tr key={b.id} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {short(b.walletAddress) !== '—' ? short(b.walletAddress) : '—'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <HandleEditor
                            badgeId={b.id}
                            field="xHandle"
                            value={b.xHandle}
                            prefix="𝕏"
                            token={token}
                            onSaved={(val) => patchBadgeHandle(b.id, 'xHandle', val)}
                          />
                          <HandleEditor
                            badgeId={b.id}
                            field="telegramHandle"
                            value={b.telegramHandle}
                            prefix="TG"
                            token={token}
                            onSaved={(val) => patchBadgeHandle(b.id, 'telegramHandle', val)}
                          />
                          <HandleEditor
                            badgeId={b.id}
                            field="discordHandle"
                            value={b.discordHandle}
                            prefix="DC"
                            token={token}
                            onSaved={(val) => patchBadgeHandle(b.id, 'discordHandle', val)}
                          />
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: TIER_COLOR[b.cachedTier] ?? '#5ED3EA', fontWeight: 600, fontSize: 11 }}>
                          {b.cachedTier}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontVariantNumeric: 'tabular-nums' }}>{b.signalScore}</td>
                      <td style={styles.td}>{b.memberSince || '—'}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{b.xSignalLevel}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{b.telegramLevel}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{b.governanceLevel}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{b.discordLevel}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{b.isOG ? '⬡' : ''}</td>
                      <td style={styles.td}>
                        <a
                          href={`/badge/${b.dualObjectId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#5ED3EA', fontSize: 12 }}
                        >
                          ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                  {d.badges.length === 0 && (
                    <tr><td colSpan={11} style={{ ...styles.td, color: '#3A6070', textAlign: 'center' }}>No badges yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Events table */}
          {tab === 'events' && d && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Source', 'Type', 'Status', 'Occurred'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.recentEvents.map(ev => (
                    <tr key={ev.id} style={styles.tr}>
                      <td style={styles.td}><Tag>{ev.source}</Tag></td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>{ev.type}</td>
                      <td style={styles.td}>
                        <span style={{ color: STATUS_COLOR[ev.status] ?? '#D4E8F0', fontSize: 11, fontWeight: 600 }}>
                          {ev.status}
                        </span>
                        {ev.rejectionReason && (
                          <div style={{ fontSize: 10, color: '#F87171', marginTop: 2 }}>{ev.rejectionReason}</div>
                        )}
                      </td>
                      <td style={{ ...styles.td, fontSize: 11, color: '#5A8A9A' }}>{fmt(ev.occurredAt)}</td>
                    </tr>
                  ))}
                  {d.recentEvents.length === 0 && (
                    <tr><td colSpan={4} style={{ ...styles.td, color: '#3A6070', textAlign: 'center' }}>No events</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending updates table */}
          {tab === 'queue' && d && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Wallet', 'Status', 'Attempts', 'Queued'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.pendingUpdates.map(u => (
                    <tr key={u.id} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{short(u.badge.walletAddress)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: STATUS_COLOR[u.status] ?? '#D4E8F0', fontSize: 11, fontWeight: 600 }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{u.attempts}</td>
                      <td style={{ ...styles.td, fontSize: 11, color: '#5A8A9A' }}>{fmt(u.createdAt)}</td>
                    </tr>
                  ))}
                  {d.pendingUpdates.length === 0 && (
                    <tr><td colSpan={4} style={{ ...styles.td, color: '#3A6070', textAlign: 'center' }}>Queue empty</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Mint / Update Score panels */}
        <div style={styles.mintPanel}>
          {/* Panel tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '1px solid rgba(94,211,234,0.1)' }}>
            {(['mint', 'update'] as const).map(p => (
              <button
                key={p}
                onClick={() => setRightPanel(p)}
                style={{
                  ...styles.tab,
                  ...(rightPanel === p ? styles.tabActive : {}),
                  padding: '7px 14px',
                  fontSize: 10,
                }}
              >
                {p === 'mint' ? 'Quick Mint' : 'Update Score'}
              </button>
            ))}
          </div>

          {/* Mint form */}
          {rightPanel === 'mint' && (
            <form onSubmit={handleMint} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={styles.label}>Username *</label>
              <input
                style={styles.input}
                placeholder="Username"
                value={mintUsername}
                onChange={e => setMintUsername(e.target.value)}
              />
              <label style={styles.label}>Wallet (optional)</label>
              <input
                style={styles.input}
                placeholder="0x..."
                value={mintWallet}
                onChange={e => setMintWallet(e.target.value)}
              />
              <label style={styles.label}>𝕏 Handle</label>
              <input
                style={styles.input}
                placeholder="@handle"
                value={mintX}
                onChange={e => setMintX(e.target.value)}
              />
              <label style={styles.label}>Telegram Handle</label>
              <input
                style={styles.input}
                placeholder="@handle"
                value={mintTg}
                onChange={e => setMintTg(e.target.value)}
              />
              <label style={styles.label}>Discord Handle</label>
              <input
                style={styles.input}
                placeholder="@handle"
                value={mintDiscord}
                onChange={e => setMintDiscord(e.target.value)}
              />
              <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mintOG}
                  onChange={e => setMintOG(e.target.checked)}
                  style={{ accentColor: '#5ED3EA' }}
                />
                Genesis OG member
              </label>
              {mintResult && (
                <div style={{
                  fontSize: 12,
                  color: mintResult.startsWith('Error') ? '#F87171' : '#5ED3EA',
                  padding: '8px 10px',
                  background: 'rgba(94,211,234,0.06)',
                  borderRadius: 6,
                }}>
                  {mintResult}
                </div>
              )}
              <button type="submit" style={styles.btnPrimary} disabled={minting}>
                {minting ? 'Minting…' : 'Mint Badge'}
              </button>
            </form>
          )}

          {/* Update Score form */}
          {rightPanel === 'update' && (
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={styles.label}>Username / Object ID / Wallet *</label>
              <input
                style={styles.input}
                placeholder="Username or objectId or 0x…"
                value={updId}
                onChange={e => setUpdId(e.target.value)}
                required
              />
              <div style={{ fontSize: 11, color: '#3A5060', marginBottom: 2 }}>
                Leave counters blank to keep existing values
              </div>
              <label style={styles.label}>X Public Views</label>
              <input
                style={styles.input}
                type="number"
                min={0}
                placeholder="e.g. 50000"
                value={updX}
                onChange={e => setUpdX(e.target.value)}
              />
              <label style={styles.label}>Telegram Active Days</label>
              <input
                style={styles.input}
                type="number"
                min={0}
                placeholder="e.g. 30"
                value={updTg}
                onChange={e => setUpdTg(e.target.value)}
              />
              <label style={styles.label}>Governance Votes</label>
              <input
                style={styles.input}
                type="number"
                min={0}
                placeholder="e.g. 5"
                value={updGov}
                onChange={e => setUpdGov(e.target.value)}
              />
              <label style={styles.label}>Discord Active Days</label>
              <input
                style={styles.input}
                type="number"
                min={0}
                placeholder="e.g. 14"
                value={updDc}
                onChange={e => setUpdDc(e.target.value)}
              />
              {updResult && (
                <div style={{
                  fontSize: 12,
                  color: updResult.startsWith('Error') ? '#F87171' : '#5ED3EA',
                  padding: '8px 10px',
                  background: 'rgba(94,211,234,0.06)',
                  borderRadius: 6,
                }}>
                  {updResult}
                </div>
              )}
              <button type="submit" style={styles.btnPrimary} disabled={updating}>
                {updating ? 'Updating…' : 'Update Score'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color, warn }: {
  label: string; value: number; color?: string; warn?: boolean;
}) {
  return (
    <div style={{
      background:   'rgba(94,211,234,0.04)',
      border:       `1px solid ${warn ? 'rgba(247,200,115,0.3)' : 'rgba(94,211,234,0.1)'}`,
      borderRadius: 10,
      padding:      '14px 20px',
      minWidth:     100,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? (warn ? '#F7C873' : '#D4E8F0'), fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function HandleEditor({
  badgeId, field, value, prefix, token, onSaved,
}: {
  badgeId: string;
  field:   'discordHandle' | 'telegramHandle' | 'xHandle';
  value:   string;
  prefix:  string;
  token:   string;
  onSaved: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/badges/${badgeId}`, {
        method:  'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body:    JSON.stringify({ [field]: draft }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? 'Error'); return; }
      const saved = field === 'telegramHandle' ? json.telegramHandle : json.discordHandle;
      onSaved(saved ?? '');
      setEditing(false);
    } catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, color: '#2A4050', letterSpacing: 1, minWidth: 16 }}>{prefix}</span>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="handle"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          style={{
            width:      80,
            fontSize:   11,
            background: 'rgba(0,17,30,0.8)',
            border:     '1px solid rgba(94,211,234,0.3)',
            borderRadius: 4,
            padding:    '2px 6px',
            color:      '#D4E8F0',
            outline:    'none',
          }}
        />
        <button
          onClick={save}
          disabled={saving}
          style={{ background: 'none', border: 'none', color: '#5ED3EA', cursor: 'pointer', fontSize: 13, padding: 0 }}
        >
          {saving ? '…' : '✓'}
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(value); setErr(''); }}
          style={{ background: 'none', border: 'none', color: '#4A7A8A', cursor: 'pointer', fontSize: 13, padding: 0 }}
        >
          ✕
        </button>
        {err && <span style={{ fontSize: 10, color: '#F87171' }}>{err}</span>}
      </div>
    );
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
      style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
    >
      <span style={{ fontSize: 9, color: '#2A4050', letterSpacing: 1, minWidth: 16 }}>{prefix}</span>
      {value ? (
        <span style={{
          fontSize:   11,
          color:      '#4A7A8A',
          background: 'rgba(94,211,234,0.06)',
          border:     '1px solid rgba(94,211,234,0.1)',
          borderRadius: 4,
          padding:    '1px 6px',
        }}>
          @{value}
        </span>
      ) : (
        <span style={{ fontSize: 10, color: '#1E3A48', fontStyle: 'italic' }}>+ add</span>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display:      'inline-block',
      fontSize:     10,
      letterSpacing: 1,
      color:        '#4A7A8A',
      background:   'rgba(94,211,234,0.06)',
      borderRadius: 4,
      padding:      '1px 5px',
      marginLeft:   4,
    }}>
      {children}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight:     '100vh',
    background:    '#00111E',
    color:         '#D4E8F0',
    fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding:       '40px 32px',
    boxSizing:     'border-box' as const,
  },
  header: {
    display:       'flex',
    justifyContent: 'space-between',
    alignItems:    'flex-start',
    marginBottom:  32,
  },
  wordmark: {
    fontSize:      18,
    fontWeight:    700,
    letterSpacing: 3,
    color:         '#5ED3EA',
  },
  statsRow: {
    display:       'flex',
    flexWrap:      'wrap' as const,
    gap:           12,
    marginBottom:  24,
  },
  tabs: {
    display:       'flex',
    gap:           0,
    borderBottom:  '1px solid rgba(94,211,234,0.12)',
    marginBottom:  0,
  },
  tab: {
    padding:       '10px 18px',
    fontSize:      12,
    letterSpacing: 1,
    background:    'transparent',
    border:        'none',
    borderBottom:  '2px solid transparent',
    color:         '#3A6070',
    cursor:        'pointer',
    textTransform: 'uppercase' as const,
  },
  tabActive: {
    color:         '#5ED3EA',
    borderBottom:  '2px solid #5ED3EA',
  },
  tableWrap: {
    overflowX:     'auto' as const,
    background:    'rgba(94,211,234,0.02)',
    border:        '1px solid rgba(94,211,234,0.08)',
    borderTop:     'none',
    borderRadius:  '0 0 10px 10px',
  },
  table: {
    width:         '100%',
    borderCollapse: 'collapse' as const,
    fontSize:      13,
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
  tr: {
    borderBottom:  '1px solid rgba(94,211,234,0.05)',
  },
  td: {
    padding:       '10px 12px',
    verticalAlign: 'top' as const,
    color:         '#A0C8D8',
  },
  mintPanel: {
    width:         280,
    flexShrink:    0,
    background:    'rgba(94,211,234,0.03)',
    border:        '1px solid rgba(94,211,234,0.1)',
    borderRadius:  10,
    padding:       '20px 20px',
  },
  panelTitle: {
    fontSize:      11,
    letterSpacing: 3,
    color:         '#5ED3EA',
    textTransform: 'uppercase' as const,
    marginBottom:  16,
  },
  label: {
    fontSize:      11,
    letterSpacing: 1,
    color:         '#3A6070',
    textTransform: 'uppercase' as const,
  },
  input: {
    background:    'rgba(0,17,30,0.6)',
    border:        '1px solid rgba(94,211,234,0.15)',
    borderRadius:  7,
    padding:       '10px 12px',
    color:         '#D4E8F0',
    fontSize:      13,
    outline:       'none',
    width:         '100%',
    boxSizing:     'border-box' as const,
  },
  btnPrimary: {
    padding:       '11px 16px',
    background:    'rgba(94,211,234,0.12)',
    border:        '1px solid rgba(94,211,234,0.3)',
    borderRadius:  8,
    color:         '#5ED3EA',
    fontSize:      12,
    fontWeight:    600,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    cursor:        'pointer',
    width:         '100%',
  },
  btnGhost: {
    padding:       '8px 14px',
    background:    'transparent',
    border:        '1px solid rgba(94,211,234,0.15)',
    borderRadius:  7,
    color:         '#4A7A8A',
    fontSize:      12,
    cursor:        'pointer',
  },
  btnAction: {
    padding:       '9px 16px',
    background:    'rgba(94,211,234,0.06)',
    border:        '1px solid rgba(94,211,234,0.2)',
    borderRadius:  7,
    color:         '#5ED3EA',
    fontSize:      12,
    letterSpacing: 1,
    cursor:        'pointer',
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
  toast: {
    position:      'fixed' as const,
    bottom:        24,
    left:          '50%',
    transform:     'translateX(-50%)',
    background:    'rgba(0,17,30,0.95)',
    border:        '1px solid rgba(94,211,234,0.3)',
    borderRadius:  8,
    padding:       '10px 20px',
    fontSize:      13,
    color:         '#5ED3EA',
    zIndex:        999,
    maxWidth:      '90vw',
    wordBreak:     'break-all' as const,
  },
} as const;
