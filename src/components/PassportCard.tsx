/**
 * PassportCard — renders a DUAL // SIGNAL Passport (3:2) from badge state.
 *
 * Background (1536×1024) already contains all static UI chrome; this component
 * only overlays dynamic state. Shared by the badge face (/faces/badge) and the
 * tier-evolution demo on /join.
 */

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
  // Genesis and OG prestige pins — bottom-left of tier art, in the two red-circle slots
  genesis:  { l: 11, t: 64, w: 9.5, h: 16 },
  og:       { l: 42.25, t: 64, w: 9.5, h: 16 },
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
  l:  71,
  r:  8,
  h:  7.5,
  cy: [56, 62.5, 69.5, 75.5] as const,
  gap: '0%',
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

export interface BadgeData {
  signalScore:     number;
  tier:            string;
  xSignalLevel:    number;
  telegramLevel:   number;
  discordLevel:    number;
  governanceLevel: number;
  isOG:            boolean;
  isGenesis:       boolean;
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

export function BadgeCard({ data, debug }: { data: BadgeData; debug?: boolean }) {
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

      {/* z=4 — Genesis prestige pin (left slot) */}
      {data.isGenesis && (
        <Slot cfg={L.genesis} debug={debug} debugColor="#f7c" style={{ zIndex: 4, opacity: 0.8 }}>
          <img src={specialAssets.GENESIS} alt="" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </Slot>
      )}

      {/* z=4 — OG prestige pin (right slot) */}
      {data.isOG && (
        <Slot cfg={L.og} debug={debug} debugColor="#fa0" style={{ zIndex: 4, opacity: 0.8 }}>
          <img src={specialAssets.OG} alt="" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </Slot>
      )}

      {/* z=5 — Tier name */}
      <Slot cfg={L.tierName} debug={debug} debugColor="#f0f" style={{ zIndex: 5, textAlign: 'center' }}>
        <div style={{
          color: C.tealLt, fontFamily: 'var(--font-rajdhani), Rajdhani, Orbitron, monospace',
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
          color: C.tealLt, fontFamily: 'var(--font-rajdhani), Rajdhani, monospace',
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
          color: C.tealLt, fontFamily: 'var(--font-rajdhani), Rajdhani, Orbitron, monospace',
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
