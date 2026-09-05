'use client';

/**
 * DUAL // SIGNAL — Badge Face Renderer
 *
 * Background (1536×1024, 3:2) already contains all static UI chrome:
 *   DUAL logo, DUAL // SIGNAL title, COMMUNITY IDENTITY PASSPORT,
 *   USERNAME label + field frame, SIGNAL label, progress bar border,
 *   ACHIEVEMENTS heading, X SIGNAL / TELEGRAM / GOVERNANCE / DISCORD labels,
 *   circular tier HUD, TOKENIZE EVERYTHING footer.
 *
 * This component ONLY overlays dynamic state into the spaces designed for it.
 * Achievement badges render cumulatively (Tier 1 through earned tier) in
 * horizontal rows to the RIGHT of the baked-in track labels.
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

const L = {
  tier:     { l: 10, t: 9, w: 42, h: 74 },
  og:       { l: 41, t: 15.5, w: 10 },
  tierName: { l: 11, t: 73, w: 41 },
  wallet:   { l: 59.5, t: 24.5, w: 29, h: 6 },
  signal:   { l: 57.5, t: 35.5, w: 24, h: 8 },
} as const;

// ─── Achievement badge rows ───────────────────────────────────────────────────
// l   = left edge of badge area (%, after baked-in track labels)
// r   = right margin (%)
// h   = row height (% of canvas height)
// cy = center-Y of each track row (% of canvas height), order: X / Telegram / Governance / Discord
// Rendered with transform:translateY(-50%) so cy IS the exact badge-center position — no h/2 offset.
// gap = flex column-gap between badges (relative to row container width)

const ACH = {
  l:  69,
  r:  4.5,
  h:  7.5,
  cy: [57.5, 63.5, 69.5, 75.5] as const,
  gap: '4%',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_BRIGHTNESS: Record<string, number> = {
  INITIATE:    0.70,
  EXPLORER:    0.80,
  BUILDER:     0.90,
  STAKEHOLDER: 1.00,
  GENESIS:     1.10,
  LEGEND:      1.20,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface BadgeData {
  signalScore:     number;
  tier:            string;
  xSignalLevel:    number;
  telegramLevel:   number;
  discordLevel:    number;
  governanceLevel: number;
  isOG:            boolean;
  walletAddress:   string;
  username:        string;
  memberSince:     string;
  // Connected flags — account linked (not necessarily achievement earned)
  xConnected:          boolean;
  telegramConnected:   boolean;
  discordConnected:    boolean;
  governanceConnected: boolean;
}

// ─── Overlay helper ───────────────────────────────────────────────────────────

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
    position: 'absolute',
    left:     cfg.l != null ? `${cfg.l}%` : undefined,
    top:      cfg.t != null ? `${cfg.t}%` : undefined,
    right:    cfg.r != null ? `${cfg.r}%` : undefined,
    bottom:   cfg.b != null ? `${cfg.b}%` : undefined,
    width:    cfg.w != null ? `${cfg.w}%` : undefined,
    height:   cfg.h != null ? `${cfg.h}%` : undefined,
    outline:  debug ? `1px solid ${debugColor}` : undefined,
    ...style,
  };
  return <div style={s}>{children}</div>;
}

// ─── Badge card ──────────────────────────────────────────────────────────────

type TrackKey = keyof typeof achievementAssets;

function BadgeCard({ data, debug }: { data: BadgeData; debug: boolean }) {
  const tierSrc = tierAssets[data.tier] ?? tierAssets['INITIATE'];

  const displayIdentity = data.username
    ? data.username
    : data.walletAddress
      ? `${data.walletAddress.slice(0, 6)}···${data.walletAddress.slice(-4)}`
      : '—';

  // Track order must match ACH.tops index order
  const tracks: { key: TrackKey; level: number; connected: boolean }[] = [
    { key: 'xSignal',    level: data.xSignalLevel,    connected: data.xConnected          },
    { key: 'telegram',   level: data.telegramLevel,   connected: data.telegramConnected   },
    { key: 'governance', level: data.governanceLevel, connected: data.governanceConnected },
    { key: 'discord',    level: data.discordLevel,    connected: data.discordConnected    },
  ];

  return (
    <div style={{
      position:    'relative',
      width:       '100%',
      aspectRatio: '3 / 2',
      overflow:    'hidden',
      outline:     debug ? '2px solid red' : undefined,
    }}>

      {/* z=0 — Background */}
      <img
        src={specialAssets.cardBackground}
        alt=""
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 0 }}
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
          <img src={specialAssets.OG} alt="OG" draggable={false}
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
        </Slot>
      )}

      {/* z=5 — Tier name */}
      <Slot cfg={L.tierName} debug={debug} debugColor="#f0f" style={{ zIndex: 5, textAlign: 'center' }}>
        <div style={{
          color: C.tealLt, fontFamily: 'Rajdhani, Orbitron, monospace',
          fontSize: 'clamp(10px, 3.2%, 22px)', fontWeight: 700,
          letterSpacing: '0.2em', textShadow: `0 0 1.5% #5ED3EA88`,
          textTransform: 'uppercase', lineHeight: 1,
        }}>
          {data.tier}
        </div>
      </Slot>

      {/* z=5 — Username / identity value */}
      <Slot cfg={L.wallet} debug={debug} debugColor="#0f0" style={{
        zIndex: 5, display: 'flex', alignItems: 'center',
        paddingTop: '1.2%', paddingRight: '12%',
      }}>
        <span style={{
          color: C.tealLt, fontFamily: 'Rajdhani, monospace',
          fontSize: 'clamp(12px, 2.6%, 22px)', fontWeight: 600,
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
        }}>
          {displayIdentity}
        </span>
      </Slot>

      {/* z=5 — Signal score */}
      <Slot cfg={L.signal} debug={debug} debugColor="#ff0" style={{
        zIndex: 5, display: 'flex', alignItems: 'center', lineHeight: 1,
      }}>
        <span style={{
          color: C.tealLt, fontFamily: 'Rajdhani, Orbitron, monospace',
          fontSize: 'clamp(14px, 4.5%, 36px)', fontWeight: 700,
        }}>
          {data.signalScore.toLocaleString()}
        </span>
      </Slot>

      {/* z=3 — Achievement badge rows (cumulative)
           Each track gets its own horizontal row positioned after the baked-in label.
           Rules:
             not connected        → render nothing
             connected, level = 0 → render Tier 1 badge only (connected indicator)
             connected, level ≥ 1 → render badges Tier 1 through earned tier */}
      {tracks.map(({ key, level, connected }, i) => {
        const visibleCount = connected ? Math.max(1, level) : 0;
        if (visibleCount === 0) return null;
        const assets = achievementAssets[key];
        return (
          <Slot
            key={key}
            cfg={{ l: ACH.l, r: ACH.r, t: ACH.cy[i], h: ACH.h }}
            debug={debug}
            debugColor="#9f9"
            style={{ zIndex: 3, display: 'flex', alignItems: 'center', gap: ACH.gap, transform: 'translateY(-50%)' }}
          >
            {Array.from({ length: visibleCount }, (_, j) => (
              <img
                key={j}
                src={assets[(j + 1) as 1 | 2 | 3 | 4 | 5]}
                alt=""
                draggable={false}
                style={{ height: '88%', aspectRatio: '1', objectFit: 'contain', flexShrink: 0 }}
              />
            ))}
          </Slot>
        );
      })}
    </div>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

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
    xSignalLevel: 0, telegramLevel: 0, discordLevel: 0, governanceLevel: 0,
    isOG: false, walletAddress: '', username: 'Preview', memberSince: '2025-01',
    xConnected: false, telegramConnected: false, discordConnected: false, governanceConnected: false,
  },
  explorer: {
    signalScore: 150, tier: 'EXPLORER',
    xSignalLevel: 1, telegramLevel: 1, discordLevel: 0, governanceLevel: 1,
    isOG: false, walletAddress: '', username: 'Explorer', memberSince: '2025-03',
    xConnected: true, telegramConnected: true, discordConnected: false, governanceConnected: true,
  },
  // Matches spec acceptance test: X=3, Telegram=2, Governance=1, Discord=4
  builder: {
    signalScore: 380, tier: 'BUILDER',
    xSignalLevel: 3, telegramLevel: 2, discordLevel: 4, governanceLevel: 1,
    isOG: false, walletAddress: '', username: 'Builder', memberSince: '2025-04',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  stakeholder: {
    signalScore: 750, tier: 'STAKEHOLDER',
    xSignalLevel: 4, telegramLevel: 4, discordLevel: 4, governanceLevel: 4,
    isOG: false, walletAddress: '', username: 'Stakeholder', memberSince: '2025-06',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  genesis: {
    signalScore: 920, tier: 'GENESIS',
    xSignalLevel: 5, telegramLevel: 4, discordLevel: 4, governanceLevel: 5,
    isOG: true, walletAddress: '', username: 'Genesis', memberSince: '2024-11',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  legend: {
    signalScore: 1000, tier: 'LEGEND',
    xSignalLevel: 5, telegramLevel: 5, discordLevel: 5, governanceLevel: 5,
    isOG: true, walletAddress: '', username: 'Legend', memberSince: '2024-09',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  // Mixed state: X=5, Telegram=3, Governance=2, Discord=4
  mixed: {
    signalScore: 640, tier: 'STAKEHOLDER',
    xSignalLevel: 5, telegramLevel: 3, discordLevel: 4, governanceLevel: 2,
    isOG: false, walletAddress: '', username: 'Mixed', memberSince: '2025-05',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  // Connected at level 0 across all tracks (connected-but-not-yet-earned state)
  connected0: {
    signalScore: 0, tier: 'INITIATE',
    xSignalLevel: 0, telegramLevel: 0, discordLevel: 0, governanceLevel: 0,
    isOG: false, walletAddress: '', username: 'Connected', memberSince: '2026-09',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
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
      <div style={{ width: '100%', maxWidth: 700, margin: '0 auto' }}>
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
  minHeight: '100vh', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: '#001A27',
};
