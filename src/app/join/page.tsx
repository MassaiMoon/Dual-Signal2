'use client';

/**
 * /join — DUAL // SIGNAL Passport onboarding.
 *
 * Step 0: Enter email + send magic link (if not already authenticated)
 * Step 1: Choose username
 * Step 2: Connect community identities (all optional)
 * Step 3: Creating Passport (loading)
 * Step 4: Passport created — view / go to dashboard
 *
 * On mount, checks /api/me:
 *   - 401           → show email step
 *   - 200 + badge   → redirect to /me (already has Passport)
 *   - 200 + no badge → go directly to username step
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'checking' | 'email' | 'email_sent' | 'username' | 'community' | 'creating' | 'done';
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
    position:      'relative',
    overflow:      'hidden',
  },
  bgImage: {
    position:      'absolute',
    top:           0,
    left:          '50%',
    transform:     'translateX(-50%)',
    width:         '100%',
    maxWidth:      '1780px',
    minWidth:      '1100px',
    height:        'auto',
    display:       'block',
    pointerEvents: 'none',
    userSelect:    'none' as const,
    zIndex:        0,
  },
  header: {
    width:           '100%',
    padding:         '52px 24px 28px',
    textAlign:       'center',
    position:        'relative',
    zIndex:          1,
    background:      'linear-gradient(to bottom, #040E1A 65%, transparent)',
  },
  logo: {
    fontSize:      22,
    fontWeight:    700,
    letterSpacing: '0.22em',
    color:         '#E8F4FC',
    textTransform: 'uppercase' as const,
  },
  logoSlash: { color: '#5ED3EA' },
  tagline: {
    fontSize:      10,
    letterSpacing: '0.26em',
    color:         '#243545',
    margin:        '9px 0 0',
    textTransform: 'uppercase' as const,
  },
  main: {
    flex:     1,
    display:  'flex',
    width:    '100%',
    position: 'relative',
    zIndex:   1,
  },
  card: {
    background:    '#071525',
    border:        '1px solid rgba(94,211,234,0.09)',
    borderRadius:  16,
    padding:       '40px 40px',
    width:         '100%',
    maxWidth:      480,
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
    boxSizing:     'border-box' as const,
  },
  eyebrow: {
    fontSize:      9,
    letterSpacing: '0.24em',
    color:         '#2A5060',
    textTransform: 'uppercase' as const,
    marginBottom:  14,
  },
  eyebrowSlash: { color: '#5ED3EA' },
  cardTitle: {
    margin:        '0 0 10px',
    fontSize:      26,
    fontWeight:    700,
    color:         '#E8F4FC',
    letterSpacing: '-0.01em',
    lineHeight:    1.2,
  },
  cardDesc: {
    margin:        '0 0 28px',
    fontSize:      14,
    lineHeight:    1.7,
    color:         '#3A5A6A',
  },
  label: {
    fontSize:      10,
    fontWeight:    600,
    letterSpacing: '0.18em',
    color:         '#3A5A6A',
    textTransform: 'uppercase' as const,
    marginBottom:  10,
    display:       'block',
  },
  inputWrap: {
    position:     'relative' as const,
    marginBottom: 8,
  },
  input: {
    width:       '100%',
    background:  '#040E1A',
    border:      '1px solid rgba(94,211,234,0.14)',
    borderRadius: 8,
    padding:     '13px 16px',
    fontSize:    15,
    color:       '#C8D8E8',
    fontFamily:  'inherit',
    outline:     'none',
    boxSizing:   'border-box' as const,
  },
  inputFocused: {
    border: '1px solid rgba(94,211,234,0.38)',
  },
  availability: {
    fontSize:     12,
    marginTop:    4,
    marginBottom: 16,
    height:       18,
    color:        '#3A5060',
  },
  availableText: { color: '#4AC89A' },
  takenText:     { color: '#F87171' },
  checkingText:  { color: '#3A5A6A' },
  invalidText:   { color: '#F7C873' },
  hint: {
    fontSize:     13,
    color:        '#2A4050',
    marginBottom: 24,
    lineHeight:   1.65,
  },
  btnPrimary: {
    width:         '100%',
    marginTop:     16,
    padding:       '15px 0',
    background:    '#0EB4D0',
    border:        'none',
    borderRadius:  10,
    color:         '#FFFFFF',
    fontSize:      12,
    fontWeight:    700,
    cursor:        'pointer',
    textAlign:     'center' as const,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    transition:    'opacity 0.15s',
    fontFamily:    'inherit',
  },
  btnDisabled: {
    opacity: 0.35,
    cursor:  'not-allowed',
  },
  btnSecondary: {
    background:    'transparent',
    border:        '1px solid rgba(94,211,234,0.10)',
    borderRadius:   10,
    color:         '#3A5A6A',
    fontSize:      13,
    fontWeight:    600,
    cursor:        'pointer',
    padding:       '12px 20px',
    fontFamily:    'inherit',
    letterSpacing: '0.04em',
  },
  btnRow: {
    display:   'flex',
    gap:       12,
    marginTop: 16,
  },
  errorMsg: {
    color:     '#F87171',
    fontSize:  13,
    margin:    '0 0 12px',
    textAlign: 'center' as const,
  },
  communityList: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           10,
    marginBottom:  8,
  },
  communityCard: {
    background:   '#040E1A',
    border:       '1px solid rgba(94,211,234,0.08)',
    borderRadius:  10,
    padding:      '14px 16px 12px',
  },
  communityLabel: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    marginBottom: 8,
  },
  communityIcon: {
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: '0.04em',
    color:         '#5ED3EA',
    background:    'rgba(94,211,234,0.07)',
    borderRadius:   4,
    padding:       '2px 7px',
    minWidth:       28,
    textAlign:     'center' as const,
  },
  communityName: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#A8B8C8',
  },
  communityDesc: {
    fontSize:  11,
    color:     '#2A3A4A',
    margin:    '0 0 8px',
    lineHeight: 1.5,
  },
  communityInput: {
    width:       '100%',
    background:  '#071525',
    border:      '1px solid rgba(94,211,234,0.09)',
    borderRadius: 6,
    padding:     '9px 12px',
    fontSize:    13,
    color:       '#C8D8E8',
    fontFamily:  'inherit',
    outline:     'none',
    boxSizing:   'border-box' as const,
  },
  optionalNote: {
    fontSize:      11,
    color:         '#1E3040',
    textAlign:     'center' as const,
    marginTop:     8,
    marginBottom:  4,
    letterSpacing: '0.06em',
  },
  successIcon: {
    width:          52,
    height:         52,
    borderRadius:   '50%',
    background:     'rgba(94,211,234,0.06)',
    border:         '1px solid rgba(94,211,234,0.20)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       22,
    color:          '#5ED3EA',
    margin:         '0 auto 20px',
  },
  summaryBox: {
    width:        '100%',
    background:   '#040E1A',
    border:       '1px solid rgba(94,211,234,0.08)',
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
    borderBottom:   '1px solid rgba(94,211,234,0.06)',
    gap:             12,
  },
  summaryKey: {
    fontSize:      10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color:         '#2A3A4A',
    flexShrink:     0,
  },
  summaryVal: {
    fontSize:  13,
    color:     '#C8D8E8',
    textAlign: 'right' as const,
  },
  sentWrap: {
    textAlign: 'center' as const,
    padding:   '8px 0',
  },
  sentIcon: {
    fontSize:    40,
    display:     'block',
    marginBottom: 16,
  },
  sentTitle: {
    margin:     '0 0 12px',
    fontSize:   22,
    fontWeight: 700,
    color:      '#E8F4FC',
  },
  sentDesc: {
    fontSize:   14,
    color:      '#3A5A6A',
    lineHeight: 1.7,
    margin:     '0 0 20px',
  },
  backLink: {
    background:     'none',
    border:         'none',
    color:          '#2A3A4A',
    fontSize:       12,
    cursor:         'pointer',
    fontFamily:     'inherit',
    textDecoration: 'underline',
    display:        'block',
    textAlign:      'center' as const,
    marginTop:      8,
  },
  footer: {
    position:       'relative',
    zIndex:         1,
    padding:        '16px 40px 32px',
    display:        'flex',
    alignItems:     'center',
    width:          '100%',
    maxWidth:       580,
    gap:             0,
  },
  footerLine: {
    flex:       '1 1 0',
    height:     1,
    background: 'rgba(94,211,234,0.06)',
  },
  footerCenter: {
    display:        'flex',
    alignItems:     'center',
    gap:             6,
    padding:        '0 18px',
    flexShrink:     0,
  },
  footerText: {
    color:         '#172030',
    fontSize:      10,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
  },
  footerDot: {
    color:    '#172030',
    fontSize:  10,
  },
  loadingWrap: {
    display:       'flex',
    flexDirection: 'column' as const,
    alignItems:    'center',
    gap:           16,
    padding:       '40px 0',
  },
  spinner: {
    width:       32,
    height:      32,
    border:      '2px solid rgba(94,211,234,0.12)',
    borderTop:   '2px solid #5ED3EA',
    borderRadius: '50%',
    animation:   'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize:      13,
    color:         '#3A5A6A',
    letterSpacing: '0.10em',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [step,       setStep]       = useState<Step>('checking');
  const [email,      setEmail]      = useState('');
  const [emailFocus, setEmailFocus] = useState(false);
  const [sending,    setSending]    = useState(false);
  const [username,   setUsername]   = useState('');
  const [avail,      setAvail]      = useState<AvailabilityState>('idle');
  const [availMsg,   setAvailMsg]   = useState('');
  const [x,          setX]          = useState('');
  const [telegram,   setTelegram]   = useState('');
  const [discord,    setDiscord]    = useState('');
  const [forum,      setForum]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState<{ username: string; badgeUrl: string; memberSince: string } | null>(null);
  const [inputFocus, setInputFocus] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On mount: check session ────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/me')
      .then(async r => {
        if (r.status === 401) {
          setStep('email');
          return;
        }
        if (r.ok) {
          const data = await r.json();
          if (data.badge) {
            window.location.href = '/me';
          } else {
            setStep('username');
          }
        } else {
          setStep('email');
        }
      })
      .catch(() => setStep('email'));
  }, []);

  // ── Username availability debounce ─────────────────────────────────────────

  useEffect(() => {
    if (step !== 'username') return;
    const raw = username.trim();
    if (!raw) { setAvail('idle'); setAvailMsg(''); return; }
    if (raw.length < 3)  { setAvail('invalid'); setAvailMsg('At least 3 characters'); return; }
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
  }, [username, step]);

  // ── Step 0: Send magic link ────────────────────────────────────────────────

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email address.'); return; }
    setSending(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/send-login-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
      setStep('email_sent');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // ── Step 1: Continue to community ─────────────────────────────────────────

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
          username: username.trim(),
          x:        x.trim(),
          telegram: telegram.trim(),
          discord:  discord.trim(),
          forum:    forum.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If already has a passport → redirect to /me
        if (res.status === 409 && data.badgeUrl) {
          window.location.href = '/me';
          return;
        }
        // If session expired → back to email step
        if (res.status === 401) {
          setError('Session expired. Please log in again.');
          setStep('email');
          return;
        }
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .join-main { justify-content: center; align-items: center; padding: 48px 16px; }
        @media (max-width: 768px) {
          .join-bg-img { opacity: 0.55; }
          .join-main { justify-content: flex-start; align-items: flex-start; padding: 12px 16px; }
        }
      `}</style>

      {/* Background artwork */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/dual-signal/join-background.png"
        className="join-bg-img"
        style={S.bgImage}
        alt=""
        aria-hidden="true"
        draggable={false}
      />

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo}>DUAL <span style={S.logoSlash}>//</span> SIGNAL</div>
        <p style={S.tagline}>Community Identity Passport</p>
      </header>

      <main style={S.main} className="join-main">

        {/* ── Checking session ────────────────────────────────────────────── */}
        {step === 'checking' && (
          <div style={S.card}>
            <div style={S.loadingWrap}>
              <div style={S.spinner} />
              <p style={S.loadingText}>Loading…</p>
            </div>
          </div>
        )}

        {/* ── Step 0: Email ───────────────────────────────────────────────── */}
        {step === 'email' && (
          <div style={S.card}>
            <p style={S.eyebrow}>
              STEP 01 <span style={S.eyebrowSlash}>//</span> ACCOUNT
            </p>
            <h1 style={S.cardTitle}>Create Your Account</h1>
            <p style={S.cardDesc}>
              Enter your email to receive a secure login link. No password required.
            </p>

            {error && <p style={S.errorMsg}>{error}</p>}

            <form onSubmit={handleSendLink}>
              <label style={S.label} htmlFor="join-email">Email Address</label>
              <div style={S.inputWrap}>
                <input
                  id="join-email"
                  style={{ ...S.input, ...(emailFocus ? S.inputFocused : {}) }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <p style={S.hint}>
                We&apos;ll send you a magic link. No password needed. Your email is private and never shown publicly.
              </p>

              <button
                type="submit"
                style={{ ...S.btnPrimary, ...(sending ? S.btnDisabled : {}) }}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Send Login Link →'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link href="/login" style={{ color: '#2A3A4A', fontSize: 12, textDecoration: 'underline' }}>
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 0b: Email sent ─────────────────────────────────────────── */}
        {step === 'email_sent' && (
          <div style={S.card}>
            <div style={S.sentWrap}>
              <span style={S.sentIcon}>✉</span>
              <h1 style={S.sentTitle}>Check Your Email</h1>
              <p style={S.sentDesc}>
                We sent a secure login link to{' '}
                <strong style={{ color: '#A8C8D8' }}>{email.trim()}</strong>.
                <br /><br />
                Click the link in your email to continue. The link expires in 15 minutes.
              </p>
              <button style={S.backLink} onClick={() => { setStep('email'); setError(''); }}>
                Try a different email
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Username ────────────────────────────────────────────── */}
        {step === 'username' && (
          <div style={S.card}>
            <p style={S.eyebrow}>
              STEP 02 <span style={S.eyebrowSlash}>//</span> IDENTITY
            </p>
            <h1 style={S.cardTitle}>Choose Your Username</h1>
            <p style={S.cardDesc}>
              Choose your public DUAL&nbsp;//&nbsp;SIGNAL username. This will appear on your Passport and leaderboard.
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
                3–24 characters. Letters, numbers, underscores and hyphens only.
                Username cannot be changed after your Passport is minted.
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
            <p style={S.eyebrow}>
              STEP 03 <span style={S.eyebrowSlash}>//</span> COMMUNITY
            </p>
            <h1 style={S.cardTitle}>Connect Your Community</h1>
            <p style={S.cardDesc}>
              Connect the places where you participate in DUAL. All optional — you can add or change these later from your dashboard.
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
                    <span style={S.communityName}>DUAL Forum</span>
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
                    flex:     1,
                    marginTop: 0,
                    ...(submitting ? S.btnDisabled : {}),
                  }}
                  disabled={submitting}
                >
                  Mint Passport
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
              <p style={S.loadingText}>Minting your Passport…</p>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ────────────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div style={S.card}>
            <div style={S.successIcon}>✓</div>
            <h1 style={{ ...S.cardTitle, textAlign: 'center' }}>Passport Minted</h1>
            <p style={{ ...S.cardDesc, textAlign: 'center' }}>
              Your DUAL&nbsp;//&nbsp;SIGNAL Community Identity Passport has been created on the DUAL protocol.
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
              style={{ ...S.btnPrimary, display: 'block', textDecoration: 'none', marginTop: 0 }}
            >
              View Passport →
            </a>

            <a
              href="/me"
              style={{
                ...S.btnPrimary,
                display:     'block',
                textDecoration: 'none',
                background:  'transparent',
                border:      '1px solid rgba(94,211,234,0.15)',
                color:       '#5ED3EA',
                marginTop:   10,
              }}
            >
              Go to My Signal →
            </a>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={S.footer}>
        <div style={S.footerLine} />
        <div style={S.footerCenter}>
          <Link href="/leaderboard" style={{ ...S.footerText, textDecoration: 'none' }}>
            Leaderboard
          </Link>
          <span style={S.footerDot}>·</span>
          <span style={S.footerText}>DUAL Network · Chain 6301</span>
        </div>
        <div style={S.footerLine} />
      </footer>

    </div>
  );
}
