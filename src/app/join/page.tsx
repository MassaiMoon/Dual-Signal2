'use client';

/**
 * /join — DUAL // SIGNAL Passport onboarding.
 *
 * Step 1: Choose username (with live availability check)
 * Step 2: Connect community identities (all optional)
 * Step 3: Creating Passport (loading)
 * Step 4: Passport created — view / share
 *
 * No wallet required.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'username' | 'community' | 'creating' | 'done';
type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:     '100vh',
    background:    '#040E1A',
    color:         '#C8D8E8',
    fontFamily:    "'Inter', 'SF Pro Display', system-ui, sans-serif",
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
  },
  header: {
    width:      '100%',
    padding:    '40px 24px 0',
    textAlign:  'center',
  },
  logo: {
    fontSize:      20,
    fontWeight:    700,
    letterSpacing: '0.12em',
    color:         '#E8F4FC',
  },
  logoSlash: { color: '#5ED3EA' },
  tagline: {
    fontSize:      11,
    letterSpacing: '0.2em',
    color:         '#3A6070',
    margin:        '6px 0 0',
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
    background:    '#08182A',
    border:        '1px solid rgba(94,211,234,0.12)',
    borderRadius:  18,
    padding:       '40px 36px',
    width:         '100%',
    maxWidth:      480,
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
    boxSizing:     'border-box' as const,
  },
  eyebrow: {
    fontSize:      10,
    letterSpacing: '0.2em',
    color:         '#3A6070',
    textTransform: 'uppercase' as const,
    marginBottom:  10,
  },
  cardTitle: {
    margin:        '0 0 8px',
    fontSize:      22,
    fontWeight:    700,
    color:         '#E8F4FC',
  },
  cardDesc: {
    margin:        '0 0 28px',
    fontSize:      14,
    lineHeight:    1.65,
    color:         '#5A7A8A',
  },
  label: {
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '0.08em',
    color:         '#4A90A4',
    textTransform: 'uppercase' as const,
    marginBottom:  8,
    display:       'block',
  },
  inputWrap: {
    position:  'relative' as const,
    marginBottom: 6,
  },
  input: {
    width:        '100%',
    background:   '#040E1A',
    border:       '1px solid rgba(94,211,234,0.18)',
    borderRadius:  9,
    padding:      '13px 14px',
    fontSize:     15,
    color:        '#C8D8E8',
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box' as const,
  },
  inputFocused: {
    border: '1px solid rgba(94,211,234,0.45)',
  },
  availability: {
    fontSize:   12,
    marginTop:  6,
    marginBottom: 20,
    height:     16,
  },
  availableText: { color: '#4AC89A' },
  takenText:     { color: '#F87171' },
  checkingText:  { color: '#4A7A8A' },
  invalidText:   { color: '#F7C873' },
  hint: {
    fontSize:   12,
    color:      '#3A5060',
    marginBottom: 28,
    lineHeight: 1.55,
  },
  btnPrimary: {
    width:         '100%',
    marginTop:     16,
    padding:       '14px 0',
    background:    'linear-gradient(135deg, #0F3A55 0%, #0A5570 100%)',
    border:        '1px solid rgba(94,211,234,0.3)',
    borderRadius:  10,
    color:         '#A8EDF9',
    fontSize:      14,
    fontWeight:    600,
    cursor:        'pointer',
    textAlign:     'center' as const,
    letterSpacing: '0.05em',
    transition:    'opacity 0.15s',
  },
  btnDisabled: {
    opacity:  0.45,
    cursor:   'not-allowed',
  },
  btnSecondary: {
    background:  'transparent',
    border:      '1px solid rgba(94,211,234,0.12)',
    borderRadius: 10,
    color:       '#4A90A4',
    fontSize:    13,
    fontWeight:  600,
    cursor:      'pointer',
    padding:     '11px 20px',
    fontFamily:  'inherit',
  },
  btnRow: {
    display:  'flex',
    gap:      12,
    marginTop: 16,
  },
  errorMsg: {
    color:     '#F87171',
    fontSize:  13,
    margin:    '0 0 12px',
    textAlign: 'center' as const,
  },
  // Community cards
  communityList: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           12,
    marginBottom:  8,
  },
  communityCard: {
    background:   '#040E1A',
    border:       '1px solid rgba(94,211,234,0.1)',
    borderRadius:  10,
    padding:      '16px 16px 14px',
  },
  communityLabel: {
    display:       'flex',
    alignItems:    'center',
    gap:           8,
    marginBottom:  10,
  },
  communityIcon: {
    fontSize:    12,
    fontWeight:  700,
    letterSpacing: '0.04em',
    color:       '#5ED3EA',
    background:  'rgba(94,211,234,0.1)',
    borderRadius: 4,
    padding:     '2px 7px',
    minWidth:    28,
    textAlign:  'center' as const,
  },
  communityName: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#C8D8E8',
  },
  communityDesc: {
    fontSize:  11,
    color:     '#3A6070',
    margin:    '0 0 10px',
    lineHeight: 1.5,
  },
  communityInput: {
    width:        '100%',
    background:   '#08182A',
    border:       '1px solid rgba(94,211,234,0.12)',
    borderRadius:  7,
    padding:      '10px 12px',
    fontSize:     13,
    color:        '#C8D8E8',
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box' as const,
  },
  optionalNote: {
    fontSize:  12,
    color:     '#3A5060',
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  // Done screen
  successIcon: {
    width:          56,
    height:         56,
    borderRadius:   '50%',
    background:     'rgba(94,211,234,0.08)',
    border:         '1px solid rgba(94,211,234,0.25)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       24,
    color:          '#5ED3EA',
    margin:         '0 auto 20px',
  },
  summaryBox: {
    width:        '100%',
    background:   '#040E1A',
    border:       '1px solid rgba(94,211,234,0.1)',
    borderRadius:  10,
    padding:      '4px 16px',
    marginBottom: 20,
    boxSizing:    'border-box' as const,
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
    fontSize:      11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color:         '#3A6070',
    flexShrink:     0,
  },
  summaryVal: {
    fontSize:  13,
    color:     '#C8D8E8',
    textAlign: 'right' as const,
  },
  linksRow: {
    display:        'flex',
    alignItems:     'center',
    gap:             8,
    marginTop:       8,
    justifyContent: 'center',
  },
  linkMuted: {
    color:          '#3A6070',
    fontSize:       12,
    textDecoration: 'none',
  },
  dot: { color: '#1E3040', fontSize: 14 },
  footer: {
    padding:        '24px 16px',
    display:        'flex',
    alignItems:     'center',
    gap:             8,
    justifyContent: 'center',
  },
  footerText: { color: '#1E3040', fontSize: 12 },
  // Loading
  loadingWrap: {
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    gap:             16,
    padding:        '40px 0',
  },
  spinner: {
    width:        32,
    height:       32,
    border:       '2px solid rgba(94,211,234,0.15)',
    borderTop:    '2px solid #5ED3EA',
    borderRadius: '50%',
    animation:    'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize:  13,
    color:     '#4A7A8A',
    letterSpacing: '0.08em',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [step,       setStep]       = useState<Step>('username');
  const [username,   setUsername]   = useState('');
  const [avail,      setAvail]      = useState<AvailabilityState>('idle');
  const [availMsg,   setAvailMsg]   = useState('');
  const [x,          setX]          = useState('');
  const [telegram,   setTelegram]   = useState('');
  const [discord,    setDiscord]    = useState('');
  const [forum,      setForum]      = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState<{ username: string; badgeUrl: string; memberSince: string } | null>(null);
  const [inputFocus, setInputFocus] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Username availability debounce ─────────────────────────────────────────

  useEffect(() => {
    const raw = username.trim();
    if (!raw) { setAvail('idle'); setAvailMsg(''); return; }
    if (raw.length < 3) { setAvail('invalid'); setAvailMsg('At least 3 characters'); return; }
    if (raw.length > 24) { setAvail('invalid'); setAvailMsg('24 characters maximum'); return; }
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) {
      setAvail('invalid'); setAvailMsg('Letters, numbers, _ and - only'); return;
    }

    setAvail('checking');
    setAvailMsg('Checking…');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/public/join?username=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (data.available) {
          setAvail('available'); setAvailMsg('Username available');
        } else {
          setAvail('taken'); setAvailMsg(data.reason ?? 'Username already taken');
        }
      } catch {
        setAvail('idle'); setAvailMsg('');
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  // ── Step 1: Continue ───────────────────────────────────────────────────────

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (avail !== 'available') return;
    setError('');
    setStep('community');
  }

  // ── Step 2: Create Passport ────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    setStep('creating');

    try {
      const res = await fetch('/api/public/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          username:      username.trim(),
          x:             x.trim(),
          telegram:      telegram.trim(),
          discord:       discord.trim(),
          forum:         forum.trim(),
          walletAddress: walletAddress.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Passport creation failed. Please try again.');
        setStep('community');
        return;
      }

      setResult({ username: data.username, badgeUrl: data.badgeUrl, memberSince: data.memberSince });
      setStep('done');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStep('community');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Availability indicator ─────────────────────────────────────────────────

  function AvailabilityIndicator() {
    if (avail === 'idle') return <div style={S.availability} />;
    const [style, text] = avail === 'available'
      ? [S.availableText, `✓ ${availMsg}`]
      : avail === 'taken'
      ? [S.takenText,     `✕ ${availMsg}`]
      : avail === 'checking'
      ? [S.checkingText,  availMsg]
      : [S.invalidText,   `· ${availMsg}`];
    return <div style={{ ...S.availability, ...style }}>{text}</div>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <header style={S.header}>
        <div style={S.logo}>DUAL <span style={S.logoSlash}>//</span> SIGNAL</div>
        <p style={S.tagline}>Community Identity Passport</p>
      </header>

      <main style={S.main}>

        {/* ── Step 1: Username ────────────────────────────────────────────── */}
        {step === 'username' && (
          <div style={S.card}>
            <p style={S.eyebrow}>Step 1 of 2</p>
            <h1 style={S.cardTitle}>Register Your Signal</h1>
            <p style={S.cardDesc}>
              Create your Community Identity Passport. Choose your DUAL&nbsp;//&nbsp;SIGNAL username.
            </p>

            <form onSubmit={handleContinue}>
              <label style={S.label}>Username</label>
              <div style={S.inputWrap}>
                <input
                  style={{ ...S.input, ...(inputFocus ? S.inputFocused : {}) }}
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setInputFocus(true)}
                  onBlur={() => setInputFocus(false)}
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  maxLength={24}
                />
              </div>
              <AvailabilityIndicator />

              <p style={S.hint}>
                Build your Signal through your participation in the DUAL community.
                No wallet required.
              </p>

              {error && <p style={S.errorMsg}>{error}</p>}

              <button
                type="submit"
                style={{
                  ...S.btnPrimary,
                  ...(avail !== 'available' ? S.btnDisabled : {}),
                }}
                disabled={avail !== 'available'}
              >
                Continue →
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Community ───────────────────────────────────────────── */}
        {step === 'community' && (
          <div style={S.card}>
            <p style={S.eyebrow}>Step 2 of 2</p>
            <h1 style={S.cardTitle}>Connect Your Community</h1>
            <p style={S.cardDesc}>
              Connect the places where you participate in DUAL. You can add or change these later.
            </p>

            {error && <p style={S.errorMsg}>{error}</p>}

            <form onSubmit={handleCreate}>
              <div style={S.communityList}>

                {/* X */}
                <div style={S.communityCard}>
                  <div style={S.communityLabel}>
                    <span style={S.communityIcon}>𝕏</span>
                    <span style={S.communityName}>X</span>
                  </div>
                  <p style={S.communityDesc}>Track qualifying DUAL posts and public views.</p>
                  <input
                    style={S.communityInput}
                    type="text"
                    placeholder="@username"
                    value={x}
                    onChange={e => setX(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Telegram */}
                <div style={S.communityCard}>
                  <div style={S.communityLabel}>
                    <span style={S.communityIcon}>TG</span>
                    <span style={S.communityName}>Telegram</span>
                  </div>
                  <p style={S.communityDesc}>Track active days in the DUAL community.</p>
                  <input
                    style={S.communityInput}
                    type="text"
                    placeholder="@username"
                    value={telegram}
                    onChange={e => setTelegram(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Discord */}
                <div style={S.communityCard}>
                  <div style={S.communityLabel}>
                    <span style={S.communityIcon}>DC</span>
                    <span style={S.communityName}>Discord</span>
                  </div>
                  <p style={S.communityDesc}>Track active days in the DUAL Discord.</p>
                  <input
                    style={S.communityInput}
                    type="text"
                    placeholder="username"
                    value={discord}
                    onChange={e => setDiscord(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Dual Forum */}
                <div style={S.communityCard}>
                  <div style={S.communityLabel}>
                    <span style={S.communityIcon}>GOV</span>
                    <span style={S.communityName}>Dual Forum</span>
                  </div>
                  <p style={S.communityDesc}>Track participation in DUAL governance proposals.</p>
                  <input
                    style={S.communityInput}
                    type="text"
                    placeholder="forum username"
                    value={forum}
                    onChange={e => setForum(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Wallet Address */}
                <div style={S.communityCard}>
                  <div style={S.communityLabel}>
                    <span style={S.communityIcon}>WALLET</span>
                    <span style={S.communityName}>Wallet Address</span>
                  </div>
                  <p style={S.communityDesc}>Where you want to receive your Passport NFT (optional).</p>
                  <input
                    style={S.communityInput}
                    type="text"
                    placeholder="0x… or Solana address"
                    value={walletAddress}
                    onChange={e => setWalletAddress(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

              </div>

              <p style={S.optionalNote}>All community connections are optional.</p>

              <div style={S.btnRow}>
                <button
                  type="button"
                  style={S.btnSecondary}
                  onClick={() => { setStep('username'); setError(''); }}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  style={{
                    ...S.btnPrimary,
                    flex: 1,
                    marginTop: 0,
                    ...(submitting ? S.btnDisabled : {}),
                  }}
                  disabled={submitting}
                >
                  Create Passport
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Creating ────────────────────────────────────────────── */}
        {step === 'creating' && (
          <div style={S.card}>
            <div style={S.loadingWrap}>
              <div style={S.spinner} />
              <p style={S.loadingText}>Creating your Passport…</p>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div style={S.card}>
            <div style={S.successIcon}>✓</div>
            <h1 style={{ ...S.cardTitle, textAlign: 'center' }}>Your Signal is Live</h1>
            <p style={{ ...S.cardDesc, textAlign: 'center' }}>
              Your DUAL // SIGNAL Passport has been created.
              Your Signal grows through your participation in the DUAL community.
            </p>

            <div style={S.summaryBox}>
              <div style={S.summaryRow}>
                <span style={S.summaryKey}>Username</span>
                <span style={{ ...S.summaryVal, color: '#5ED3EA', fontWeight: 600 }}>{result.username}</span>
              </div>
              <div style={S.summaryRow}>
                <span style={S.summaryKey}>Signal</span>
                <span style={S.summaryVal}>0 / 1000</span>
              </div>
              <div style={{ ...S.summaryRow, borderBottom: 'none' }}>
                <span style={S.summaryKey}>Tier</span>
                <span style={{ ...S.summaryVal, color: '#4A90A4' }}>INITIATE</span>
              </div>
            </div>

            <a
              href={result.badgeUrl}
              style={{ ...S.btnPrimary, display: 'block', textDecoration: 'none' }}
            >
              View My Passport →
            </a>

            <div style={S.linksRow}>
              <Link href="/leaderboard" style={S.linkMuted}>Leaderboard</Link>
              <span style={S.dot}>·</span>
              <button
                style={{
                  background:     'none',
                  border:         'none',
                  color:          '#3A6070',
                  fontSize:       12,
                  cursor:         'pointer',
                  padding:         0,
                  fontFamily:     'inherit',
                  textDecoration: 'underline',
                }}
                onClick={() => {
                  setStep('username');
                  setUsername('');
                  setAvail('idle');
                  setAvailMsg('');
                  setX(''); setTelegram(''); setDiscord(''); setForum(''); setWalletAddress('');
                  setResult(null);
                  setError('');
                }}
              >
                Register another
              </button>
            </div>
          </div>
        )}

      </main>

      <footer style={S.footer}>
        <Link href="/leaderboard" style={{ ...S.footerText, color: '#3A6070', textDecoration: 'none' }}>
          Leaderboard
        </Link>
        <span style={S.dot}>·</span>
        <span style={S.footerText}>DUAL Network · Chain 6301</span>
      </footer>
    </div>
  );
}
