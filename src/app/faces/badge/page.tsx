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
  tier: { l: 4.5, t: 9, w: 45, h: 76 },

  // OG prestige pin — upper-right corner of tier zone
  og:   { l: 43.5, t: 10, w: 10 },

  // Tier name — inside left panel, above bottom crystal decorations (~82% from top)
  tierName: { l: 7, t: 82, w: 43 },

  // Wallet value — inside the wallet field box
  wallet: { l: 57.8, t: 26.5, w: 31, h: 6 },

  // Signal score — large number, covers background placeholder
  signal: { l: 57.5, t: 36.5, w: 32, h: 9 },

  // Progress bar fill — inside the existing bar frame (just below score)
  bar: { l: 57.2, t: 49.8, w: 30.5, h: 1.8 },

  // Achievement icon slots — centered over the octagonal sockets
  icons: [
    { l: 56.5, t: 53.5 },  // X SIGNAL
    { l: 56.5, t: 62.2 },  // TELEGRAM
    { l: 56.5, t: 70.8 },  // GOVERNANCE
    { l: 56.5, t: 79.4 },  // HOLDER / STAKING
  ],

  // Roman numeral level — aligned with background "—" dash position
  levels: [
    { r: 7.5, t: 56.5 },
    { r: 7.5, t: 65.2 },
    { r: 7.5, t: 73.8 },
    { r: 7.5, t: 82.4 },
  ],
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

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
  children:    React.ReactNode;
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
  const progress   = Math.min(1, data.signalScore / 1000);

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
            filter: 'drop-shadow(0 0 2.5% #5ED3EA55)' }}
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
        zIndex:         5,
        display:        'flex',
        alignItems:     'center',
      }}>
        <span style={{
          color:         C.tealLt,
          fontFamily:    'Rajdhani, monospace',
          fontSize:      'clamp(8px, 1.8%, 16px)',
          fontWeight:    600,
          letterSpacing: '0.05em',
        }}>
          {shortWallet}
        </span>
      </Slot>

      {/* z=5 — Signal score */}
      <Slot cfg={L.signal} debug={debug} debugColor="#ff0" style={{
        zIndex:     5,
        display:    'flex',
        alignItems: 'flex-end',
        gap:        '0.3em',
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
        <span style={{
          color:         C.dim,
          fontFamily:    'Rajdhani, monospace',
          fontSize:      'clamp(8px, 2%, 16px)',
          fontWeight:    600,
          paddingBottom: '0.15em',
        }}>
          / 1,000
        </span>
      </Slot>

      {/* z=5 — Progress bar fill */}
      <Slot cfg={L.bar} debug={debug} debugColor="#f80" style={{ zIndex: 5, overflow: 'hidden', borderRadius: '999px' }}>
        <div style={{
          height:       '100%',
          width:        `${progress * 100}%`,
          background:   `linear-gradient(90deg, ${C.teal}, ${C.tealLt})`,
          borderRadius: '999px',
          boxShadow:    `0 0 6px ${C.tealLt}`,
        }} />
      </Slot>

      {/* z=3 — Achievement icons (4 sockets) */}
      {tracks.map(({ src, level }, i) => (
        <Slot
          key={i}
          cfg={{ l: L.icons[i].l, t: L.icons[i].t, w: 6.5 }}
          debug={debug}
          debugColor="#9f9"
          style={{ zIndex: 3, aspectRatio: '1', opacity: level > 0 ? 1 : 0.35 }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'contain',
              display:    'block',
              background: 'transparent',
              /* TODO: achievement PNGs lack alpha — replace with RGBA exports */
            }}
          />
        </Slot>
      ))}

      {/* z=5 — Level roman numerals */}
      {tracks.map(({ level }, i) => (
        <Slot
          key={i}
          cfg={{ r: L.levels[i].r, t: L.levels[i].t }}
          debug={debug}
          debugColor="#f99"
          style={{ zIndex: 5 }}
        >
          <span style={{
            color:         level > 0 ? C.tealLt : C.dim,
            fontFamily:    'Rajdhani, Orbitron, monospace',
            fontSize:      'clamp(8px, 1.8%, 14px)',
            fontWeight:    700,
            letterSpacing: '0.05em',
            whiteSpace:    'nowrap',
          }}>
            {level > 0 ? ROMAN[level] : '—'}
          </span>
        </Slot>
      ))}
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

// ─── Page inner ───────────────────────────────────────────────────────────────

function BadgeFaceInner() {
  const params       = useSearchParams();
  const dualObjectId = params.get('id');
  const debug        = params.get('debugLayout') === '1';

  const [data, setData]       = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(!!dualObjectId);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!dualObjectId) { setLoading(false); return; }
    fetch(`/api/faces/${dualObjectId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: BadgeData) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [dualObjectId]);

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
