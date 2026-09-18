/**
 * /badge/[dualObjectId] — Public shareable badge page.
 *
 * Server Component with dynamic OG metadata for rich link previews.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import ShareButton from './ShareButton';

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
  const displayId   = username || (wallet ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}` : 'Community Member');
  const tier        = badge.cachedTier ?? 'INITIATE';
  const score       = badge.signalScore ?? 0;
  const memberSince = badge.memberSince ?? '';

  const embedCode = `<iframe src="${faceUrl}" width="400" height="600" frameborder="0" allowtransparency="true" style="border-radius:16px;"></iframe>`;

  return (
    <main style={{
      minHeight:       '100vh',
      background:      '#00111E',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      padding:         '96px 24px 80px',
      fontFamily:      "'Inter','SF Pro Display',system-ui,sans-serif",
      color:           '#D4E8F0',
    }}>
      <style>{`
        @media (max-width: 480px) {
          .badge-stats { flex-wrap: wrap !important; justify-content: center !important; gap: 16px !important; }
          .badge-actions { flex-direction: column !important; align-items: stretch !important; }
          .badge-actions a { text-align: center; }
          .badge-footer { padding: 16px 20px !important; flex-direction: column !important; gap: 4px !important; }
        }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position:           'fixed',
        top:                0,
        left:               0,
        right:              0,
        height:             64,
        background:         'rgba(0,17,30,0.88)',
        backdropFilter:     'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom:       '1px solid rgba(94,211,234,0.09)',
        display:            'flex',
        alignItems:         'center',
        justifyContent:     'space-between',
        padding:            '0 32px',
        zIndex:             100,
      }}>
        <a href="/" style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.22em', color: '#E8F4FC', textTransform: 'uppercase', textDecoration: 'none' }}>
          DUAL <span style={{ color: '#5ED3EA' }}>//</span> SIGNAL
        </a>
        <a href="/login" style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          background:     '#0EB4D0',
          color:          '#fff',
          fontSize:       11,
          fontWeight:     700,
          letterSpacing:  '0.1em',
          textTransform:  'uppercase',
          padding:        '9px 18px',
          borderRadius:   8,
          textDecoration: 'none',
        }}>
          Get Your Passport →
        </a>
      </nav>

      {/* Eyebrow */}
      <div style={{ marginBottom: 6, fontSize: 11, letterSpacing: '0.28em', color: '#5ED3EA', textTransform: 'uppercase', fontWeight: 700 }}>
        DUAL // SIGNAL
      </div>
      <div style={{ fontSize: 12, color: '#4A7A8A', marginBottom: 36, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Community Identity Passport
      </div>

      {/* Badge card iframe */}
      <div style={{
        width:        400,
        height:       600,
        borderRadius: 16,
        overflow:     'hidden',
        boxShadow:    '0 0 60px rgba(94,211,234,0.15), 0 4px 32px rgba(0,0,0,0.6)',
        marginBottom: 36,
      }}>
        <iframe
          src={faceUrl}
          width={400}
          height={600}
          style={{ border: 'none', display: 'block' }}
          title={`DUAL // SIGNAL Badge — ${displayId}`}
        />
      </div>

      {/* Stats row */}
      <div className="badge-stats" style={{
        display:        'flex',
        gap:            32,
        marginBottom:   36,
        fontSize:       14,
        color:          '#7BA8B8',
        justifyContent: 'center',
      }}>
        <Stat label="TIER"     value={tier} accent />
        <Stat label="SIGNAL"   value={score.toLocaleString()} />
        {memberSince && <Stat label="MEMBER SINCE" value={memberSince} />}
        <Stat label="USERNAME" value={displayId} />
      </div>

      {/* Share + embed */}
      <div style={{
        width:        '100%',
        maxWidth:     440,
        display:      'flex',
        flexDirection:'column',
        gap:          16,
      }}>
        <div className="badge-actions" style={{ display: 'flex', gap: 10 }}>
          <ShareButton url={pageUrl} label={`${displayId} — ${tier} on DUAL // SIGNAL`} />
          <a href="/login" style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            6,
            background:     'rgba(94,211,234,0.08)',
            border:         '1px solid rgba(94,211,234,0.2)',
            color:          '#5ED3EA',
            fontSize:       12,
            fontWeight:     700,
            letterSpacing:  '0.08em',
            textTransform:  'uppercase',
            padding:        '10px 16px',
            borderRadius:   8,
            textDecoration: 'none',
            flex:           1,
          }}>
            Build Your Score →
          </a>
        </div>

        <details style={{ marginTop: 8,
          background:   'rgba(94,211,234,0.04)',
          border:       '1px solid rgba(94,211,234,0.12)',
          borderRadius: 10,
          padding:      '12px 16px',
        }}>
          <summary style={{
            cursor:     'pointer',
            fontSize:   13,
            letterSpacing: 2,
            color:      '#5ED3EA',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}>
            Embed Code
          </summary>
          <pre style={{
            marginTop:  12,
            fontSize:   11,
            lineHeight: 1.6,
            color:      '#7BA8B8',
            whiteSpace: 'pre-wrap',
            wordBreak:  'break-all',
            background: 'rgba(0,17,30,0.6)',
            padding:    '12px',
            borderRadius: 6,
          }}>
            {embedCode}
          </pre>
        </details>
      </div>

      {/* Footer */}
      <div className="badge-footer" style={{ marginTop: 56, padding: '0 24px', fontSize: 11, color: '#3A5A6A', textAlign: 'center', letterSpacing: '0.08em' }}>
        Powered by{' '}
        <span style={{ color: '#4A7A8A' }}>DUAL Network</span>
        {' · '}
        On-chain identity layer for community contributors
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: 2, color: '#4A7A8A', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: accent ? '#5ED3EA' : '#A0C8D8' }}>
        {value}
      </span>
    </div>
  );
}
