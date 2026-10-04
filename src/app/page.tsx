import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { C, TIERS, tierColor } from '@/lib/theme';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DUAL // SIGNAL — Community Identity Passport',
  description: 'Earn SIGNAL through your community activity. Level up through six tiers. Mint your Passport on the DUAL Network.',
  openGraph: {
    title: 'DUAL // SIGNAL — Community Identity Passport',
    description: 'Earn SIGNAL through your community activity. Level up through six tiers. Mint your Passport on the DUAL Network.',
  },
};

// ── Live data ─────────────────────────────────────────────────────────────────

interface TopMember { username: string; score: number; tier: string; dualObjectId: string }
interface HomeStats { passports: number; totalSignal: number; connections: number; top: TopMember[] }

async function loadStats(): Promise<HomeStats | null> {
  try {
    const [passports, signal, connections, top] = await Promise.all([
      db.badge.count(),
      db.badge.aggregate({ _sum: { signalScore: true } }),
      db.externalAccount.count(),
      db.badge.findMany({
        orderBy: { signalScore: 'desc' },
        take:    3,
        include: { user: { select: { username: true } } },
      }),
    ]);
    return {
      passports,
      totalSignal: signal._sum.signalScore ?? 0,
      connections,
      top: top.map(b => ({
        username:     b.user?.username ?? 'member',
        score:        b.signalScore,
        tier:         b.cachedTier,
        dualObjectId: b.dualObjectId,
      })),
    };
  } catch (err) {
    console.error('[home] stats unavailable:', err instanceof Error ? err.message : err);
    return null;
  }
}

const fmt = (n: number) => n.toLocaleString('en-US');

// ── Content ───────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01', title: 'Join with email',
    body: 'Enter your email and click the secure link we send you. No password, no seed phrase — your DUAL wallet account is created for you.',
    icon: <><rect x="2" y="4" width="16" height="12" rx="2"/><polyline points="2,6 10,12 18,6"/></>,
  },
  {
    n: '02', title: 'Connect your accounts',
    body: 'Link your X, Telegram, Discord and governance forum handles. Your community activity is tracked automatically and turns into SIGNAL.',
    icon: <><circle cx="5" cy="10" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="15" r="2"/><line x1="7" y1="9" x2="13" y2="6"/><line x1="7" y1="11" x2="13" y2="14"/></>,
  },
  {
    n: '03', title: 'Claim it in your DUAL wallet',
    body: 'Your Passport is minted on the DUAL Network. Sign in to your DUAL wallet to see it — it levels up as your SIGNAL grows.',
    icon: <><rect x="3" y="5" width="14" height="11" rx="2"/><path d="M3 8h14"/><circle cx="13.5" cy="12" r="1"/></>,
  },
];

const CHANNELS = [
  { icon: '𝕏',   label: 'X Signal',   color: '#D0E8F4', desc: 'Post qualifying content mentioning DUAL or SIGNAL. Earn levels as your posts accumulate views — from first post to 1M+.' },
  { icon: 'TG',  label: 'Telegram',   color: '#5ED3EA', desc: 'Stay active in the DUAL Telegram group. Progress from 1 active day to 180 days of regular participation.' },
  { icon: 'DC',  label: 'Discord',    color: '#7B83EB', desc: 'Engage in the DUAL Discord server. Active participation days earn SIGNAL alongside your Telegram presence.' },
  { icon: 'GOV', label: 'Governance', color: '#F7C873', desc: 'Participate in the DUAL governance forum — post topics, comment on proposals, vote. Activity points accumulate toward Steward.' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Home() {
  const jar = await cookies();
  if (jar.has('ds_session')) redirect('/me');

  const stats    = await loadStats();
  const featured = stats?.top.find(t => t.score > 0) ?? null;
  // Real Passport of the current #1 member; a sample Passport until someone has SIGNAL.
  const faceSrc  = featured ? `/faces/badge?id=${encodeURIComponent(featured.dualObjectId)}` : '/faces/badge?mock=mixed';

  return (
    <>
      <style>{`
        .home-hero {
          min-height: 100vh;
          padding: 120px 0 80px;
          display: flex; align-items: center;
          position: relative; overflow: hidden;
          background: radial-gradient(ellipse 900px 600px at 70% 45%, rgba(14,180,208,0.09) 0%, transparent 70%), var(--ds-bg);
        }
        .home-hero-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 48px; align-items: center; }
        .home-ctas { display: flex; gap: 12px; margin: 36px 0 44px; flex-wrap: wrap; }

        .home-passport { position: relative; perspective: 1400px; }
        .home-passport-glow {
          position: absolute; inset: 8% 6%;
          background: radial-gradient(ellipse at center, rgba(94,211,234,0.28), transparent 70%);
          filter: blur(40px); z-index: 0;
        }
        @keyframes home-float {
          0%, 100% { transform: rotateY(-9deg) rotateX(4deg) translateY(0); }
          50%      { transform: rotateY(-5deg) rotateX(2deg) translateY(-10px); }
        }
        .home-passport-card {
          position: relative; z-index: 1;
          aspect-ratio: 3 / 2; width: 100%;
          border-radius: 18px; overflow: hidden;
          border: 1px solid var(--ds-border-strong);
          box-shadow: 0 40px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(94,211,234,0.06);
          background: #001A27;
          animation: home-float 7s ease-in-out infinite;
        }
        .home-passport-card iframe { width: 100%; height: 100%; border: 0; display: block; pointer-events: none; }
        .home-passport-caption {
          position: relative; z-index: 1;
          display: flex; justify-content: center; align-items: center; gap: 8px;
          margin-top: 22px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ds-text-dim);
        }
        .home-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ds-success); box-shadow: 0 0 0 3px rgba(74,200,154,0.18); }

        .home-stats { display: flex; gap: 36px; flex-wrap: wrap; }
        .home-stat-value { display: block; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--ds-text-strong); font-variant-numeric: tabular-nums; }
        .home-stat-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ds-text-faint); margin-top: 6px; }

        .home-top { margin-top: 28px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; max-width: 440px; }
        .home-top-row { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 10px; padding: 6px 2px; font-size: 13px; text-decoration: none; color: var(--ds-text); border-radius: 6px; }
        .home-top-row:hover { background: var(--ds-cyan-wash); }

        .home-sec { padding: 96px 0; }
        .home-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .home-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .home-tiers { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
        .home-icon { width: 44px; height: 44px; background: var(--ds-cyan-wash); border: 1px solid var(--ds-border-strong); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }

        @media (max-width: 960px) {
          .home-hero { padding: 100px 0 64px; min-height: 0; }
          .home-hero-grid { grid-template-columns: 1fr; gap: 48px; }
          .home-passport { max-width: 560px; margin: 0 auto; width: 100%; }
        }
        @media (max-width: 768px) {
          .home-sec { padding: 64px 0; }
          .home-grid-3, .home-grid-2 { grid-template-columns: 1fr; }
          .home-tiers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .home-ctas .ds-btn { flex: 1 1 100%; }
          .home-stats { gap: 24px; }
          .home-cta-box { padding: 48px 20px !important; }
        }
        @media (max-width: 480px) {
          .home-tiers { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      {/* ── Nav ── */}
      <nav className="ds-nav">
        <Link href="/" className="ds-logo">DUAL <span>//</span> SIGNAL</Link>
        <div className="ds-nav-links">
          <span className="ds-pill ds-nav-hide-sm">Alpha</span>
          <Link href="/leaderboard" className="ds-nav-link ds-nav-hide-sm">Leaderboard</Link>
          <Link href="/login" className="ds-btn ds-btn-primary ds-btn-sm">Get Passport →</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="ds-container" style={{ width: '100%' }}>
          <div className="home-hero-grid">
            <div className="ds-anim-up">
              <p className="ds-eyebrow">Community Identity Passport</p>
              <h1 className="ds-h1" style={{ fontSize: 'clamp(36px, 3.8vw, 56px)' }}>Your DUAL activity,<br /><em>on one Passport.</em></h1>
              <p className="ds-lead" style={{ marginTop: 22, maxWidth: 480 }}>
                Earn SIGNAL from what you already do on X, Telegram, Discord and the governance forum.
                Your Passport lives on the DUAL Network and levels up with you.
              </p>

              <div className="home-ctas">
                <Link href="/login" className="ds-btn ds-btn-primary">Get Your Passport →</Link>
                <Link href="/leaderboard" className="ds-btn ds-btn-ghost">View Leaderboard</Link>
              </div>

              {stats && (
                <div className="home-stats">
                  {[
                    { value: fmt(stats.passports),   label: 'Passports minted' },
                    { value: fmt(stats.totalSignal), label: 'SIGNAL earned' },
                    { value: fmt(stats.connections), label: 'Accounts linked' },
                  ].map(s => (
                    <div key={s.label}>
                      <span className="home-stat-value">{s.value}</span>
                      <span className="home-stat-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {stats && stats.top.some(t => t.score > 0) && (
                <div className="ds-inset home-top">
                  <span className="ds-label" style={{ marginBottom: 4 }}>Top of the leaderboard</span>
                  {stats.top.filter(t => t.score > 0).map((m, i) => (
                    <Link key={m.dualObjectId} href={`/badge/${m.dualObjectId}`} className="home-top-row">
                      <span style={{ color: C.textFaint, fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                      <span style={{ color: C.textStrong, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.username}
                        <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: tierColor(m.tier) }}>{m.tier}</span>
                      </span>
                      <span style={{ color: C.cyan, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(m.score)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="home-passport ds-anim-up" style={{ animationDelay: '0.15s' }}>
              <div className="home-passport-glow" />
              <div className="home-passport-card">
                <iframe src={faceSrc} title={featured ? `${featured.username}'s Passport` : 'Sample Passport'} loading="eager" tabIndex={-1} />
              </div>
              <div className="home-passport-caption">
                {featured ? (
                  <><span className="home-live-dot" /> Live Passport · {featured.username} · #1</>
                ) : (
                  <>Sample Passport</>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="ds-divider" />

      {/* ── How It Works ── */}
      <section className="home-sec">
        <div className="ds-container">
          <div className="ds-section-head">
            <p className="ds-eyebrow">How It Works</p>
            <h2 className="ds-h2">Three steps to your Passport</h2>
            <p className="ds-body">Your identity is built from real community activity — not self-reported claims.</p>
          </div>

          <div className="home-grid-3">
            {STEPS.map(s => (
              <div key={s.n} className="ds-card ds-card-hover" style={{ padding: '32px 28px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: C.textFaint, marginBottom: 20 }}>{s.n} —</div>
                <div className="home-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.cyan }}>{s.icon}</svg>
                </div>
                <h3 className="ds-h3">{s.title}</h3>
                <p className="ds-body" style={{ fontSize: 13 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="ds-divider" />

      {/* ── Four Channels ── */}
      <section className="home-sec">
        <div className="ds-container">
          <div className="ds-section-head">
            <p className="ds-eyebrow">Four Channels</p>
            <h2 className="ds-h2">Every dimension of community</h2>
            <p className="ds-body">SIGNAL is earned across four channels, each with five levels and up to 250 points.</p>
          </div>

          <div className="home-grid-2">
            {CHANNELS.map(ch => (
              <div key={ch.label} className="ds-card ds-card-hover" style={{ padding: '28px 28px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: C.cyanWash, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: ch.color, flexShrink: 0 }}>{ch.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.textStrong }}>{ch.label}</div>
                    <div className="ds-small" style={{ marginTop: 2 }}>Up to 250 pts · 5 levels</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map(l => <div key={l} style={{ flex: 1, height: 4, borderRadius: 2, background: ch.color, opacity: 0.2 + l * 0.12 }} />)}
                </div>
                <p className="ds-body" style={{ fontSize: 13 }}>{ch.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="ds-divider" />

      {/* ── Tiers ── */}
      <section className="home-sec">
        <div className="ds-container">
          <div className="ds-section-head">
            <p className="ds-eyebrow">Six Tiers</p>
            <h2 className="ds-h2">From Initiate to Legend</h2>
            <p className="ds-body">Your SIGNAL score places you in a tier. Each one marks a new level of community standing.</p>
          </div>

          <div className="home-tiers">
            {TIERS.map(t => (
              <div key={t.name} className="ds-card ds-card-hover" style={{ borderRadius: 10, padding: '22px 12px 20px', textAlign: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, margin: '0 auto 10px' }} />
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: t.color, marginBottom: 6 }}>{t.name}</div>
                <div className="ds-small" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.range}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="ds-divider" />

      {/* ── CTA ── */}
      <section className="home-sec" style={{ paddingBottom: 80 }}>
        <div className="ds-container">
          <div className="ds-card home-cta-box" style={{
            background: `radial-gradient(ellipse 700px 300px at 50% 100%, rgba(14,180,208,0.07) 0%, transparent 70%), ${C.bgCard}`,
            borderRadius: 24, padding: '72px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <Image
              src="/assets/dual-signal/ui/Signal-butterfly.png"
              alt="" aria-hidden width={340} height={340}
              style={{ position: 'absolute', right: -50, bottom: -50, opacity: 0.06, filter: 'saturate(0.1) brightness(0.6)', pointerEvents: 'none' }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p className="ds-eyebrow">Join DUAL // SIGNAL</p>
              <h2 className="ds-h2" style={{ marginBottom: 14 }}>Ready to build your<br />community identity?</h2>
              <p className="ds-body" style={{ fontSize: 15, marginBottom: 36 }}>
                {stats && stats.passports > 0
                  ? `Join ${fmt(stats.passports)} members already earning SIGNAL.`
                  : 'Enter your email. We’ll send a secure link to get started.'}
              </p>
              <Link href="/login" className="ds-btn ds-btn-primary" style={{ padding: '17px 36px', fontSize: 13 }}>Get Your Passport →</Link>
              <p className="ds-small" style={{ marginTop: 16 }}>Your Passport and DUAL wallet account are created automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="ds-footer">
        <span className="ds-logo" style={{ fontSize: 12, color: C.textFaint }}>DUAL <span>//</span> SIGNAL</span>
        <span><Link href="/leaderboard">Leaderboard</Link> · DUAL Network</span>
      </footer>
    </>
  );
}
