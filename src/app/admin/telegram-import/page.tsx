'use client';

/**
 * /admin/telegram-import
 *
 * Admin-only page for uploading and reviewing Telegram Desktop JSON exports.
 * Uses the same sessionStorage token as the main admin page.
 *
 * Workflow:
 *   1. Upload result.json from Telegram Desktop export
 *   2. Click "Dry Run" → see preview stats without writing
 *   3. Click "Confirm Import" → commit evidence + recalculate badges
 *   4. Review unmatched identities → link to existing DUAL users
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DryRunResult {
  dryRun:             true;
  format:             'html' | 'json';
  htmlFiles?:         number;
  chatName:           string;
  totalMessages:      number;
  qualifyingMessages: number;
  uniqueIdentities:   number;
  matchedUsers:       number;
  strongMatches:      number;
  weakMatches:        number;
  unmatchedUsers:     number;
  ambiguousUsers:     number;
  wouldCreateDays:    number;
  wouldIgnoreDups:    number;
  wouldChangeLevel:   number;
  wouldChangeTier:    number;
  sampleMatched:      { telegramUserId: string; displayName: string; newDays: number; totalDays: number }[];
  sampleUnmatched:    { telegramUserId: string; displayName: string; uniqueDays: number; messageCount: number }[];
}

interface CommitResult {
  dryRun:             false;
  importId:           string;
  chatName:           string;
  totalMessages:      number;
  qualifyingMessages: number;
  matchedUsers:       number;
  unmatchedUsers:     number;
  activeDaysCreated:  number;
  duplicatesIgnored:  number;
  badgesRecalculated: number;
  levelChanges:       number;
}

interface ImportRow {
  id:                string;
  filename:          string;
  status:            string;
  isDryRun:          boolean;
  messageCount:      number;
  matchedUsers:      number;
  unmatchedUsers:    number;
  activeDaysCreated: number;
  duplicatesIgnored: number;
  importedWeekStart: string | null;
  importedWeekEnd:   string | null;
  createdAt:         string;
}

interface IdentityRow {
  id:             string;
  telegramUserId: string;
  handle:         string;
  displayName:    string;
  messageCount:   number;
  uniqueDays:     number;
  firstSeenDate:  string;
  lastSeenDate:   string;
  matchedUserId:  string | null;
  matchedBadgeId: string | null;
  matchReason:    string | null;
  status:         string;
  activeDates:    string[];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#00111E',
    padding: '40px 32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#D4E8F0',
  } as React.CSSProperties,
  wordmark: {
    fontSize: 16, fontWeight: 700, letterSpacing: 4,
    color: '#5ED3EA', marginBottom: 4,
  } as React.CSSProperties,
  section: {
    background: 'rgba(94,211,234,0.03)',
    border: '1px solid rgba(94,211,234,0.1)',
    borderRadius: 10, padding: '20px 24px',
    marginBottom: 24,
  } as React.CSSProperties,
  label: { fontSize: 11, letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase' as const, marginBottom: 6 },
  input: {
    width: '100%', background: 'rgba(94,211,234,0.06)', border: '1px solid rgba(94,211,234,0.2)',
    borderRadius: 7, color: '#D4E8F0', fontSize: 14, padding: '9px 12px',
    outline: 'none', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  btn: (variant: 'primary' | 'ghost' | 'danger') => ({
    padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    letterSpacing: 1, cursor: 'pointer',
    ...(variant === 'primary' ? {
      background: 'rgba(94,211,234,0.15)', color: '#5ED3EA',
      border: '1px solid rgba(94,211,234,0.35)',
    } : variant === 'danger' ? {
      background: 'rgba(248,113,113,0.1)', color: '#F87171',
      border: '1px solid rgba(248,113,113,0.35)',
    } : {
      background: 'transparent', color: '#4A7A8A',
      border: '1px solid rgba(94,211,234,0.12)',
    }),
  }) as React.CSSProperties,
  stat: {
    display: 'flex', flexDirection: 'column' as const,
    gap: 4, minWidth: 100,
  },
  statLabel: { fontSize: 10, letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase' as const },
  statValue: { fontSize: 20, fontWeight: 700, color: '#5ED3EA', fontVariantNumeric: 'tabular-nums' },
  th: { textAlign: 'left' as const, fontSize: 10, letterSpacing: 2, color: '#3A6070', padding: '6px 12px', borderBottom: '1px solid rgba(94,211,234,0.08)' },
  td: { fontSize: 12, padding: '8px 12px', borderBottom: '1px solid rgba(94,211,234,0.05)', color: '#A0C8D8' },
  tag: (color: string) => ({
    display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: 1,
    padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' as const,
    background: `${color}22`, color, border: `1px solid ${color}44`,
  }) as React.CSSProperties,
};

const STATUS_COLOR: Record<string, string> = {
  MATCHED:   '#5ED3EA',
  UNMATCHED: '#F7C873',
  AMBIGUOUS: '#F87171',
  LINKED:    '#86efac',
  COMPLETED: '#5ED3EA',
  FAILED:    '#F87171',
  DRY_RUN:   '#4A7A8A',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TelegramImportPage() {
  const [token,    setToken]    = useState('');
  const [authed,   setAuthed]   = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Upload state
  const [files,      setFiles]      = useState<File[]>([]);
  const [running,    setRunning]    = useState(false);
  const [dryResult,  setDryResult]  = useState<DryRunResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error,      setError]      = useState('');

  // Import list
  const [imports,    setImports]    = useState<ImportRow[]>([]);
  const [loadingImports, setLoadingImports] = useState(false);

  // Selected import detail
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [identities,   setIdentities]   = useState<IdentityRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Link form
  const [linkingId,   setLinkingId]   = useState('');  // identity id
  const [linkUserId,  setLinkUserId]  = useState('');
  const [linking,     setLinking]     = useState(false);
  const [linkResult,  setLinkResult]  = useState('');

  // Restore token
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('ds_admin_token');
      if (stored) { setToken(stored); setAuthed(true); }
    } catch { /* private mode */ }
  }, []);

  const loadImports = useCallback(async (t: string) => {
    setLoadingImports(true);
    try {
      const res = await fetch('/api/admin/telegram-import', {
        headers: { authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        setImports(data.imports ?? []);
      }
    } finally {
      setLoadingImports(false);
    }
  }, []);

  useEffect(() => { if (authed && token) loadImports(token); }, [authed, token, loadImports]);

  async function loadDetail(importId: string) {
    setSelectedId(importId);
    setIdentities([]);
    setLoadingDetail(true);
    setLinkingId('');
    setLinkResult('');
    try {
      const res = await fetch(`/api/admin/telegram-import/${importId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.import?.identities ?? []);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  function buildFormData(dryRun: boolean): FormData {
    const fd = new FormData();
    for (const f of files) fd.append('file', f);
    fd.append('dryRun', String(dryRun));
    return fd;
  }

  async function runDryRun() {
    if (files.length === 0) return;
    setRunning(true);
    setError('');
    setDryResult(null);
    setCommitResult(null);
    try {
      const res = await fetch('/api/admin/telegram-import', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(true),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Unknown error'); return; }
      setDryResult(data);
    } catch (e) { setError(String(e)); }
    finally { setRunning(false); }
  }

  async function runCommit() {
    if (files.length === 0) return;
    setRunning(true);
    setError('');
    try {
      const res = await fetch('/api/admin/telegram-import', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: buildFormData(false),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Unknown error'); return; }
      setCommitResult(data);
      setDryResult(null);
      setFiles([]);
      await loadImports(token);
    } catch (e) { setError(String(e)); }
    finally { setRunning(false); }
  }

  async function handleLink(e: React.FormEvent, importId: string, identityId: string) {
    e.preventDefault();
    setLinking(true);
    setLinkResult('');
    try {
      const res = await fetch(`/api/admin/telegram-import/${importId}/link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ identityId, userId: linkUserId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setLinkResult(`Error: ${data.error}`); return; }
      setLinkResult(
        `Linked! ${data.daysCreated} new days created. Level: ${data.recalc.previousLevel}→${data.recalc.newLevel}`,
      );
      setLinkUserId('');
      setLinkingId('');
      await loadDetail(importId);
    } catch (e) { setLinkResult(String(e)); }
    finally { setLinking(false); }
  }

  // ── Login gate ─────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 320 }}>
          <div style={S.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070', marginBottom: 32 }}>TELEGRAM IMPORTS</div>
          <form onSubmit={(e) => {
            e.preventDefault();
            try { sessionStorage.setItem('ds_admin_token', tokenInput); } catch { /* */ }
            setToken(tokenInput);
            setAuthed(true);
          }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" placeholder="Admin token" value={tokenInput}
              onChange={e => setTokenInput(e.target.value)} style={S.input} autoFocus />
            <button type="submit" style={S.btn('primary')}>Enter</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={S.wordmark}>DUAL // SIGNAL</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#3A6070' }}>TELEGRAM IMPORTS</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/admin" style={{ ...S.btn('ghost'), textDecoration: 'none', lineHeight: 1.6 }}>← Admin</a>
          <button onClick={() => { setAuthed(false); try { sessionStorage.removeItem('ds_admin_token'); } catch { /* */ } }}
            style={S.btn('ghost')}>Sign out</button>
        </div>
      </div>

      {/* Upload section */}
      <div style={S.section}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: '#5ED3EA', marginBottom: 16 }}>
          UPLOAD TELEGRAM EXPORT
        </div>
        <div style={{ fontSize: 12, color: '#4A7A8A', marginBottom: 16, lineHeight: 1.7 }}>
          <strong style={{ color: '#7ABDD0' }}>HTML (primary):</strong> Telegram Desktop → Export chat history → HTML format → select all messages.html, messages2.html… files at once.<br />
          <strong style={{ color: '#7ABDD0' }}>JSON (legacy):</strong> Export Telegram data → JSON format → result.json<br />
          Max 15 MB per file, 20 files max. Message text is NOT stored — only sender identity and dates.
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ ...S.btn('ghost'), cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {files.length === 0
              ? '+ Choose file(s)'
              : files.length === 1
              ? `📄 ${files[0].name}`
              : `📄 ${files.length} files (${files[0].name}…)`}
            <input type="file" accept=".html,.json" multiple style={{ display: 'none' }}
              onChange={e => {
                const selected = Array.from(e.target.files ?? []);
                setFiles(selected);
                setDryResult(null);
                setCommitResult(null);
                setError('');
              }} />
          </label>
          <button style={S.btn('ghost')} disabled={files.length === 0 || running} onClick={runDryRun}>
            {running ? '…' : '▶ Dry Run'}
          </button>
          {dryResult && (
            <button style={S.btn('primary')} disabled={running} onClick={runCommit}>
              {running ? '…' : '✓ Confirm Import'}
            </button>
          )}
        </div>
        {files.length > 1 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#3A6070' }}>
            {files.map(f => f.name).join(' · ')}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, fontSize: 12, color: '#F87171', padding: '8px 12px',
            background: 'rgba(248,113,113,0.07)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)' }}>
            {error}
          </div>
        )}
      </div>

      {/* Dry-run preview */}
      {dryResult && (
        <div style={S.section}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: '#F7C873', marginBottom: 4 }}>
            DRY RUN PREVIEW — {dryResult.chatName}
          </div>
          <div style={{ fontSize: 11, color: '#3A6070', marginBottom: 16 }}>
            Format: {dryResult.format.toUpperCase()}
            {dryResult.htmlFiles != null && ` · ${dryResult.htmlFiles} file${dryResult.htmlFiles !== 1 ? 's' : ''}`}
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 20 }}>
            {[
              ['Messages', dryResult.totalMessages],
              ['Qualifying', dryResult.qualifyingMessages],
              ['Identities', dryResult.uniqueIdentities],
              ['Matched', dryResult.matchedUsers],
              ...(dryResult.format === 'html' ? [
                ['Strong Matches', dryResult.strongMatches],
                ['Weak Matches', dryResult.weakMatches],
                ['Ambiguous', dryResult.ambiguousUsers],
              ] : [
                ['Unmatched', dryResult.unmatchedUsers],
              ]),
              ['New Days', dryResult.wouldCreateDays],
              ['Duplicates', dryResult.wouldIgnoreDups],
              ['Level Changes', dryResult.wouldChangeLevel],
              ['Tier Changes', dryResult.wouldChangeTier],
            ].map(([label, val]) => (
              <div key={String(label)} style={S.stat}>
                <div style={S.statLabel}>{label}</div>
                <div style={{ ...S.statValue, fontSize: 18 }}>{Number(val).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {dryResult.sampleMatched.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Sample matched</div>
              {dryResult.sampleMatched.map(m => (
                <div key={m.telegramUserId} style={{ fontSize: 12, color: '#7BA8B8', marginBottom: 4 }}>
                  {m.displayName} ({m.telegramUserId}) → {m.newDays} new days / {m.totalDays} total
                </div>
              ))}
            </div>
          )}
          {dryResult.sampleUnmatched.length > 0 && (
            <div>
              <div style={{ ...S.label, marginBottom: 8 }}>Sample unmatched</div>
              {dryResult.sampleUnmatched.map(u => (
                <div key={u.telegramUserId} style={{ fontSize: 12, color: '#F7C873', marginBottom: 4 }}>
                  {u.displayName} ({u.telegramUserId}) — {u.uniqueDays} days, {u.messageCount} messages — no matching DUAL passport
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, fontSize: 11, color: '#3A6070' }}>
            No data has been written. Click Confirm Import above to proceed.
          </div>
        </div>
      )}

      {/* Commit result */}
      {commitResult && (
        <div style={{ ...S.section, borderColor: 'rgba(94,211,234,0.3)' }}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: '#5ED3EA', marginBottom: 16 }}>
            IMPORT COMPLETE — {commitResult.chatName}
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              ['Messages', commitResult.totalMessages],
              ['Matched', commitResult.matchedUsers],
              ['Unmatched', commitResult.unmatchedUsers],
              ['Days Created', commitResult.activeDaysCreated],
              ['Duplicates', commitResult.duplicatesIgnored],
              ['Badges Updated', commitResult.badgesRecalculated],
              ['Level Changes', commitResult.levelChanges],
            ].map(([label, val]) => (
              <div key={String(label)} style={S.stat}>
                <div style={S.statLabel}>{label}</div>
                <div style={{ ...S.statValue, fontSize: 18 }}>{Number(val).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <button style={S.btn('ghost')} onClick={() => loadDetail(commitResult.importId)}>
              View identities →
            </button>
          </div>
        </div>
      )}

      {/* Recent imports */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: '#5ED3EA' }}>RECENT IMPORTS</div>
          <button style={S.btn('ghost')} onClick={() => loadImports(token)} disabled={loadingImports}>
            {loadingImports ? '…' : '↻'}
          </button>
        </div>

        {imports.length === 0 ? (
          <div style={{ fontSize: 12, color: '#3A6070' }}>No imports yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['File', 'Date', 'Messages', 'Matched', 'Unmatched', 'Days+', 'Dups', 'Status', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imports.map(imp => (
                  <tr key={imp.id} style={{ cursor: 'pointer' }}
                    onClick={() => loadDetail(imp.id)}>
                    <td style={S.td}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{imp.filename}</span>
                      {imp.isDryRun && <span style={{ ...S.tag('#4A7A8A'), marginLeft: 6 }}>dry</span>}
                    </td>
                    <td style={{ ...S.td, fontSize: 11 }}>
                      {new Date(imp.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{imp.messageCount.toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#5ED3EA' }}>{imp.matchedUsers}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: imp.unmatchedUsers > 0 ? '#F7C873' : '#3A6070' }}>
                      {imp.unmatchedUsers}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#86efac' }}>{imp.activeDaysCreated}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#4A7A8A' }}>{imp.duplicatesIgnored}</td>
                    <td style={S.td}>
                      <span style={S.tag(STATUS_COLOR[imp.status] ?? '#5ED3EA')}>{imp.status}</span>
                    </td>
                    <td style={{ ...S.td, color: '#5ED3EA', fontSize: 11 }}>
                      {selectedId === imp.id ? '▼' : '▶'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Identity detail for selected import */}
      {selectedId && (
        <div style={S.section}>
          <div style={{ fontSize: 13, letterSpacing: 2, color: '#5ED3EA', marginBottom: 14 }}>
            IDENTITIES — {selectedId.slice(-8).toUpperCase()}
          </div>

          {loadingDetail ? (
            <div style={{ fontSize: 12, color: '#4A7A8A' }}>Loading…</div>
          ) : (
            <>
              {['UNMATCHED', 'AMBIGUOUS', 'MATCHED', 'LINKED'].map(statusGroup => {
                const group = identities.filter(i => i.status === statusGroup);
                if (group.length === 0) return null;
                return (
                  <div key={statusGroup} style={{ marginBottom: 20 }}>
                    <div style={{ ...S.label, color: STATUS_COLOR[statusGroup] ?? '#5ED3EA', marginBottom: 10 }}>
                      {statusGroup} ({group.length})
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Telegram ID', 'Display Name', 'Days', 'Messages', 'First Seen', 'Last Seen',
                              statusGroup === 'UNMATCHED' || statusGroup === 'AMBIGUOUS' ? 'Link to User' : 'Matched User'
                            ].map(h => <th key={h} style={S.th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {group.map(ident => (
                            <tr key={ident.id}>
                              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{ident.telegramUserId}</td>
                              <td style={S.td}>{ident.displayName}</td>
                              <td style={{ ...S.td, textAlign: 'center' }}>{ident.uniqueDays}</td>
                              <td style={{ ...S.td, textAlign: 'center' }}>{ident.messageCount}</td>
                              <td style={{ ...S.td, fontSize: 11 }}>{ident.firstSeenDate}</td>
                              <td style={{ ...S.td, fontSize: 11 }}>{ident.lastSeenDate}</td>
                              <td style={S.td}>
                                {(statusGroup === 'UNMATCHED' || statusGroup === 'AMBIGUOUS') ? (
                                  linkingId === ident.id ? (
                                    <form onSubmit={(e) => handleLink(e, selectedId, ident.id)}
                                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <input
                                        style={{ ...S.input, width: 200, fontSize: 12, padding: '5px 8px' }}
                                        placeholder="User ID (cuid…)"
                                        value={linkUserId}
                                        onChange={e => setLinkUserId(e.target.value)}
                                        required
                                      />
                                      <button type="submit" style={S.btn('primary')} disabled={linking}>
                                        {linking ? '…' : 'Link'}
                                      </button>
                                      <button type="button" style={S.btn('ghost')}
                                        onClick={() => { setLinkingId(''); setLinkUserId(''); setLinkResult(''); }}>
                                        ✕
                                      </button>
                                    </form>
                                  ) : (
                                    <button style={S.btn('ghost')} onClick={() => { setLinkingId(ident.id); setLinkResult(''); }}>
                                      Link user →
                                    </button>
                                  )
                                ) : (
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#5ED3EA' }}>
                                    {ident.matchedUserId?.slice(-8) ?? '—'}
                                    {ident.matchReason && (
                                      <span style={{ fontSize: 10, color: '#4A7A8A', marginLeft: 4 }}>
                                        [{ident.matchReason}]
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {linkResult && (
                <div style={{
                  marginTop: 10, fontSize: 12,
                  color: linkResult.startsWith('Error') ? '#F87171' : '#5ED3EA',
                  padding: '8px 12px', background: 'rgba(94,211,234,0.06)',
                  borderRadius: 6,
                }}>
                  {linkResult}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
