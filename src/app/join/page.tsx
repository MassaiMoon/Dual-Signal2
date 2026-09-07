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
    position:      'relative',
    overflow:      'hidden',
  },
  bgGlow: {
    position:      'absolute',
    top:           '-8%',
    left:          '50%',
    transform:     'translateX(-50%)',
    width:         '900px',
    height:        '700px',
    background:    'radial-gradient(ellipse at center, rgba(14,180,208,0.05) 0%, transparent 68%)',
    pointerEvents: 'none',
    zIndex:        0,
  },
  butterfly: {
    position:      'absolute',
    top:           '-50px',
    left:          '50%',
    transform:     'translateX(-50%)',
    width:         '1080px',
    maxWidth:      '96vw',
    height:        'auto',
    pointerEvents: 'none',
    zIndex:        0,
    opacity:       0.78,
  },
  cornerText: {
    position:      'absolute',
    zIndex:        1,
    pointerEvents: 'none',
    fontSize:      9,
    letterSpacing: '0.16em',
    color:         '#192A38',
    textTransform: 'uppercase' as const,
    lineHeight:    2.0,
  },
  cornerLineEl: {
    display:    'block',
    height:     1,
    width:      22,
    background: '#192A38',
    marginTop:  7,
  },
  header: {
    width:     '100%',
    padding:   '52px 24px 0',
    textAlign: 'center',
    position:  'relative',
    zIndex:    1,
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
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '48px 16px',
    width:          '100%',
    position:       'relative',
    zIndex:         1,
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
  // Community cards
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
  // Done screen
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
  linksRow: {
    display:        'flex',
    alignItems:     'center',
    gap:             8,
    marginTop:       10,
    justifyContent: 'center',
  },
  linkMuted: {
    color:          '#2A3A4A',
    fontSize:       12,
    textDecoration: 'none',
  },
  dot: { color: '#182830', fontSize: 12 },
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
  // Loading
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
  const [step,          setStep]          = useState<Step>('username');
  const [username,      setUsername]      = useState('');
  const [avail,         setAvail]         = useState<AvailabilityState>('idle');
  const [availMsg,      setAvailMsg]      = useState('');
  const [x,             setX]             = useState('');
  const [telegram,      setTelegram]      = useState('');
  const [discord,       setDiscord]       = useState('');
  const [forum,         setForum]         = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [result,        setResult]        = useState<{ username: string; badgeUrl: string; memberSince: string } | null>(null);
  const [inputFocus,    setInputFocus]    = useState(false);

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

      {/* Keyframes + desktop-only corner text */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ds-corner { display: none; }
        @media (min-width: 900px) { .ds-corner { display: block; } }
      `}</style>

      {/* Radial background glow */}
      <div style={S.bgGlow} />

      {/* Butterfly — realistic morpho, brand teal palette */}
      <div style={S.butterfly} aria-hidden="true">
        <svg viewBox="0 0 1000 630" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Thin glow for outlines and veins */}
            <filter id="glo" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Fine glow for veins only */}
            <filter id="vn" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Left upper wing: bright teal core → transparent edge */}
            <radialGradient id="wgL" cx="58%" cy="55%" r="65%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.38"/>
              <stop offset="30%"  stopColor="#159DB8" stopOpacity="0.34"/>
              <stop offset="62%"  stopColor="#1189A2" stopOpacity="0.24"/>
              <stop offset="88%"  stopColor="#1189A2" stopOpacity="0.10"/>
              <stop offset="100%" stopColor="#002433" stopOpacity="0.04"/>
            </radialGradient>
            {/* Right upper wing */}
            <radialGradient id="wgR" cx="42%" cy="55%" r="65%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.38"/>
              <stop offset="30%"  stopColor="#159DB8" stopOpacity="0.34"/>
              <stop offset="62%"  stopColor="#1189A2" stopOpacity="0.24"/>
              <stop offset="88%"  stopColor="#1189A2" stopOpacity="0.10"/>
              <stop offset="100%" stopColor="#002433" stopOpacity="0.04"/>
            </radialGradient>
            {/* Lower wings */}
            <radialGradient id="hwL" cx="60%" cy="35%" r="72%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.32"/>
              <stop offset="45%"  stopColor="#159DB8" stopOpacity="0.22"/>
              <stop offset="85%"  stopColor="#1189A2" stopOpacity="0.10"/>
              <stop offset="100%" stopColor="#002433" stopOpacity="0.02"/>
            </radialGradient>
            <radialGradient id="hwR" cx="40%" cy="35%" r="72%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.32"/>
              <stop offset="45%"  stopColor="#159DB8" stopOpacity="0.22"/>
              <stop offset="85%"  stopColor="#1189A2" stopOpacity="0.10"/>
              <stop offset="100%" stopColor="#002433" stopOpacity="0.02"/>
            </radialGradient>
            {/* Iridescent diagonal sweep — left */}
            <linearGradient id="irL" x1="92%" y1="4%" x2="8%" y2="82%">
              <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.38"/>
              <stop offset="32%"  stopColor="#5ED3EA" stopOpacity="0.16"/>
              <stop offset="100%" stopColor="#159DB8" stopOpacity="0"/>
            </linearGradient>
            {/* Iridescent diagonal sweep — right */}
            <linearGradient id="irR" x1="8%" y1="4%" x2="92%" y2="82%">
              <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.38"/>
              <stop offset="32%"  stopColor="#5ED3EA" stopOpacity="0.16"/>
              <stop offset="100%" stopColor="#159DB8" stopOpacity="0"/>
            </linearGradient>
            {/* Body highlight */}
            <linearGradient id="bdG" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#1189A2" stopOpacity="0.22"/>
              <stop offset="50%"  stopColor="#5ED3EA" stopOpacity="0.72"/>
              <stop offset="100%" stopColor="#1189A2" stopOpacity="0.22"/>
            </linearGradient>
          </defs>

          {/* ── LOWER WINGS (behind upper) ── */}
          {/* Left hindwing — rounded fan below body */}
          <path d="M500,395 C474,418 444,452 400,482 C350,514 290,534 248,554 C210,572 205,596 240,608 C285,618 362,590 422,558 C470,530 500,498 500,466Z"
                fill="url(#hwL)"/>
          <path d="M500,395 C474,418 444,452 400,482 C350,514 290,534 248,554 C210,572 205,596 240,608 C285,618 362,590 422,558 C470,530 500,498 500,466Z"
                fill="none" stroke="#5ED3EA" strokeWidth="1.1" strokeOpacity="0.55" filter="url(#glo)"/>
          {/* Right hindwing */}
          <path d="M500,395 C526,418 556,452 600,482 C650,514 710,534 752,554 C790,572 795,596 760,608 C715,618 638,590 578,558 C530,530 500,498 500,466Z"
                fill="url(#hwR)"/>
          <path d="M500,395 C526,418 556,452 600,482 C650,514 710,534 752,554 C790,572 795,596 760,608 C715,618 638,590 578,558 C530,530 500,498 500,466Z"
                fill="none" stroke="#5ED3EA" strokeWidth="1.1" strokeOpacity="0.55" filter="url(#glo)"/>

          {/* ── UPPER FOREWINGS — swept morpho triangle, apex = upper-outer corner ── */}
          {/* Left forewing */}
          <path d="M500,350 C470,310 430,246 374,188 C330,144 270,108 196,88 C148,78 106,84 88,102 C65,122 68,158 86,200 C100,240 112,282 118,330 C124,368 140,402 172,418 C260,432 398,418 470,406 C486,402 496,398 500,392Z"
                fill="url(#wgL)"/>
          <path d="M500,350 C470,310 430,246 374,188 C330,144 270,108 196,88 C148,78 106,84 88,102 C65,122 68,158 86,200 C100,240 112,282 118,330 C124,368 140,402 172,418 C260,432 398,418 470,406 C486,402 496,398 500,392Z"
                fill="url(#irL)"/>
          <path d="M500,350 C470,310 430,246 374,188 C330,144 270,108 196,88 C148,78 106,84 88,102 C65,122 68,158 86,200 C100,240 112,282 118,330 C124,368 140,402 172,418 C260,432 398,418 470,406 C486,402 496,398 500,392Z"
                fill="none" stroke="#5ED3EA" strokeWidth="1.4" strokeOpacity="0.65" filter="url(#glo)"/>

          {/* Right forewing */}
          <path d="M500,350 C530,310 570,246 626,188 C670,144 730,108 804,88 C852,78 894,84 912,102 C935,122 932,158 914,200 C900,240 888,282 882,330 C876,368 860,402 828,418 C740,432 602,418 530,406 C514,402 504,398 500,392Z"
                fill="url(#wgR)"/>
          <path d="M500,350 C530,310 570,246 626,188 C670,144 730,108 804,88 C852,78 894,84 912,102 C935,122 932,158 914,200 C900,240 888,282 882,330 C876,368 860,402 828,418 C740,432 602,418 530,406 C514,402 504,398 500,392Z"
                fill="url(#irR)"/>
          <path d="M500,350 C530,310 570,246 626,188 C670,144 730,108 804,88 C852,78 894,84 912,102 C935,122 932,158 914,200 C900,240 888,282 882,330 C876,368 860,402 828,418 C740,432 602,418 530,406 C514,402 504,398 500,392Z"
                fill="none" stroke="#5ED3EA" strokeWidth="1.4" strokeOpacity="0.65" filter="url(#glo)"/>

          {/* ── VENATION — left forewing (radiating from discal cell to outer margin) ── */}
          <g fill="none" stroke="#5ED3EA" filter="url(#vn)">
            {/* Sc+R1 — toward apex along costa */}
            <path d="M497,364 C462,320 408,240 318,164 C264,120 196,94 154,90" strokeWidth="1.0" strokeOpacity="0.64"/>
            {/* R3 — upper outer margin */}
            <path d="M497,370 C454,322 386,248 300,198 C240,162 182,148 140,152" strokeWidth="0.9" strokeOpacity="0.55"/>
            {/* R5/M1 — mid outer margin */}
            <path d="M497,376 C448,340 368,286 270,258 C210,240 158,244 120,256" strokeWidth="0.85" strokeOpacity="0.47"/>
            {/* M3 — lower outer margin */}
            <path d="M497,382 C444,356 348,320 232,316 C176,316 128,330 102,350" strokeWidth="0.8" strokeOpacity="0.40"/>
            {/* CuA1 — toward inner angle */}
            <path d="M497,388 C440,372 330,356 196,378 C162,384 140,396 132,410" strokeWidth="0.75" strokeOpacity="0.33"/>
            {/* CuA2 — along inner margin */}
            <path d="M497,393 C436,390 310,392 194,416" strokeWidth="0.7" strokeOpacity="0.26"/>
            {/* Discal cross-vein upper */}
            <path d="M380,186 C368,208 360,236 362,268" strokeWidth="0.5" strokeOpacity="0.38"/>
            {/* Discal cross-vein lower */}
            <path d="M300,246 C288,268 280,296 284,326" strokeWidth="0.45" strokeOpacity="0.32"/>
            {/* Inner discal vein */}
            <path d="M216,302 C208,322 204,350 210,374" strokeWidth="0.4" strokeOpacity="0.26"/>
          </g>

          {/* ── VENATION — right forewing ── */}
          <g fill="none" stroke="#5ED3EA" filter="url(#vn)">
            <path d="M503,364 C538,320 592,240 682,164 C736,120 804,94 846,90" strokeWidth="1.0" strokeOpacity="0.64"/>
            <path d="M503,370 C546,322 614,248 700,198 C760,162 818,148 860,152" strokeWidth="0.9" strokeOpacity="0.55"/>
            <path d="M503,376 C552,340 632,286 730,258 C790,240 842,244 880,256" strokeWidth="0.85" strokeOpacity="0.47"/>
            <path d="M503,382 C556,356 652,320 768,316 C824,316 872,330 898,350" strokeWidth="0.8" strokeOpacity="0.40"/>
            <path d="M503,388 C560,372 670,356 804,378 C838,384 860,396 868,410" strokeWidth="0.75" strokeOpacity="0.33"/>
            <path d="M503,393 C564,390 690,392 806,416" strokeWidth="0.7" strokeOpacity="0.26"/>
            <path d="M620,186 C632,208 640,236 638,268" strokeWidth="0.5" strokeOpacity="0.38"/>
            <path d="M700,246 C712,268 720,296 716,326" strokeWidth="0.45" strokeOpacity="0.32"/>
            <path d="M784,302 C792,322 796,350 790,374" strokeWidth="0.4" strokeOpacity="0.26"/>
          </g>

          {/* ── VENATION — hindwings ── */}
          <g fill="none" stroke="#5ED3EA" filter="url(#vn)">
            <path d="M498,400 C470,428 430,462 372,490 C320,514 270,526 238,546" strokeWidth="0.75" strokeOpacity="0.50"/>
            <path d="M498,406 C454,446 390,484 312,510 C258,530 216,542 205,562" strokeWidth="0.65" strokeOpacity="0.38"/>
            <path d="M502,400 C530,428 570,462 628,490 C680,514 730,526 762,546" strokeWidth="0.75" strokeOpacity="0.50"/>
            <path d="M502,406 C546,446 610,484 688,510 C742,530 784,542 795,562" strokeWidth="0.65" strokeOpacity="0.38"/>
          </g>

          {/* ── BODY ── */}
          <circle cx="500" cy="344" r="9"  fill="url(#bdG)" filter="url(#glo)"/>
          <circle cx="500" cy="344" r="5"  fill="#5ED3EA" fillOpacity="0.60"/>
          <ellipse cx="500" cy="371" rx="10" ry="23" fill="url(#bdG)" filter="url(#glo)"/>
          <ellipse cx="500" cy="371" rx="10" ry="23" fill="none" stroke="#5ED3EA" strokeWidth="0.9" strokeOpacity="0.58"/>
          <path d="M491,392 C488,418 488,450 490,478 C491,496 509,496 510,478 C512,450 512,418 509,392Z"
                fill="url(#bdG)" filter="url(#glo)"/>
          <path d="M491,392 C488,418 488,450 490,478 C491,496 509,496 510,478 C512,450 512,418 509,392Z"
                fill="none" stroke="#5ED3EA" strokeWidth="0.7" strokeOpacity="0.48"/>
          {([408,420,432,444,456,469] as number[]).map((y, i) => (
            <line key={y} x1={491} y1={y} x2={509} y2={y}
                  stroke="#5ED3EA" strokeWidth="0.55" strokeOpacity={0.38 - i * 0.05}/>
          ))}

          {/* ── ANTENNAE ── */}
          <path d="M496,338 C488,304 468,260 446,216" fill="none" stroke="#5ED3EA" strokeWidth="1.2" strokeOpacity="0.62" filter="url(#vn)"/>
          <path d="M504,338 C512,304 532,260 554,216" fill="none" stroke="#5ED3EA" strokeWidth="1.2" strokeOpacity="0.62" filter="url(#vn)"/>
          <ellipse cx="443" cy="210" rx="5.5" ry="10" fill="#5ED3EA" fillOpacity="0.68" transform="rotate(-28 443 210)" filter="url(#vn)"/>
          <ellipse cx="557" cy="210" rx="5.5" ry="10" fill="#5ED3EA" fillOpacity="0.68" transform="rotate(28 557 210)" filter="url(#vn)"/>
        </svg>
      </div>

      {/* Corner decorative text — desktop only via CSS class */}
      <div className="ds-corner" style={{ ...S.cornerText, top: 44, left: 44 }}>
        IDENTITY<br />BELONGS<br />FURTHER
        <span style={S.cornerLineEl} />
      </div>
      <div className="ds-corner" style={{ ...S.cornerText, top: 44, right: 44, textAlign: 'right' }}>
        DUAL<br />NETWORK
        <span style={{ ...S.cornerLineEl, marginLeft: 'auto' }} />
      </div>
      <div className="ds-corner" style={{ ...S.cornerText, bottom: 60, left: 44 }}>
        PEOPLE<br />IDEAS<br />IMPACT
        <span style={S.cornerLineEl} />
      </div>
      <div className="ds-corner" style={{ ...S.cornerText, bottom: 60, right: 44, textAlign: 'right' }}>
        MORE<br />TOGETHER
        <span style={{ ...S.cornerLineEl, marginLeft: 'auto' }} />
      </div>

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo}>DUAL <span style={S.logoSlash}>//</span> SIGNAL</div>
        <p style={S.tagline}>Community Identity Passport</p>
      </header>

      <main style={S.main}>

        {/* ── Step 1: Username ────────────────────────────────────────────── */}
        {step === 'username' && (
          <div style={S.card}>
            <p style={S.eyebrow}>
              STEP 01 <span style={S.eyebrowSlash}>//</span> IDENTITY
            </p>
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
                Initialize Signal →
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Community ───────────────────────────────────────────── */}
        {step === 'community' && (
          <div style={S.card}>
            <p style={S.eyebrow}>
              STEP 02 <span style={S.eyebrowSlash}>//</span> COMMUNITY
            </p>
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
                    flex:     1,
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
                  color:          '#2A3A4A',
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

      {/* Footer with separator lines */}
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
