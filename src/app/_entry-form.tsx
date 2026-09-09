'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const C = {
  bg:       '#040E1A',
  bgCard:   '#071525',
  border:   'rgba(94,211,234,0.09)',
  cyan:     '#5ED3EA',
  text:     '#C8D8E8',
  textDim:  '#3A5A6A',
  red:      '#F87171',
};

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:     '100vh',
    background:    C.bg,
    color:         C.text,
    fontFamily:    "'Inter','SF Pro Display',system-ui,sans-serif",
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
  },
  header: {
    width:      '100%',
    padding:    '52px 24px 24px',
    textAlign:  'center',
  },
  logo: {
    fontSize:      22,
    fontWeight:    700,
    letterSpacing: '0.22em',
    color:         '#E8F4FC',
    textTransform: 'uppercase' as const,
  },
  logoSlash: { color: C.cyan },
  tagline: {
    fontSize:      10,
    letterSpacing: '0.26em',
    color:         '#1E3040',
    margin:        '9px 0 0',
    textTransform: 'uppercase' as const,
  },
  main: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
    padding:        '48px 16px',
    boxSizing:      'border-box' as const,
  },
  card: {
    background:   C.bgCard,
    border:       `1px solid ${C.border}`,
    borderRadius: 16,
    padding:      '40px',
    width:        '100%',
    maxWidth:     420,
    boxSizing:    'border-box' as const,
  },
  eyebrow: {
    fontSize:      9,
    letterSpacing: '0.24em',
    color:         '#2A5060',
    textTransform: 'uppercase' as const,
    marginBottom:  14,
    display:       'block',
  },
  title: {
    margin:        '0 0 10px',
    fontSize:      24,
    fontWeight:    700,
    color:         '#E8F4FC',
    letterSpacing: '-0.01em',
    lineHeight:    1.2,
  },
  desc: {
    margin:     '0 0 28px',
    fontSize:   14,
    lineHeight: 1.7,
    color:      C.textDim,
  },
  descHighlight: {
    color:      '#5A8A9A',
    fontWeight: 500,
  },
  label: {
    fontSize:      10,
    fontWeight:    600,
    letterSpacing: '0.18em',
    color:         C.textDim,
    textTransform: 'uppercase' as const,
    marginBottom:  10,
    display:       'block',
  },
  input: {
    width:        '100%',
    background:   C.bg,
    border:       '1px solid rgba(94,211,234,0.14)',
    borderRadius:  8,
    padding:      '13px 16px',
    fontSize:     15,
    color:        C.text,
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box' as const,
    marginBottom:  8,
  },
  inputFocus: {
    border: '1px solid rgba(94,211,234,0.38)',
  },
  btn: {
    width:         '100%',
    marginTop:     16,
    padding:       '15px 0',
    background:    '#0EB4D0',
    border:        'none',
    borderRadius:  10,
    color:         '#FFF',
    fontSize:      12,
    fontWeight:    700,
    cursor:        'pointer',
    textAlign:     'center' as const,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    fontFamily:    'inherit',
    transition:    'opacity 0.15s',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  error: {
    color:     C.red,
    fontSize:  13,
    margin:    '0 0 12px',
    textAlign: 'center' as const,
  },
  divider: {
    borderTop:  `1px solid ${C.border}`,
    margin:     '24px 0 0',
    paddingTop: 16,
    fontSize:   12,
    color:      '#1E3040',
    textAlign:  'center' as const,
    lineHeight: 1.6,
  },
  sentWrap: {
    textAlign: 'center' as const,
    padding:   '8px 0 0',
  },
  sentIcon: {
    fontSize: 36,
    margin:   '0 0 16px',
    display:  'block',
  },
  sentTitle: {
    margin:     '0 0 12px',
    fontSize:   20,
    fontWeight: 700,
    color:      '#E8F4FC',
  },
  sentDesc: {
    fontSize:   14,
    color:      C.textDim,
    lineHeight: 1.7,
  },
  backBtn: {
    background:     'transparent',
    border:         'none',
    color:          '#2A4050',
    fontSize:       12,
    cursor:         'pointer',
    marginTop:      20,
    fontFamily:     'inherit',
    textDecoration: 'underline',
    display:        'block',
    width:          '100%',
    textAlign:      'center' as const,
  },
  footer: {
    padding:       '20px 40px 32px',
    fontSize:      11,
    color:         '#1A2A38',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
};

export function EntryForm() {
  const searchParams = useSearchParams();
  const errorParam   = searchParams.get('error');

  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (errorParam === 'invalid' || errorParam === 'expired') {
      setError('That login link has expired or is invalid. Please request a new one.');
    }
  }, [errorParam]);

  async function handleSubmit(e: React.FormEvent) {
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
      if (!res.ok) { setError(data.error ?? 'Something went wrong. Please try again.'); return; }
      setSent(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}>DUAL <span style={S.logoSlash}>//</span> SIGNAL</div>
        <p style={S.tagline}>Community Identity Passport</p>
      </header>

      <main style={S.main}>
        <div style={S.card}>
          {sent ? (
            <div style={S.sentWrap}>
              <span style={S.sentIcon}>✉</span>
              <p style={S.sentTitle}>Check Your Email</p>
              <p style={S.sentDesc}>
                We&apos;ve sent a secure link to{' '}
                <strong style={{ color: '#A8C8D8' }}>{email.trim()}</strong>.
                <br /><br />
                Click the link in your email to continue. It expires in 15 minutes.
              </p>
              <button style={S.backBtn} onClick={() => { setSent(false); setEmail(''); }}>
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <span style={S.eyebrow}>DUAL // SIGNAL</span>
              <h1 style={S.title}>Join or Sign In</h1>
              <p style={S.desc}>
                Enter your email and we&apos;ll send you a secure link.
                <br />
                <span style={S.descHighlight}>
                  New here? Your Passport will be created automatically.
                </span>
              </p>

              {error && <p style={S.error}>{error}</p>}

              <form onSubmit={handleSubmit}>
                <label style={S.label} htmlFor="email">Email Address</label>
                <input
                  id="email"
                  style={{ ...S.input, ...(focused ? S.inputFocus : {}) }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  autoComplete="email"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  style={{ ...S.btn, ...(sending ? S.btnDisabled : {}) }}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Continue →'}
                </button>
              </form>

              <p style={S.divider}>
                Already have a Passport? Use the same email — you&apos;ll go straight to your dashboard.
              </p>
            </>
          )}
        </div>
      </main>

      <footer style={S.footer}>DUAL Network · Chain 6301</footer>
    </div>
  );
}
