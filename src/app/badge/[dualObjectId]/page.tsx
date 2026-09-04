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
  const badge = await db.badge.findFirst({ where: { dualObjectId } });

  if (!badge) {
    return { title: 'DUAL // SIGNAL — Badge Not Found' };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const wallet = badge.walletAddress ?? '';
  const shortWallet = wallet
    ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}`
    : 'Community Member';

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
  const badge = await db.badge.findFirst({ where: { dualObjectId } });

  if (!badge) notFound();

  const appUrl      = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const faceUrl     = `${appUrl}/faces/badge?id=${dualObjectId}`;
  const pageUrl     = `${appUrl}/badge/${dualObjectId}`;
  const wallet      = badge.walletAddress ?? '';
  const shortWallet = wallet
    ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}`
    : 'Community Member';
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
      padding:         '48px 24px 80px',
      fontFamily:      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color:           '#D4E8F0',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 8, fontSize: 13, letterSpacing: 4, color: '#5ED3EA', textTransform: 'uppercase' }}>
        DUAL // SIGNAL
      </div>
      <div style={{ fontSize: 13, color: '#4A7A8A', marginBottom: 40 }}>
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
          title={`DUAL // SIGNAL Badge — ${shortWallet}`}
        />
      </div>

      {/* Stats row */}
      <div style={{
        display:      'flex',
        gap:          32,
        marginBottom: 36,
        fontSize:     14,
        color:        '#7BA8B8',
      }}>
        <Stat label="TIER"   value={tier} accent />
        <Stat label="SIGNAL" value={score.toLocaleString()} />
        {memberSince && <Stat label="MEMBER SINCE" value={memberSince} />}
        <Stat label="WALLET" value={shortWallet} />
      </div>

      {/* Share + embed */}
      <div style={{
        width:        '100%',
        maxWidth:     440,
        display:      'flex',
        flexDirection:'column',
        gap:          16,
      }}>
        <ShareButton url={pageUrl} label={`${shortWallet} — ${tier} on DUAL // SIGNAL`} />

        <details style={{
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
      <div style={{ marginTop: 56, fontSize: 12, color: '#2A4A5A', textAlign: 'center' }}>
        Powered by{' '}
        <span style={{ color: '#3A7A8A' }}>DUAL Network</span>
        {' · '}
        On-chain identity layer for community contributors
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: accent ? '#5ED3EA' : '#A0C8D8' }}>
        {value}
      </span>
    </div>
  );
}
