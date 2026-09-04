/**
 * GET /api/og/[dualObjectId]
 *
 * Generates a 1200×630 Open Graph image for a DUAL // SIGNAL badge.
 * Used as og:image in the public badge page meta tags.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const W = 1200;
const H = 630;

const TIER_COLOR: Record<string, string> = {
  INITIATE:    '#5ED3EA',
  EXPLORER:    '#5ED3EA',
  BUILDER:     '#7FE4F4',
  STAKEHOLDER: '#A8EDF9',
  GENESIS:     '#F7C873',
  LEGEND:      '#FFD700',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dualObjectId: string }> },
) {
  const { dualObjectId } = await params;

  const badge = await db.badge.findFirst({ where: { dualObjectId } });

  const tier        = badge?.cachedTier ?? 'INITIATE';
  const score       = badge?.signalScore ?? 0;
  const wallet      = badge?.walletAddress ?? '';
  const shortWallet = wallet
    ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}`
    : 'Community Member';
  const memberSince = badge?.memberSince ?? '';
  const accentColor = TIER_COLOR[tier] ?? '#5ED3EA';

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const bgUrl  = `${appUrl}/assets/dual-signal/card/card-background.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width:           W,
          height:          H,
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          background:      '#001A27',
          position:        'relative',
          overflow:        'hidden',
          fontFamily:      'sans-serif',
        }}
      >
        {/* Background card — centered, slightly scaled down */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bgUrl}
          width={882}
          height={588}
          style={{ position: 'absolute', top: 21, left: 159, objectFit: 'fill' }}
          alt=""
        />

        {/* Dark scrim — bottom third for text legibility */}
        <div style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          right:      0,
          height:     220,
          background: 'linear-gradient(to top, rgba(0,17,30,0.92) 60%, transparent)',
          display:    'flex',
        }} />

        {/* Tier badge pill — top center */}
        <div style={{
          position:        'absolute',
          top:             28,
          left:            '50%',
          transform:       'translateX(-50%)',
          background:      'rgba(0,17,30,0.7)',
          border:          `1.5px solid ${accentColor}`,
          borderRadius:    999,
          padding:         '6px 22px',
          color:           accentColor,
          fontSize:        18,
          fontWeight:      700,
          letterSpacing:   6,
          display:         'flex',
        }}>
          {tier}
        </div>

        {/* Bottom text block */}
        <div style={{
          position:       'absolute',
          bottom:         40,
          left:           60,
          right:          60,
          display:        'flex',
          flexDirection:  'column',
          gap:            10,
        }}>
          {/* Title row */}
          <div style={{
            display:       'flex',
            alignItems:    'baseline',
            gap:           16,
          }}>
            <span style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>
              DUAL // SIGNAL
            </span>
            <span style={{ color: '#5ED3EA', fontSize: 20, opacity: 0.7 }}>
              Community Identity Passport
            </span>
          </div>

          {/* Wallet + stats row */}
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         32,
          }}>
            <span style={{ color: accentColor, fontSize: 22, fontWeight: 600, letterSpacing: 1 }}>
              {shortWallet}
            </span>
            <span style={{ color: '#5ED3EA', fontSize: 20, opacity: 0.6 }}>•</span>
            <span style={{ color: '#D4E8F0', fontSize: 20 }}>
              {score.toLocaleString()} SIGNAL
            </span>
            {memberSince && (
              <>
                <span style={{ color: '#5ED3EA', fontSize: 20, opacity: 0.6 }}>•</span>
                <span style={{ color: '#D4E8F0', fontSize: 20, opacity: 0.7 }}>
                  Since {memberSince}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
