/**
 * /badge/[dualObjectId] — Public shareable badge page.
 *
 * Server Component with dynamic OG metadata for rich link previews.
 * The badge iframe itself is NOT modified — only the surrounding page wrapper.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ShareButton, CopyLinkButton } from './ShareButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ dualObjectId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dualObjectId } = await params;
  const badge = await db.badge.findFirst({
    where: { dualObjectId },
    include: { user: { select: { username: true } } },
  });

  if (!badge) {
    return { title: 'DUAL // SIGNAL — Badge Not Found' };
  }

  const appUrl      = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const username    = badge.user?.username ?? '';
  const wallet      = badge.walletAddress ?? '';
  const shortWallet = username || (wallet ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}` : 'Community Member');

  const title       = `DUAL // SIGNAL — ${shortWallet}`;
  const description = `${badge.cachedTier ?? 'INITIATE'} • ${badge.signalScore ?? 0} SIGNAL score • Member since ${badge.memberSince ?? 'N/A'}`;
  const ogImageUrl  = `${appUrl}/api/og/${dualObjectId}`;
  const pageUrl     = `${appUrl}/badge/${dualObjectId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url:    pageUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type:   'website',
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [ogImageUrl],
    },
  };
}

const TIER_COLOR: Record<string, string> = {
  LEGEND:      '#FFD700',
  GENESIS:     '#F7C873',
  STAKEHOLDER: '#A8EDF9',
  BUILDER:     '#7FE4F4',
  EXPLORER:    '#5ED3EA',
  INITIATE:    '#4A7A8A',
};

export default async function BadgePage({ params }: Props) {
  const { dualObjectId } = await params;
  const badge = await db.badge.findFirst({
    where: { dualObjectId },
    include: { user: { select: { username: true } } },
  });

  if (!badge) notFound();

  const appUrl      = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const faceUrl     = `${appUrl}/faces/badge?id=${dualObjectId}`;
  const pageUrl     = `${appUrl}/badge/${dualObjectId}`;
  const username    = badge.user?.username ?? '';
  const wallet      = badge.walletAddress ?? '';
  const displayId   = username
    ? `@${username}`
    : wallet ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}` : 'Community Member';
  const tier        = badge.cachedTier ?? 'INITIATE';
  const score       = badge.signalScore ?? 0;
  const memberSince = badge.memberSince ?? '';
  const tierColor   = TIER_COLOR[tier] ?? '#5ED3EA';

  const embedCode = `<iframe src="${faceUrl}" width="400" height="600" frameborder="0" allowtransparency="true" style="border-radius:16px;"></iframe>`;

  return (
    <>
      <style>{`
        body { background: #040E1A; }
        .badge-stat:hover { border-color: rgba(94,211,234,0.2) !important; }
        .badge-nav { padding: 0 48px; }
        .badge-footer { padding: 24px 48px; }
        .badge-iframe-scale { transform-origin: top center; }
        @media (max-width: 768px) {
          .badge-nav { padding: 0 20px !important; }
          .badge-nav-label { display: none !important; }
          .badge-footer { padding: 16px 20px !important; flex-direction: column !important; gap: 4px !important; }
        }
        @media (max-width: 480px) {
          .badge-nav { padding: 0 16px !important; }
          .badge-iframe-wrap { width: calc(100vw - 32px) !important; height: calc((100vw - 32px) * 1.5) !important; overflow: hidden !important; }
          .badge-iframe-scale { width: 400px !important; height: 600px !important; transform: scale(calc((100vw - 32px) / 400)) !important; transform-origin: top left !important; }
          .badge-footer { padding: 14px 16px !important; }
        }
      `}</style>

      {/* ── Fixed Nav ── */}
      <nav className="badge-nav" style={{
        position:           'fixed',
        top:                0,
        left:               0,
        right:              0,
        zIndex:             100,
        height:             64,
        background:         'rgba(4,14,26,0.92)',
        backdropFilter:     'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom:       '1px solid rgba(94,211,234,0.09)',
        display:            'flex',
        alignItems:         'center',
        justifyContent:     'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize:      15,
            fontWeight:    800,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         '#E8F4FC',
          }}>
            DUAL <span style={{ color: '#5ED3EA' }}>//</span> SIGNAL
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span className="badge-nav-label" style={{
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         'rgba(94,211,234,0.4)',
            border:        '1px solid rgba(94,211,234,0.14)',
            borderRadius:  4,
            padding:       '3px 8px',
          }}>ALPHA</span>
          <Link href="/leaderboard" style={{
            fontSize:      11,
            fontWeight:    600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         '#4A6A7A',
            border:        '1px solid rgba(94,211,234,0.1)',
            borderRadius:  7,
            padding:       '7px 14px',
            textDecoration: 'none',
          }}>← Leaderboard</Link>
        </div>
      </nav>

      <main style={{
        minHeight:  '100vh',
        background: '#040E1A',
        color:      '#C8D8E8',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        paddingTop: 64,
      }}>

        {/* ── Hero wrapper ── */}
        <div style={{
          background:  'radial-gradient(ellipse 800px 600px at 50% 80px, rgba(14,180,208,0.07) 0%, transparent 65%)',
          padding:     '52px 24px 52px',
          textAlign:   'center',
        }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ display: 'block', width: 24, height: 1, background: 'rgba(94,211,234,0.3)' }} />
            <span style={{
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color:         '#5ED3EA',
            }}>Community Identity Passport</span>
            <span style={{ display: 'block', width: 24, height: 1, background: 'rgba(94,211,234,0.3)' }} />
          </div>
          <p style={{
            fontSize:      12,
            fontWeight:    600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color:         '#2A4A5A',
            marginBottom:  40,
          }}>
            {displayId} · <span style={{ color: tierColor }}>{tier}</span>
          </p>

          {/* ── Badge iframe — UNTOUCHED ── */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              position:     'relative',
              display:      'inline-block',
              borderRadius: 18,
              padding:      1,
              background:   `linear-gradient(135deg, ${tierColor}55 0%, ${tierColor}18 50%, ${tierColor}40 100%)`,
              boxShadow:    `0 0 80px ${tierColor}18, 0 24px 64px rgba(0,0,0,0.7)`,
            }}>
              <div className="badge-iframe-wrap" style={{
                width:        400,
                height:       600,
                borderRadius: 16,
                overflow:     'hidden',
              }}>
                <iframe
                  className="badge-iframe-scale"
                  src={faceUrl}
                  width={400}
                  height={600}
                  style={{ border: 'none', display: 'block' }}
                  title={`DUAL // SIGNAL Badge — ${displayId}`}
                />
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(94,211,234,0.06)', margin: 0 }} />

        {/* ── Stats + actions ── */}
        <div style={{
          maxWidth: 480,
          margin:   '0 auto',
          padding:  '40px 24px 80px',
        }}>

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            <div className="badge-stat" style={statCard}>
              <div style={statLabel}>Tier</div>
              <div style={{ ...statValue, color: tierColor, fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>
                {tier}
              </div>
            </div>
            <div className="badge-stat" style={statCard}>
              <div style={statLabel}>Signal</div>
              <div style={{ ...statValue, color: tierColor }}>{score.toLocaleString()}</div>
            </div>
            {memberSince && (
              <div className="badge-stat" style={statCard}>
                <div style={statLabel}>Member Since</div>
                <div style={{ ...statValue, fontSize: 13 }}>{memberSince}</div>
              </div>
            )}
            <div className="badge-stat" style={statCard}>
              <div style={statLabel}>Username</div>
              <div style={{ ...statValue, color: tierColor, fontSize: 13 }}>{displayId}</div>
            </div>
          </div>

          {/* Share CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <ShareButton url={pageUrl} label={`${displayId} — ${tier} on DUAL // SIGNAL`} />
            <CopyLinkButton url={pageUrl} />
          </div>

          {/* Embed code */}
          <details style={{
            background:   '#071525',
            border:       '1px solid rgba(94,211,234,0.09)',
            borderRadius: 12,
            overflow:     'hidden',
          }}>
            <summary style={{
              padding:       '14px 18px',
              cursor:        'pointer',
              fontSize:      10,
              fontWeight:    700,
              letterSpacing: '0.2em',
              color:         '#3A6070',
              textTransform: 'uppercase',
              userSelect:    'none',
              listStyle:     'none',
              display:       'flex',
              justifyContent: 'space-between',
              alignItems:    'center',
              borderBottom:  '1px solid rgba(94,211,234,0.07)',
            }}>
              Embed Code
              <span style={{ color: '#2A4A5A', fontSize: 12 }}>›</span>
            </summary>
            <div style={{ padding: '14px 18px' }}>
              <pre style={{
                fontFamily:  '"Menlo","Monaco",monospace',
                fontSize:    10,
                lineHeight:  1.7,
                color:       '#3A6070',
                background:  'rgba(4,14,26,0.6)',
                borderRadius: 8,
                padding:     '12px 14px',
                whiteSpace:  'pre-wrap',
                wordBreak:   'break-all',
                margin:      0,
              }}>
                {embedCode}
              </pre>
            </div>
          </details>

        </div>

        {/* ── Footer ── */}
        <footer className="badge-footer" style={{
          borderTop:      '1px solid rgba(94,211,234,0.06)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize:      12,
            fontWeight:    700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         '#1A2E3A',
          }}>
            DUAL <span style={{ color: '#1E3A4A' }}>//</span> SIGNAL
          </span>
          <span style={{
            fontSize:      10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         '#12202C',
          }}>On-chain identity layer · DUAL Network</span>
        </footer>

      </main>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const statCard: React.CSSProperties = {
  flex:         1,
  minWidth:     90,
  background:   'rgba(94,211,234,0.02)',
  border:       '1px solid rgba(94,211,234,0.1)',
  borderRadius: 12,
  padding:      '14px 16px',
  textAlign:    'center',
  transition:   'border-color 0.15s',
  cursor:       'default',
};

const statLabel: React.CSSProperties = {
  fontSize:      9,
  fontWeight:    700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color:         'rgba(94,211,234,0.35)',
  marginBottom:  6,
};

const statValue: React.CSSProperties = {
  fontSize:           22,
  fontWeight:         800,
  color:              '#D0E4EE',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing:      '-0.02em',
  lineHeight:         1,
};
