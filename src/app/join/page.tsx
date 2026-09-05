'use client';

/**
 * /join — Public member onboarding page.
 *
 * Step 1: Enter wallet address → check if badge exists
 * Step 2: Fill in social handles (X, Telegram)
 * Step 3: Submit → update existing badge or show "pending mint" message
 * Step 4: Confirmation
 *
 * No wallet connect — manual address entry only.
 */

import { useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'wallet' | 'socials' | 'done' | 'pending';

interface BadgeData {
  dualObjectId:   string;
  tier:           string;
  signalScore:    number;
  memberSince:    string;
  xHandle:        string;
  telegramHandle: string;
  discordHandle:  string;
  badgeUrl:       string;
}

// ── Tier styling ─────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  LEGEND:      '#FFD700',
  GENESIS:     '#F7C873',
  STAKEHOLDER: '#A8EDF9',
  BUILDER:     '#7FE4F4',
  EXPLORER:    '#5ED3EA',
  INITIATE:    '#4A90A4',
};

function tierColor(tier: string) {
  return TIER_COLOR[tier] ?? '#4A90A4';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [step,           setStep]           = useState<Step>('wallet');
  const [walletAddress,  setWalletAddress]  = useState('');
  const [badge,          setBadge]          = useState<BadgeData | null>(null);
  const [xHandle,        setXHandle]        = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [resultUrl,      setResultUrl]      = useState('');

  // ── Step 1: look up wallet ─────────────────────────────────────────────────

  async function handleWalletLookup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const addr = walletAddress.trim();
    if (!addr) { setError('Please enter your wallet address.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/public/profile?wallet=${encodeURIComponent(addr)}`);
      if (res.ok) {
        const data: BadgeData = await res.json();
        setBadge(data);
        // Pre-fill with existing handles
        setXHandle(data.xHandle        ? `@${data.xHandle}`        : '');
        setTelegramHandle(data.telegramHandle ? `@${data.telegramHandle}` : '');
        setStep('socials');
      } else if (res.status === 404) {
        setBadge(null);
        setStep('socials');
      } else {
        const d = await res.json();
        setError(d.error ?? 'Lookup failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: submit handles ─────────────────────────────────────────────────

  async function handleSocialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const x  = xHandle.replace(/^@/, '').trim();
    const tg = telegramHandle.replace(/^@/, '').trim();

    if (!x && !tg) {
      setError('Please fill in at least one social handle.');
      return;
    }

    setLoading(true);

    // Case A: badge exists → PATCH handles directly
    if (badge) {
      try {
        const res = await fetch('/api/public/profile', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            walletAddress: walletAddress.trim(),
            xHandle:        x,
            telegramHandle: tg,
          }),
        });
        const data = await res.json();
        if (res.ok && data.updated) {
          setResultUrl(data.badgeUrl);
          setStep('done');
        } else {
          setError(data.error ?? 'Update failed. Please try again.');
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Case B: no badge yet → notify admin by email, show pending screen
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      await fetch('/api/public/request-mint', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress: walletAddress.trim(), xHandle: x, telegramHandle: tg }),
        signal:  ctrl.signal,
      });
      clearTimeout(timer);
    } catch {
      // Email failure / timeout is non-blocking — always show confirmation screen
    }
    setLoading(false);
    setStep('pending');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <span style={styles.logo}>DUAL <span style={styles.logoSlash}>//</span> SIGNAL</span>
        </div>
        <p style={styles.tagline}>Community Identity Badge</p>
      </header>

      <main style={styles.main}>
        {/* ── Step 1: Wallet ──────────────────────────────────────────────── */}
        {step === 'wallet' && (
          <div style={styles.card}>
            <h1 style={styles.cardTitle}>Register Your Signal</h1>
            <p style={styles.cardDesc}>
              Enter your wallet address to check if you already have a DUAL // SIGNAL badge,
              or to register your social handles for a future mint.
            </p>
            <form onSubmit={handleWalletLookup} style={styles.form}>
              <label style={styles.label}>Wallet Address</label>
              <input
                style={styles.input}
                type="text"
                placeholder="0x..."
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              {error && <p style={styles.errorMsg}>{error}</p>}
              <button type="submit" style={styles.btnPrimary} disabled={loading}>
                {loading ? 'Looking up…' : 'Continue →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Socials ─────────────────────────────────────────────── */}
        {step === 'socials' && (
          <div style={styles.card}>
            {badge ? (
              <>
                <div style={styles.badgePreview}>
                  <div
                    style={{
                      ...styles.tierPill,
                      color:       tierColor(badge.tier),
                      borderColor: tierColor(badge.tier),
                    }}
                  >
                    {badge.tier}
                  </div>
                  <p style={styles.badgeScore}>
                    <span style={styles.scoreNum}>{badge.signalScore}</span>
                    <span style={styles.scoreLabel}> SIGNAL</span>
                  </p>
                  <p style={styles.badgeWallet}>
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                  </p>
                </div>
                <p style={styles.cardDesc}>
                  Badge found! Update your social handles below so we can track your
                  contributions across platforms.
                </p>
              </>
            ) : (
              <>
                <div style={styles.noBadgeNotice}>
                  <span style={styles.noBadgeIcon}>⬡</span>
                  <p style={styles.noBadgeText}>No badge found for this wallet yet.</p>
                  <p style={styles.noBadgeSubtext}>
                    Fill in your handles below and an admin will mint your badge.
                  </p>
                </div>
              </>
            )}

            <form onSubmit={handleSocialsSubmit} style={styles.form}>
              <label style={styles.label}>𝕏 (Twitter) Handle</label>
              <input
                style={styles.input}
                type="text"
                placeholder="@yourhandle"
                value={xHandle}
                onChange={e => setXHandle(e.target.value)}
                autoComplete="off"
              />

              <label style={{ ...styles.label, marginTop: 16 }}>Telegram Handle</label>
              <input
                style={styles.input}
                type="text"
                placeholder="@yourusername"
                value={telegramHandle}
                onChange={e => setTelegramHandle(e.target.value)}
                autoComplete="off"
              />

              {error && <p style={styles.errorMsg}>{error}</p>}

              <div style={styles.btnRow}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => { setStep('wallet'); setError(''); }}
                >
                  ← Back
                </button>
                <button type="submit" style={styles.btnPrimary} disabled={loading}>
                  {loading ? 'Saving…' : badge ? 'Save Handles' : 'Submit for Mint'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Done ────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={styles.card}>
            <div style={styles.successIcon}>✓</div>
            <h1 style={styles.cardTitle}>Handles Updated</h1>
            <p style={styles.cardDesc}>
              Your social handles are linked to your DUAL // SIGNAL badge.
              Your SIGNAL score will update as your contributions are tracked.
            </p>
            <a
              href={resultUrl}
              style={styles.btnPrimary}
              target="_blank"
              rel="noopener noreferrer"
            >
              View My Badge →
            </a>
            <div style={styles.linksRow}>
              <Link href="/leaderboard" style={styles.linkMuted}>Leaderboard</Link>
              <span style={styles.dot}>·</span>
              <button
                style={styles.linkBtn}
                onClick={() => {
                  setStep('wallet');
                  setWalletAddress('');
                  setBadge(null);
                  setXHandle('');
                  setTelegramHandle('');
                  setResultUrl('');
                }}
              >
                Register another wallet
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Pending mint ─────────────────────────────────────────── */}
        {step === 'pending' && (
          <div style={styles.card}>
            <div style={styles.successIcon} aria-hidden>✓</div>
            <h1 style={styles.cardTitle}>Request Sent</h1>
            <p style={styles.cardDesc}>
              Your details have been submitted. An admin will review and mint
              your DUAL // SIGNAL badge — check back on the leaderboard soon.
            </p>

            <div style={styles.summaryBox}>
              <div style={styles.summaryRow}>
                <span style={styles.summaryKey}>Wallet</span>
                <span style={styles.summaryVal}>
                  {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                </span>
              </div>
              {xHandle && (
                <div style={styles.summaryRow}>
                  <span style={styles.summaryKey}>𝕏</span>
                  <span style={styles.summaryVal}>@{xHandle.replace(/^@/, '')}</span>
                </div>
              )}
              {telegramHandle && (
                <div style={styles.summaryRow}>
                  <span style={styles.summaryKey}>Telegram</span>
                  <span style={styles.summaryVal}>@{telegramHandle.replace(/^@/, '')}</span>
                </div>
              )}
            </div>

            <div style={styles.linksRow}>
              <Link href="/leaderboard" style={styles.linkMuted}>Leaderboard</Link>
              <span style={styles.dot}>·</span>
              <button
                style={styles.linkBtn}
                onClick={() => {
                  setStep('wallet');
                  setWalletAddress('');
                  setBadge(null);
                  setXHandle('');
                  setTelegramHandle('');
                }}
              >
                Register another wallet
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <Link href="/leaderboard" style={styles.footerLink}>Leaderboard</Link>
        <span style={styles.dot}>·</span>
        <span style={styles.footerText}>DUAL Network · Chain 6301</span>
      </footer>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:       '100vh',
    background:      '#0A1525',
    color:           '#C8D8E8',
    fontFamily:      "'Inter', 'SF Pro Display', system-ui, sans-serif",
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
  },
  header: {
    width:      '100%',
    padding:    '40px 24px 0',
    textAlign:  'center',
  },
  logoRow: {
    display:        'flex',
    justifyContent: 'center',
    marginBottom:   6,
  },
  logo: {
    fontSize:      22,
    fontWeight:    700,
    letterSpacing: '0.1em',
    color:         '#E8F4FC',
  },
  logoSlash: {
    color: '#5ED3EA',
  },
  tagline: {
    fontSize:      13,
    letterSpacing: '0.18em',
    color:         '#4A90A4',
    margin:        0,
    textTransform: 'uppercase',
  },
  main: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 16px',
    width:          '100%',
  },
  card: {
    background:   '#0F1E30',
    border:       '1px solid rgba(94,211,234,0.12)',
    borderRadius: 16,
    padding:      '40px 36px',
    width:        '100%',
    maxWidth:     480,
    display:      'flex',
    flexDirection:'column',
    alignItems:   'center',
    gap:           8,
  },
  cardTitle: {
    margin:      '0 0 8px',
    fontSize:    22,
    fontWeight:  700,
    color:       '#E8F4FC',
    textAlign:   'center',
  },
  cardDesc: {
    margin:     '0 0 24px',
    fontSize:   14,
    lineHeight: 1.65,
    color:      '#6A8FAA',
    textAlign:  'center',
  },
  form: {
    width:         '100%',
    display:       'flex',
    flexDirection: 'column',
    gap:            0,
  },
  label: {
    fontSize:     12,
    fontWeight:   600,
    letterSpacing:'0.08em',
    color:        '#4A90A4',
    textTransform:'uppercase',
    marginBottom:  8,
    display:      'block',
  },
  input: {
    width:        '100%',
    background:   '#0A1525',
    border:       '1px solid rgba(94,211,234,0.2)',
    borderRadius:  8,
    padding:      '12px 14px',
    fontSize:      15,
    color:        '#C8D8E8',
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box',
    marginBottom:  20,
  },
  btnPrimary: {
    width:          '100%',
    marginTop:       8,
    padding:        '13px 0',
    background:     'linear-gradient(135deg, #1A4E6E 0%, #0D6E8A 100%)',
    border:         '1px solid rgba(94,211,234,0.3)',
    borderRadius:    10,
    color:          '#A8EDF9',
    fontSize:       15,
    fontWeight:     600,
    cursor:         'pointer',
    textAlign:      'center',
    letterSpacing:  '0.04em',
    textDecoration: 'none',
    display:        'block',
  },
  btnSecondary: {
    flex:        1,
    padding:     '12px 0',
    background:  'transparent',
    border:      '1px solid rgba(94,211,234,0.15)',
    borderRadius: 10,
    color:       '#4A90A4',
    fontSize:    14,
    fontWeight:  600,
    cursor:      'pointer',
    fontFamily:  'inherit',
  },
  btnRow: {
    display:   'flex',
    gap:        12,
    marginTop:  8,
  },
  errorMsg: {
    color:       '#F87171',
    fontSize:    13,
    margin:      '0 0 12px',
    textAlign:   'center',
  },
  badgePreview: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:             6,
    marginBottom:   20,
  },
  tierPill: {
    padding:      '4px 14px',
    border:       '1px solid',
    borderRadius:  20,
    fontSize:     11,
    fontWeight:   700,
    letterSpacing:'0.14em',
    textTransform:'uppercase',
  },
  badgeScore: {
    margin: 0,
  },
  scoreNum: {
    fontSize:   28,
    fontWeight: 800,
    color:      '#E8F4FC',
  },
  scoreLabel: {
    fontSize:   13,
    color:      '#4A90A4',
  },
  badgeWallet: {
    fontSize:    12,
    color:       '#4A90A4',
    fontFamily:  'monospace',
    margin:       0,
  },
  noBadgeNotice: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:             6,
    marginBottom:   20,
    padding:        '20px 16px',
    background:     'rgba(94,211,234,0.04)',
    borderRadius:    12,
    border:         '1px solid rgba(94,211,234,0.08)',
    width:          '100%',
    boxSizing:      'border-box',
  },
  noBadgeIcon: {
    fontSize: 28,
    color:    '#4A90A4',
  },
  noBadgeText: {
    margin:     0,
    fontSize:   14,
    fontWeight: 600,
    color:      '#C8D8E8',
    textAlign:  'center',
  },
  noBadgeSubtext: {
    margin:    0,
    fontSize:  13,
    color:     '#4A90A4',
    textAlign: 'center',
  },
  successIcon: {
    width:          56,
    height:         56,
    borderRadius:   '50%',
    background:     'rgba(94,211,234,0.1)',
    border:         '1px solid rgba(94,211,234,0.3)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       24,
    color:          '#5ED3EA',
    marginBottom:   12,
  },
  pendingIcon: {
    fontSize:    40,
    color:       '#4A90A4',
    marginBottom: 12,
  },
  summaryBox: {
    width:        '100%',
    background:   '#0A1525',
    border:       '1px solid rgba(94,211,234,0.12)',
    borderRadius:  10,
    padding:      '4px 16px',
    marginBottom: 20,
    boxSizing:    'border-box',
  },
  summaryRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '10px 0',
    borderBottom:   '1px solid rgba(94,211,234,0.07)',
    gap:             12,
  },
  summaryKey: {
    fontSize:     12,
    letterSpacing:'0.08em',
    textTransform:'uppercase',
    color:        '#4A90A4',
    flexShrink:    0,
  },
  summaryVal: {
    fontSize:   13,
    color:      '#C8D8E8',
    fontFamily: 'monospace',
    textAlign:  'right',
    wordBreak:  'break-all',
  },
  copyBox: {
    width:        '100%',
    background:   '#0A1525',
    border:       '1px solid rgba(94,211,234,0.15)',
    borderRadius:  10,
    padding:      '16px',
    marginBottom: 20,
    position:     'relative',
    boxSizing:    'border-box',
  },
  copyBoxLabel: {
    fontSize:    11,
    letterSpacing:'0.08em',
    textTransform:'uppercase',
    color:       '#4A90A4',
    marginBottom: 8,
    margin:       '0 0 8px',
  },
  copyBoxCode: {
    display:    'block',
    fontSize:   13,
    lineHeight: 1.7,
    color:      '#C8D8E8',
    fontFamily: 'monospace',
    whiteSpace: 'pre',
  },
  copyBtn: {
    marginTop:   10,
    display:     'block',
    background:  'transparent',
    border:      '1px solid rgba(94,211,234,0.2)',
    borderRadius: 6,
    color:       '#4A90A4',
    fontSize:    12,
    fontWeight:  600,
    padding:     '5px 14px',
    cursor:      'pointer',
    fontFamily:  'inherit',
  },
  linksRow: {
    display:        'flex',
    alignItems:     'center',
    gap:             8,
    marginTop:       8,
    justifyContent: 'center',
  },
  linkMuted: {
    color:          '#4A90A4',
    fontSize:       13,
    textDecoration: 'none',
  },
  linkBtn: {
    background:     'none',
    border:         'none',
    color:          '#4A90A4',
    fontSize:       13,
    cursor:         'pointer',
    padding:         0,
    fontFamily:     'inherit',
    textDecoration: 'underline',
  },
  dot: {
    color:  '#2A4A5E',
    fontSize: 14,
  },
  footer: {
    padding:        '24px 16px',
    display:        'flex',
    alignItems:     'center',
    gap:             8,
    justifyContent: 'center',
  },
  footerLink: {
    color:          '#4A90A4',
    fontSize:       13,
    textDecoration: 'none',
  },
  footerText: {
    color:    '#2A4A5E',
    fontSize: 13,
  },
};
