import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DUAL // SIGNAL — Community Identity Passport',
  description: 'Earn SIGNAL through your community activity. Level up through six tiers. Mint your Passport on the DUAL Network.',
  openGraph: {
    title: 'DUAL // SIGNAL — Community Identity Passport',
    description: 'Earn SIGNAL through your community activity. Level up through six tiers. Mint your Passport on the DUAL Network.',
  },
};

const C = {
  bg:      '#040E1A',
  bgCard:  '#071525',
  border:  'rgba(94,211,234,0.09)',
  cyan:    '#5ED3EA',
  cyanDim: '#0EB4D0',
  text:    '#C8D8E8',
  textDim: '#6A8A9A',
};

export default async function Home() {
  const jar = await cookies();
  if (jar.has('ds_session')) redirect('/me');

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; overflow-x: hidden; }

        @keyframes ds-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ds-h1   { animation: ds-up 0.75s ease both; }
        .ds-sub  { animation: ds-up 0.75s 0.15s ease both; }
        .ds-ctas { animation: ds-up 0.75s 0.3s  ease both; }
        .ds-stats{ animation: ds-up 0.75s 0.45s ease both; }

        .ds-nav-link { transition: color 0.15s; }
        .ds-nav-link:hover { color: #A8C8D8 !important; }
        .ds-btn-ghost:hover { border-color: rgba(94,211,234,0.22) !important; color: #7AAABB !important; }
        .ds-btn-primary:hover { opacity: 0.88; }
        .ds-step-card:hover { border-color: rgba(94,211,234,0.16) !important; }
        .ds-ch-card:hover { border-color: rgba(94,211,234,0.16) !important; }
        .ds-tier:hover { border-color: rgba(94,211,234,0.16) !important; background: rgba(94,211,234,0.05) !important; }

        @media (max-width: 768px) {
          .ds-nav        { padding: 0 20px !important; }
          .ds-nav-extra  { display: none !important; }
          .ds-hero       { padding: 88px 20px 60px !important; }
          .ds-h1         { font-size: 48px !important; }
          .ds-sub        { font-size: 15px !important; }
          .ds-ctas       { flex-direction: column !important; width: 100% !important; }
          .ds-ctas a     { width: 100% !important; justify-content: center !important; }
          .ds-stats      { gap: 24px !important; }
          .ds-section    { padding: 0 20px !important; }
          .ds-step-grid  { grid-template-columns: 1fr !important; }
          .ds-ch-grid    { grid-template-columns: 1fr !important; }
          .ds-tiers      { flex-wrap: wrap !important; }
          .ds-tiers > *  { flex: 0 0 calc(33.33% - 4px) !important; min-width: 0 !important; }
          .ds-cta-box    { padding: 48px 24px !important; }
          .ds-footer     { padding: 20px !important; flex-direction: column !important; gap: 6px !important; }
          .ds-sec        { padding: 64px 0 !important; }
        }
        @media (max-width: 480px) {
          .ds-nav        { padding: 0 16px !important; }
          .ds-hero       { padding: 80px 16px 48px !important; }
          .ds-h1         { font-size: 38px !important; }
          .ds-stats      { gap: 16px !important; flex-wrap: wrap !important; justify-content: center !important; }
          .ds-section    { padding: 0 16px !important; }
          .ds-tiers > *  { flex: 0 0 calc(50% - 3px) !important; }
          .ds-cta-box    { padding: 40px 16px !important; }
          .ds-footer     { padding: 16px !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav className="ds-nav" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: 'rgba(4,14,26,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${C.border}`,
          height: 64,
          padding: '0 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.22em', color: '#E8F4FC', textTransform: 'uppercase', textDecoration: 'none' }}>
            DUAL <span style={{ color: C.cyan }}>//</span> SIGNAL
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <span className="ds-nav-extra" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(94,211,234,0.4)', border: '1px solid rgba(94,211,234,0.14)', borderRadius: 4, padding: '3px 8px' }}>ALPHA</span>
            <Link href="/leaderboard" className="ds-nav-link ds-nav-extra" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3A5A6A', textDecoration: 'none' }}>Leaderboard</Link>
            <Link href="/login" className="ds-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', background: C.cyanDim, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 18px', borderRadius: 8, textDecoration: 'none', transition: 'opacity 0.15s' }}>
              Get Passport →
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="ds-hero" style={{
          minHeight: '100vh',
          padding: '100px 48px 80px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          background: `radial-gradient(ellipse 900px 600px at 50% 40%, rgba(14,180,208,0.06) 0%, transparent 70%), ${C.bg}`,
        }}>
          {/* Butterfly */}
          <Image
            src="/assets/dual-signal/ui/Signal-butterfly.png"
            alt="" aria-hidden width={560} height={560} priority
            style={{ position: 'absolute', right: -80, bottom: -60, opacity: 0.06, filter: 'saturate(0.1) brightness(0.65)', pointerEvents: 'none', userSelect: 'none' }}
          />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Eyebrow */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.cyan, marginBottom: 28 }}>
              <span style={{ display: 'block', width: 28, height: 1, background: 'rgba(94,211,234,0.35)' }} />
              Community Identity Passport
              <span style={{ display: 'block', width: 28, height: 1, background: 'rgba(94,211,234,0.35)' }} />
            </div>

            <h1 className="ds-h1" style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.03em', color: '#F0F8FC', maxWidth: 700, marginBottom: 22, width: '100%' }}>
              Build Your<br />
              <span style={{ color: C.cyan }}>On-Chain Identity</span>
            </h1>

            <p className="ds-sub" style={{ fontSize: 17, color: '#4A6A7A', lineHeight: 1.75, maxWidth: 460, marginBottom: 44 }}>
              Earn SIGNAL through community activity. Level up through six tiers. Mint your Passport on the DUAL Network.
            </p>

            <div className="ds-ctas" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 64 }}>
              <Link href="/login" className="ds-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.cyanDim, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '16px 30px', borderRadius: 10, textDecoration: 'none', transition: 'opacity 0.15s' }}>
                Get Your Passport →
              </Link>
              <Link href="/leaderboard" className="ds-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#4A6A7A', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '15px 24px', borderRadius: 10, border: '1px solid rgba(94,211,234,0.1)', textDecoration: 'none', transition: 'all 0.15s' }}>
                View Leaderboard
              </Link>
            </div>

            {/* Stats */}
            <div className="ds-stats" style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
              {[
                { value: '1,000', label: 'Max Signal' },
                { value: '6',     label: 'Tiers' },
                { value: '4',     label: 'Channels' },
                { value: '6301',  label: 'Chain' },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 800, color: '#D0E8F4', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                    <span style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#5A7A8A', marginTop: 5 }}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 1, height: 32, background: 'rgba(94,211,234,0.08)' }} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />

        {/* ── How It Works ── */}
        <section className="ds-sec" style={{ padding: '96px 0' }}>
          <div className="ds-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.cyan, marginBottom: 14 }}>How It Works</div>
              <h2 style={{ fontSize: 40, fontWeight: 800, color: '#E8F4FC', letterSpacing: '-0.02em', lineHeight: 1.12 }}>Three steps to your Passport</h2>
              <p style={{ fontSize: 15, color: '#6A8A9A', marginTop: 12, lineHeight: 1.7 }}>Your identity is built from real community activity — not self-reported claims.</p>
            </div>

            <div className="ds-step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              {[
                {
                  n: '01', title: 'Join with Email',
                  body: 'Enter your email and receive a secure magic link. No password. No wallet required to start.',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#5ED3EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="16" height="12" rx="2"/><polyline points="2,6 10,12 18,6"/>
                    </svg>
                  ),
                },
                {
                  n: '02', title: 'Connect Your Accounts',
                  body: 'Link your X, Telegram, Discord, and governance forum handles. Your activity is tracked automatically.',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#5ED3EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5" cy="10" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="15" r="2"/>
                      <line x1="7" y1="9" x2="13" y2="6"/><line x1="7" y1="11" x2="13" y2="14"/>
                    </svg>
                  ),
                },
                {
                  n: '03', title: 'Earn SIGNAL',
                  body: 'Your passport score updates as you participate. Reach Level 5 in all four channels to hit 1,000 SIGNAL.',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#5ED3EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="10,16 10,4"/><polyline points="5,9 10,4 15,9"/>
                      <line x1="4" y1="16" x2="16" y2="16" strokeOpacity="0.35"/>
                    </svg>
                  ),
                },
              ].map(s => (
                <div key={s.n} className="ds-step-card" style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 28px', transition: 'border-color 0.15s' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(94,211,234,0.25)', marginBottom: 20 }}>{s.n} —</div>
                  <div style={{ width: 44, height: 44, background: 'rgba(94,211,234,0.06)', border: `1px solid rgba(94,211,234,0.12)`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>{s.icon}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E8F4FC', letterSpacing: '-0.01em', marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: '#4A6A7A', lineHeight: 1.75 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />

        {/* ── Four Channels ── */}
        <section className="ds-sec" style={{ padding: '96px 0' }}>
          <div className="ds-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.cyan, marginBottom: 14 }}>Four Channels</div>
              <h2 style={{ fontSize: 40, fontWeight: 800, color: '#E8F4FC', letterSpacing: '-0.02em', lineHeight: 1.12 }}>Every dimension of community</h2>
              <p style={{ fontSize: 15, color: '#4A6A7A', marginTop: 12, lineHeight: 1.7 }}>SIGNAL is earned across four channels, each with five levels and up to 250 points.</p>
            </div>

            <div className="ds-ch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              {[
                { icon: '𝕏',   label: 'X Signal',   color: '#D0E8F4', desc: 'Post qualifying content mentioning DUAL or SIGNAL. Earn levels as your posts accumulate views — from first post to 1M+.' },
                { icon: 'TG',  label: 'Telegram',   color: '#5ED3EA', desc: 'Stay active in the DUAL Telegram group. Progress from 1 active day to 180 days of regular participation.' },
                { icon: 'DC',  label: 'Discord',    color: '#7B83EB', desc: 'Engage in the DUAL Discord server. Active participation days earn SIGNAL alongside your Telegram presence.' },
                { icon: 'GOV', label: 'Governance', color: '#F7C873', desc: 'Participate in the DUAL governance forum — post topics, comment on proposals, vote. Activity points accumulate toward Steward.' },
              ].map(ch => (
                <div key={ch.label} className="ds-ch-card" style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(94,211,234,0.06)', border: `1px solid rgba(94,211,234,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: ch.color, flexShrink: 0 }}>{ch.icon}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#E8F4FC', letterSpacing: '-0.01em' }}>{ch.label}</div>
                      <div style={{ fontSize: 11, color: '#2A4A5A', marginTop: 2 }}>Up to 250 pts · 5 levels</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
                    {[1,2,3,4,5].map(l => <div key={l} style={{ flex: 1, height: 4, borderRadius: 2, background: ch.color, opacity: 0.55 }} />)}
                  </div>
                  <p style={{ fontSize: 12, color: '#4A6A7A', lineHeight: 1.7 }}>{ch.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />

        {/* ── Tiers ── */}
        <section className="ds-sec" style={{ padding: '96px 0' }}>
          <div className="ds-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.cyan, marginBottom: 14 }}>Six Tiers</div>
              <h2 style={{ fontSize: 40, fontWeight: 800, color: '#E8F4FC', letterSpacing: '-0.02em', lineHeight: 1.12 }}>From Initiate to Legend</h2>
              <p style={{ fontSize: 15, color: '#4A6A7A', marginTop: 12, lineHeight: 1.7 }}>Your SIGNAL score places you in a tier. Each one marks a new level of community standing.</p>
            </div>

            <div className="ds-tiers" style={{ display: 'flex', gap: 6 }}>
              {[
                { name: 'INITIATE',    range: '0–149',    color: '#4A7A8A', bg: 'transparent' },
                { name: 'EXPLORER',    range: '150–349',  color: '#5ED3EA', bg: 'transparent' },
                { name: 'BUILDER',     range: '350–549',  color: '#7FE4F4', bg: 'transparent' },
                { name: 'STAKEHOLDER', range: '550–749',  color: '#A8EDF9', bg: 'transparent' },
                { name: 'GENESIS',     range: '750–899',  color: '#F7C873', bg: 'rgba(247,200,115,0.03)' },
                { name: 'LEGEND',      range: '900–1000', color: '#FFD700', bg: 'rgba(255,215,0,0.03)' },
              ].map(t => (
                <div key={t.name} className="ds-tier" style={{ flex: 1, background: t.bg, border: `1px solid rgba(94,211,234,0.08)`, borderRadius: 10, padding: '22px 12px 20px', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.color, marginBottom: 6 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: '#5A7A8A', fontVariantNumeric: 'tabular-nums' }}>{t.range}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />

        {/* ── CTA ── */}
        <section className="ds-sec" style={{ padding: '96px 0 80px' }}>
          <div className="ds-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 48px' }}>
            <div className="ds-cta-box" style={{
              background: `radial-gradient(ellipse 700px 300px at 50% 100%, rgba(14,180,208,0.05) 0%, transparent 70%), ${C.bgCard}`,
              border: `1px solid ${C.border}`,
              borderRadius: 24, padding: '72px 64px',
              textAlign: 'center', position: 'relative', overflow: 'hidden',
            }}>
              {/* Butterfly */}
              <Image
                src="/assets/dual-signal/ui/Signal-butterfly.png"
                alt="" aria-hidden width={340} height={340}
                style={{ position: 'absolute', right: -50, bottom: -50, opacity: 0.05, filter: 'saturate(0.1) brightness(0.6)', pointerEvents: 'none' }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.cyan, marginBottom: 20 }}>Join DUAL // SIGNAL</div>
                <h2 style={{ fontSize: 46, fontWeight: 900, color: '#E8F4FC', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>
                  Ready to build your<br />community identity?
                </h2>
                <p style={{ fontSize: 15, color: '#6A8A9A', marginBottom: 36 }}>Enter your email. We&apos;ll send a secure link to get started.</p>

                <Link href="/login" className="ds-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.cyanDim, color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '17px 36px', borderRadius: 12, textDecoration: 'none', transition: 'opacity 0.15s' }}>
                  Get Your Passport →
                </Link>

                <p style={{ fontSize: 11, color: '#4A6A7A', marginTop: 16 }}>New here? Your Passport will be created automatically.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="ds-footer" style={{ borderTop: `1px solid rgba(94,211,234,0.06)`, padding: '28px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3A5A6A' }}>
            DUAL <span style={{ color: '#3A6A7A' }}>//</span> SIGNAL
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A5A6A' }}>
            DUAL Network · Chain 6301
          </div>
        </footer>

      </div>
    </>
  );
}
