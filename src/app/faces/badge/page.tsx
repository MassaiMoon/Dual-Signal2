'use client';

/**
 * DUAL // SIGNAL — Badge Face Renderer
 *
 * Background (1536×1024, 3:2) already contains all static UI chrome:
 *   DUAL logo, DUAL // SIGNAL title, COMMUNITY IDENTITY PASSPORT,
 *   WALLET label + field frame, SIGNAL label, progress bar border,
 *   ACHIEVEMENTS heading, X SIGNAL / TELEGRAM / GOVERNANCE / HOLDER/STAKING labels,
 *   circular tier HUD, TOKENIZE EVERYTHING footer.
 *
 * This component ONLY overlays dynamic state into the spaces designed for it.
 *
 * PNG ASSET TRANSPARENCY:
 *   Tier PNGs        → RGBA ✓ transparent
 *   Achievement PNGs → RGB  ✗ no alpha — must be replaced with RGBA exports
 *   OG PNG           → RGB  ✗ no alpha — must be replaced with RGBA export
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { tierAssets, achievementAssets, specialAssets } from '@/lib/assets';

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  teal:    '#159DB8',
  tealLt:  '#5ED3EA',
  silver:  '#D4E8F0',
  gold:    '#F7C873',
  navy:    '#001A27',
  dim:     '#2A5C70',
} as const;

// ─── Layout config — all values are % of card canvas (1536 × 1024) ──────────
//
// Adjust these to precisely align overlays with the background image.
// Enable ?debugLayout=1 in the URL to see bounding boxes.

const L = {
  // Left circular HUD — tier artwork fills this zone
  tier: { l: 10, t: 6, w: 42, h: 74 },

  // OG prestige pin — upper-right corner of tier zone
  og:   { l: 44, t: 9, w: 10 },

  // Tier name — above bottom crystal decorations
  tierName: { l: 11, t: 73, w: 41 },

  // Wallet value — inside the wallet field box
  wallet: { l: 59.5, t: 24.5, w: 29, h: 6 },

  // Signal score number only — "/ 1,000" is static in background artwork
  signal: { l: 57.5, t: 35.5, w: 24, h: 8 },

  // Single achievement zone — icon column left, level column right, 4 equal rows inside
  achievements: { l: 55.0, t: 54.5, r: 4.5, h: 26 },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

const TIER_BRIGHTNESS: Record<string, number> = {
  INITIATE:    0.70,
  EXPLORER:    0.80,
  BUILDER:     0.90,
  STAKEHOLDER: 1.00,
  GENESIS:     1.10,
  LEGEND:      1.20,
};

// Returns the correct achievement PNG for the given track and level (1-5).
// Uses level-1 icon when locked (level 0) so the socket always shows art.
function iconSrc(
  track:  keyof typeof achievementAssets,
  level:  number,
): string {
  const map = achievementAssets[track];
  const key = Math.max(1, level) as keyof typeof map;
  return map[key];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BadgeData {
  signalScore:     number;
  tier:            string;
  xSignalLevel:    number;
  telegramLevel:   number;
  governanceLevel: number;
  holderLevel:     number;
  isOG:            boolean;
  walletAddress:   string;
  memberSince:     string;
}

// ─── Overlay helper — positions an element by L config ───────────────────────

function Slot({
  cfg, debug, debugColor = '#0ff', style, children,
}: {
  cfg:         { l?: number; t?: number; r?: number; b?: number; w?: number; h?: number };
  debug?:      boolean;
  debugColor?: string;
  style?:      React.CSSProperties;
  children?:   React.ReactNode;
}) {
  const s: React.CSSProperties = {
    position:  'absolute',
    left:      cfg.l != null ? `${cfg.l}%` : undefined,
    top:       cfg.t != null ? `${cfg.t}%` : undefined,
    right:     cfg.r != null ? `${cfg.r}%` : undefined,
    bottom:    cfg.b != null ? `${cfg.b}%` : undefined,
    width:     cfg.w != null ? `${cfg.w}%` : undefined,
    height:    cfg.h != null ? `${cfg.h}%` : undefined,
    outline:   debug ? `1px solid ${debugColor}` : undefined,
    ...style,
  };
  return <div style={s}>{children}</div>;
}

// ─── Badge card ──────────────────────────────────────────────────────────────

function BadgeCard({ data, debug }: { data: BadgeData; debug: boolean }) {
  const tierSrc    = tierAssets[data.tier] ?? tierAssets['INITIATE'];
  const shortWallet = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}···${data.walletAddress.slice(-4)}`
    : '—';
  const tracks = [
    { src: iconSrc('xSignal',       data.xSignalLevel),   level: data.xSignalLevel   },
    { src: iconSrc('telegram',      data.telegramLevel),   level: data.telegramLevel  },
    { src: iconSrc('governance',    data.governanceLevel), level: data.governanceLevel },
    { src: iconSrc('holderStaking', data.holderLevel),     level: data.holderLevel    },
  ];

  return (
    <div style={{
      position:    'relative',
      width:       '100%',
      aspectRatio: '3 / 2',
      overflow:    'hidden',
      outline:     debug ? '2px solid red' : undefined,
    }}>

      {/* z=0 — Background (defines the canvas) */}
      <img
        src={specialAssets.cardBackground}
        alt=""
        draggable={false}
        style={{
          position:  'absolute',
          inset:     0,
          width:     '100%',
          height:    '100%',
          objectFit: 'fill',
          zIndex:    0,
        }}
      />

      {/* z=2 — Tier artwork */}
      <Slot cfg={L.tier} debug={debug} debugColor="#0ff" style={{ zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={tierSrc}
          alt={data.tier}
          draggable={false}
          style={{ width: '88%', height: '88%', objectFit: 'contain',
            filter: `brightness(${TIER_BRIGHTNESS[data.tier] ?? 0.70}) drop-shadow(0 0 2.5% #5ED3EA55)` }}
        />
      </Slot>

      {/* z=4 — OG prestige pin */}
      {data.isOG && (
        <Slot cfg={L.og} debug={debug} debugColor="#fa0" style={{ zIndex: 4 }}>
          <img
            src={specialAssets.OG}
            alt="OG"
            draggable={false}
            style={{ width: '100%', height: 'auto', objectFit: 'contain',
              /* TODO: og.png lacks alpha channel — replace with RGBA export */ }}
          />
        </Slot>
      )}

      {/* z=5 — Tier name (left panel, bottom) */}
      <Slot cfg={L.tierName} debug={debug} debugColor="#f0f" style={{
        zIndex:    5,
        textAlign: 'center',
      }}>
        <div style={{
          color:         C.tealLt,
          fontFamily:    'Rajdhani, Orbitron, monospace',
          fontSize:      'clamp(10px, 3.2%, 22px)',
          fontWeight:    700,
          letterSpacing: '0.2em',
          textShadow:    `0 0 1.5% #5ED3EA88`,
          textTransform: 'uppercase',
          lineHeight:    1,
        }}>
          {data.tier}
        </div>
      </Slot>

      {/* z=5 — Wallet value */}
      <Slot cfg={L.wallet} debug={debug} debugColor="#0f0" style={{
        zIndex:      5,
        display:     'flex',
        alignItems:  'center',
        paddingTop:  '1.2%',
        paddingRight: '12%',
      }}>
        <span style={{
          color:         C.tealLt,
          fontFamily:    'Rajdhani, monospace',
          fontSize:      'clamp(12px, 2.6%, 22px)',
          fontWeight:    600,
          letterSpacing: '0.04em',
          whiteSpace:    'nowrap',
        }}>
          {shortWallet}
        </span>
      </Slot>

      {/* z=5 — Signal score only — "/ 1,000" is already in the background artwork */}
      <Slot cfg={L.signal} debug={debug} debugColor="#ff0" style={{
        zIndex:     5,
        display:    'flex',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{
          color:      C.tealLt,
          fontFamily: 'Rajdhani, Orbitron, monospace',
          fontSize:   'clamp(14px, 4.5%, 36px)',
          fontWeight: 700,
        }}>
          {data.signalScore.toLocaleString()}
        </span>
      </Slot>

      {/* z=3 — Achievement zone: 4 equal rows, icon left + level right */}
      <Slot
        cfg={L.achievements}
        debug={debug}
        debugColor="#9f9"
        style={{
          zIndex:        3,
          display:       'flex',
          flexDirection: 'column',
          justifyContent:'space-between',
        }}
      >
        {tracks.map(({ src, level }, i) => (
          <div key={i} style={{
            flex:        1,
            display:     'flex',
            alignItems:  'center',
            minHeight:   0,
          }}>
            {/* Badge icon — full opacity always; locked = dimmed via brightness only */}
            <div style={{
              flexShrink:     0,
              width:          '16%',
              aspectRatio:    '1',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width:      '100%',
                  height:     '100%',
                  objectFit:  'contain',
                  display:    'block',
                  opacity:    1,
                  filter:     level > 0
                    ? 'brightness(8.0) contrast(1.3) saturate(2.5) drop-shadow(0 0 8px rgba(94,211,234,1.0)) drop-shadow(0 0 20px rgba(21,157,184,0.9)) drop-shadow(0 0 35px rgba(94,211,234,0.6))'
                    : 'brightness(2.5) saturate(0.8) drop-shadow(0 0 3px rgba(94,211,234,0.25))',
                }}
              />
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Level indicator */}
            <span style={{
              color:         level > 0 ? C.tealLt : C.dim,
              fontFamily:    'Rajdhani, Orbitron, monospace',
              fontSize:      'clamp(9px, 1.8%, 15px)',
              fontWeight:    700,
              letterSpacing: '0.05em',
              whiteSpace:    'nowrap',
              paddingRight:  '2%',
            }}>
              {level > 0 ? ROMAN[level] : '—'}
            </span>
          </div>
        ))}
      </Slot>
    </div>
  );
}

// ─── Loading / error states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={pageStyle}>
      <span style={{ color: '#5ED3EA', fontFamily: 'Rajdhani, monospace', fontSize: 14, letterSpacing: 3 }}>
        LOADING...
      </span>
    </div>
  );
}

// ─── Mock preview profiles ────────────────────────────────────────────────────

const MOCK_PROFILES: Record<string, BadgeData> = {
  initiate: {
    signalScore: 0, tier: 'INITIATE',
    xSignalLevel: 0, telegramLevel: 0, governanceLevel: 0, holderLevel: 0,
    isOG: false, walletAddress: '0x0000000000000000000000000000000000000000', memberSince: '2025-01',
  },
  explorer: {
    signalScore: 150, tier: 'EXPLORER',
    xSignalLevel: 1, telegramLevel: 1, governanceLevel: 0, holderLevel: 1,
    isOG: false, walletAddress: '0xAbCd1234567890AbCd1234567890AbCd12345678', memberSince: '2025-03',
  },
  builder: {
    signalScore: 380, tier: 'BUILDER',
    xSignalLevel: 2, telegramLevel: 2, governanceLevel: 1, holderLevel: 2,
    isOG: false, walletAddress: '0xAbCd1234567890AbCd1234567890AbCd12345678', memberSince: '2025-04',
  },
  stakeholder: {
    signalScore: 750, tier: 'STAKEHOLDER',
    xSignalLevel: 4, telegramLevel: 4, governanceLevel: 4, holderLevel: 4,
    isOG: false, walletAddress: '0xAbCd1234567890AbCd1234567890AbCd12345678', memberSince: '2025-06',
  },
  genesis: {
    signalScore: 920, tier: 'GENESIS',
    xSignalLevel: 5, telegramLevel: 4, governanceLevel: 4, holderLevel: 5,
    isOG: true, walletAddress: '0xAbCd1234567890AbCd1234567890AbCd12345678', memberSince: '2024-11',
  },
  legend: {
    signalScore: 1000, tier: 'LEGEND',
    xSignalLevel: 5, telegramLevel: 5, governanceLevel: 5, holderLevel: 5,
    isOG: true, walletAddress: '0xAbCd1234567890AbCd1234567890AbCd12345678', memberSince: '2024-09',
  },
};

// ─── Page inner ───────────────────────────────────────────────────────────────

function BadgeFaceInner() {
  const params       = useSearchParams();
  const dualObjectId = params.get('id');
  const mockKey      = params.get('mock');
  const debug        = params.get('debugLayout') === '1';

  const mockData = mockKey ? (MOCK_PROFILES[mockKey] ?? null) : null;

  const [data, setData]       = useState<BadgeData | null>(mockData);
  const [loading, setLoading] = useState(!mockData && !!dualObjectId);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (mockData || !dualObjectId) { setLoading(false); return; }
    fetch(`/api/faces/${dualObjectId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: BadgeData) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [dualObjectId, mockData]);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <div style={pageStyle}>
        <span style={{ color: '#159DB8', fontFamily: 'Rajdhani, monospace', fontSize: 12, letterSpacing: 2 }}>
          BADGE NOT FOUND
        </span>
      </div>
    );
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@700;900&display=swap"
        rel="stylesheet"
      />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #001A27; }
      `}</style>
      <div style={{
        width:     '100%',
        maxWidth:  700,
        margin:    '0 auto',
      }}>
        <BadgeCard data={data} debug={debug} />
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BadgeFacePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BadgeFaceInner />
    </Suspense>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight:      '100vh',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     '#001A27',
};
