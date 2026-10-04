'use client';

/**
 * /join — DUAL // SIGNAL Passport onboarding (client flow).
 *
 * Step 0: Enter email + send magic link (if not already authenticated)
 * Step 1: Choose username
 * Step 2: Connect community identities (all optional)
 * Step 3: Creating Passport (loading)
 * Step 4: Passport created — show the minted Passport
 *
 * The starting step is resolved server-side in ./page.tsx.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { C } from '@/lib/theme';
import PassportEvolution from '@/components/PassportEvolution';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'email' | 'email_sent' | 'username' | 'community' | 'creating' | 'done';
type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface JoinResult {
  username:               string;
  dualObjectId:           string;
  badgeUrl:               string;
  memberSince:            string;
}

const COMMUNITY_FIELDS = [
  { key: 'x',        icon: '𝕏',   name: 'X',          desc: 'Track qualifying DUAL posts and public views.',      placeholder: '@username' },
  { key: 'telegram', icon: 'TG',  name: 'Telegram',   desc: 'Track active days in the DUAL community.',           placeholder: '@username' },
  { key: 'discord',  icon: 'DC',  name: 'Discord',    desc: 'Track active days in the DUAL Discord.',             placeholder: 'username', badge: 'Scoring coming soon' },
  { key: 'forum',    icon: 'GOV', name: 'DUAL Forum', desc: 'Track participation in DUAL governance proposals.',  placeholder: 'forum username' },
] as const;
type CommunityKey = typeof COMMUNITY_FIELDS[number]['key'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function JoinFlow({ initialStep }: { initialStep: 'email' | 'username' }) {
  const [step,       setStep]       = useState<Step>(initialStep);
  const [email,      setEmail]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [username,   setUsername]   = useState('');
  const [avail,      setAvail]      = useState<AvailabilityState>('idle');
  const [availMsg,   setAvailMsg]   = useState('');
  const [handles,    setHandles]    = useState<Record<CommunityKey, string>>({ x: '', telegram: '', discord: '', forum: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState<JoinResult | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          x:        handles.x.trim(),
          telegram: handles.telegram.trim(),
          discord:  handles.discord.trim(),
          forum:    handles.forum.trim(),
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

      setResult({
        username:               data.username,
        dualObjectId:           data.dualObjectId,
        badgeUrl:               data.badgeUrl,
        memberSince:            data.memberSince,
      });
      setStep('done');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStep('community');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const showDemo   = step === 'email' || step === 'email_sent' || step === 'username';
  const availColor = { idle: C.textFaint, checking: C.textFaint, available: C.success, taken: C.danger, invalid: C.warning }[avail];
  const availText  = avail === 'available' ? `✓ ${availMsg}` : avail === 'taken' ? `✕ ${availMsg}` : avail === 'invalid' ? `· ${availMsg}` : availMsg;

  return (
    <div className="join-page">
      <style>{`
        .join-page {
          min-height: 100vh; display: flex; flex-direction: column; align-items: center;
          position: relative; overflow: hidden;
          background: radial-gradient(ellipse 800px 520px at 50% 42%, rgba(14,180,208,0.08) 0%, transparent 70%), var(--ds-bg);
        }
        .join-wings {
          position: absolute; top: 50%; left: 50%; width: 980px; max-width: 160vw;
          transform: translate(-50%, -52%); opacity: 0.09; filter: saturate(0.2) brightness(0.9);
          pointer-events: none; user-select: none; z-index: 0;
        }
        .join-header { position: relative; z-index: 1; padding: 52px 24px 24px; text-align: center; }
        .join-header .ds-logo { font-size: 22px; }
        .join-tag { font-size: 10px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--ds-text-faint); margin: 10px 0 0; }
        .join-alpha { font-size: 9px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ds-cyan); opacity: 0.7; margin: 8px 0 0; }
        .join-main { position: relative; z-index: 1; flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; padding: 32px 16px 48px; }
        .join-single { width: 100%; display: flex; justify-content: center; }
        .join-split { width: 100%; max-width: 1120px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 480px); gap: 56px; align-items: center; }
        .join-demo-title { margin: 0 0 20px; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--ds-text-strong); }
        .join-card { width: 100%; max-width: 480px; padding: 40px; }
        .join-card-wide { max-width: 560px; }
        .join-title { margin: 0 0 10px; font-size: 26px; font-weight: 700; color: var(--ds-text-strong); letter-spacing: -0.01em; line-height: 1.2; }
        .join-error { color: var(--ds-danger); font-size: 13px; margin: 0 0 14px; text-align: center; }
        .join-community { display: flex; flex-direction: column; gap: 10px; }
        .join-community-card { padding: 14px 16px 12px; }
        .join-chip { font-size: 11px; font-weight: 700; color: var(--ds-cyan); background: var(--ds-cyan-wash); border-radius: 4px; padding: 2px 7px; min-width: 28px; text-align: center; }
        .join-passport { aspect-ratio: 3 / 2; width: 100%; margin-bottom: 24px; filter: drop-shadow(0 20px 30px rgba(94,211,234,0.16)); }
        .join-passport iframe { width: 100%; height: 100%; border: 0; display: block; }
        .join-actions { display: flex; flex-direction: column; gap: 10px; }
        .join-footer { position: relative; z-index: 1; padding: 16px 24px 32px; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ds-text-faint); }
        .join-footer a { color: inherit; text-decoration: none; }
        .join-footer a:hover { color: var(--ds-text); }
        @media (max-width: 960px) {
          .join-split { grid-template-columns: 1fr; gap: 40px; max-width: 560px; justify-items: center; }
          .join-demo { order: 2; width: 100%; }
        }
        @media (max-width: 520px) {
          .join-header { padding: 36px 16px 12px; }
          .join-main { align-items: flex-start; padding: 12px 16px 32px; }
          .join-card { padding: 28px 20px; }
        }
      `}</style>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/dual-signal/ui/Signal-butterfly.png" className="join-wings" alt="" aria-hidden="true" draggable={false} />

      <header className="join-header">
        <Link href="/" className="ds-logo">DUAL <span>//</span> SIGNAL</Link>
        <p className="join-tag">Community Identity Passport</p>
        <p className="join-alpha">Public Alpha — Signal calculations evolving</p>
      </header>

      <main className="join-main">
       <div className={showDemo ? 'join-split' : 'join-single'}>

        {showDemo && (
          <aside className="join-demo ds-anim-up">
            <p className="ds-eyebrow">Your Passport, levelled up</p>
            <h2 className="join-demo-title">It grows as you show up</h2>
            <PassportEvolution />
          </aside>
        )}

        {/* ── Step 0: Email ───────────────────────────────────────────────── */}
        {step === 'email' && (
          <div className="ds-card join-card ds-anim-up">
            <p className="ds-eyebrow">Step 01 // Account</p>
            <h1 className="join-title">Create your account</h1>
            <p className="ds-body" style={{ marginBottom: 28 }}>
              Enter your email to receive a secure login link. No password required.
            </p>

            {error && <p className="join-error">{error}</p>}

            <form onSubmit={handleSendLink}>
              <label className="ds-label" htmlFor="join-email">Email address</label>
              <input
                id="join-email"
                className="ds-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
              <p className="ds-small" style={{ margin: '12px 0 24px' }}>
                Your email is private and never shown publicly.
              </p>
              <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={sending}>
                {sending ? 'Sending…' : 'Send login link →'}
              </button>
            </form>

            <p className="ds-small" style={{ textAlign: 'center', marginTop: 20 }}>
              <Link href="/login" style={{ color: C.textDim }}>Already have an account? Sign in</Link>
            </p>
          </div>
        )}

        {/* ── Step 0b: Email sent ─────────────────────────────────────────── */}
        {step === 'email_sent' && (
          <div className="ds-card join-card ds-anim-up" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 14, color: C.cyan }} aria-hidden>✉</div>
            <h1 className="join-title">Check your email</h1>
            <p className="ds-body" style={{ marginBottom: 20 }}>
              We sent a secure login link to <strong style={{ color: C.textStrong }}>{email.trim()}</strong>.
              <br /><br />
              Click the link to continue. It expires in 15 minutes.
            </p>
            <button
              type="button"
              className="ds-btn ds-btn-ghost ds-btn-sm"
              onClick={() => { setStep('email'); setError(''); }}
            >
              Use a different email
            </button>
          </div>
        )}

        {/* ── Step 1: Username ────────────────────────────────────────────── */}
        {step === 'username' && (
          <div className="ds-card join-card ds-anim-up">
            <p className="ds-eyebrow">Step 02 // Identity</p>
            <h1 className="join-title">Choose your username</h1>
            <p className="ds-body" style={{ marginBottom: 28 }}>
              This appears on your Passport and the leaderboard.
            </p>

            <form onSubmit={handleContinue}>
              <label className="ds-label" htmlFor="join-username">Username</label>
              <input
                id="join-username"
                className="ds-input"
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                autoFocus
                maxLength={24}
                aria-describedby="join-username-status"
              />
              <div id="join-username-status" aria-live="polite" style={{ fontSize: 12, marginTop: 6, minHeight: 18, color: availColor }}>
                {availText}
              </div>

              <p className="ds-small" style={{ margin: '10px 0 8px' }}>
                3–24 characters: letters, numbers, underscores and hyphens.
                It can’t be changed after your Passport is minted.
              </p>

              {error && <p className="join-error">{error}</p>}

              <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" style={{ marginTop: 16 }} disabled={avail !== 'available'}>
                Continue →
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: Community ───────────────────────────────────────────── */}
        {step === 'community' && (
          <div className="ds-card join-card ds-anim-up">
            <p className="ds-eyebrow">Step 03 // Community</p>
            <h1 className="join-title">Connect your community</h1>
            <p className="ds-body" style={{ marginBottom: 24 }}>
              Where do you take part in DUAL? All optional — you can add or change these later.
            </p>

            {error && <p className="join-error">{error}</p>}

            <form onSubmit={handleCreate}>
              <div className="join-community">
                {COMMUNITY_FIELDS.map(f => (
                  <div key={f.key} className="ds-inset join-community-card">
                    <label htmlFor={`join-${f.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="join-chip">{f.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.name}</span>
                      {'badge' in f && (
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.cyan, opacity: 0.75, marginLeft: 4 }}>{f.badge}</span>
                      )}
                    </label>
                    <p className="ds-small" style={{ marginBottom: 8 }}>{f.desc}</p>
                    <input
                      id={`join-${f.key}`}
                      className="ds-input ds-input-sm"
                      type="text"
                      placeholder={f.placeholder}
                      value={handles[f.key]}
                      onChange={e => setHandles(h => ({ ...h, [f.key]: e.target.value }))}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => { setStep('username'); setError(''); }}>
                  ← Back
                </button>
                <button type="submit" className="ds-btn ds-btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  Mint Passport
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Creating ────────────────────────────────────────────── */}
        {step === 'creating' && (
          <div className="ds-card join-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '56px 40px' }}>
            <div className="ds-spinner" />
            <p className="ds-body" style={{ letterSpacing: '0.08em' }}>Minting your Passport on DUAL…</p>
          </div>
        )}

        {/* ── Step 4: Done ────────────────────────────────────────────────── */}
        {step === 'done' && result && <DoneStep result={result} />}

       </div>
      </main>

      <footer className="join-footer">
        <Link href="/leaderboard">Leaderboard</Link> · DUAL Network
      </footer>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function DoneStep({ result }: { result: JoinResult }) {
  return (
    <div className="ds-card join-card join-card-wide ds-anim-up">
      <p className="ds-eyebrow" style={{ textAlign: 'center' }}>Passport minted</p>
      <h1 className="join-title" style={{ textAlign: 'center', marginBottom: 6 }}>Welcome, {result.username}</h1>
      <p className="ds-body" style={{ textAlign: 'center', marginBottom: 24 }}>
        Your Passport is live on the DUAL Network. It levels up as your SIGNAL grows.
      </p>

      <div className="join-passport">
        <iframe src={`/faces/badge?embed=1&id=${encodeURIComponent(result.dualObjectId)}`} title="Your Passport" />
      </div>

      <div className="join-actions">
        <a href="/me" className="ds-btn ds-btn-primary ds-btn-block">Go to my dashboard →</a>
        <a href={result.badgeUrl} className="ds-btn ds-btn-ghost ds-btn-block">View public Passport page</a>
      </div>
    </div>
  );
}
