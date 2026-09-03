'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── Design tokens ────────────────────────────────────────────────────────────

const COLORS = {
  navy:    '#002433',
  teal:    '#159DB8',
  electric:'#5ED3EA',
  darkTeal:'#170E1C',
  midnight:'#140E1C',
  silver:  '#E5F0F8',
  gold:    '#F7C873',
  purple:  '#BB5CF8',
  white:   '#F4FAF9',
} as const;

type Tier = 'INITIATE' | 'EXPLORER' | 'CONTRIBUTOR' | 'BUILDER' | 'VALIDATOR';

interface BadgeConfig {
  frameColor:  string;
  glowColor:   string;
  glowRadius:  number;
  auraOpacity: number;
  label:       string;
}

const TIER_CONFIG: Record<Tier, BadgeConfig> = {
  INITIATE:    { frameColor: COLORS.teal,    glowColor: COLORS.teal,    glowRadius: 20, auraOpacity: 0.3,  label: 'INITIATE'    },
  EXPLORER:    { frameColor: COLORS.electric,glowColor: COLORS.electric,glowRadius: 30, auraOpacity: 0.45, label: 'EXPLORER'    },
  CONTRIBUTOR: { frameColor: COLORS.electric,glowColor: COLORS.electric,glowRadius: 35, auraOpacity: 0.5,  label: 'CONTRIBUTOR' },
  BUILDER:     { frameColor: COLORS.electric,glowColor: COLORS.electric,glowRadius: 45, auraOpacity: 0.6,  label: 'BUILDER'     },
  VALIDATOR:   { frameColor: COLORS.purple,  glowColor: COLORS.purple,  glowRadius: 60, auraOpacity: 0.75, label: 'VALIDATOR'   },
};

function getBadgeImage(tier: Tier, isGenesis: boolean, isStakeholder: boolean): string {
  if (isGenesis)    return '/badges/genesis.png';
  if (isStakeholder) return '/badges/stakeholder.png';
  if (tier === 'VALIDATOR')                      return '/badges/legend.png';
  if (tier === 'BUILDER' || tier === 'CONTRIBUTOR') return '/badges/builder.png';
  if (tier === 'EXPLORER')                       return '/badges/explorer.png';
  return '/badges/initiate.png';
}

const ACHIEVEMENT_LABELS: Record<string, string> = {
  FIRST_SIGNAL: 'FIRST SIGNAL',
  AMPLIFIER_I:  'AMPLIFIER I',
  AMPLIFIER_II: 'AMPLIFIER II',
  BROADCASTER:  'BROADCASTER',
};

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

// ─── Aura glow layer ──────────────────────────────────────────────────────────

function Aura({ cx, cy, color, opacity }: { cx: number; cy: number; color: string; opacity: number }) {
  return (
    <g>
      <radialGradient id="aura-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={color} stopOpacity={opacity * 0.6} />
        <stop offset="60%" stopColor={color} stopOpacity={opacity * 0.15} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </radialGradient>
      <ellipse cx={cx} cy={cy} rx={160} ry={160} fill="url(#aura-grad)" />
    </g>
  );
}

// ─── Genesis particles ────────────────────────────────────────────────────────

function GenesisParticles({ cx, cy }: { cx: number; cy: number }) {
  const particles = [
    { x: -110, y: -60, r: 2.5 }, { x: 115, y: -50, r: 2 },
    { x: -95, y: 70,  r: 3   }, { x: 100, y: 75,  r: 2.5 },
    { x: -60, y: -115,r: 2   }, { x: 65,  y: -110,r: 1.5 },
    { x: -130,y: 15,  r: 1.5 }, { x: 135, y: 20,  r: 2   },
    { x: -40, y: 120, r: 2   }, { x: 45,  y: 118, r: 1.5 },
  ];
  return (
    <g>
      {particles.map((p, i) => (
        <circle key={i} cx={cx + p.x} cy={cy + p.y} r={p.r}
          fill={COLORS.gold} opacity={0.6 + (i % 3) * 0.1}>
          <animate attributeName="opacity" values="0.4;0.9;0.4"
            dur={`${2 + (i % 4) * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* Crystalline lines */}
      <line x1={cx - 110} y1={cy - 60} x2={cx - 95} y2={cy + 70}
        stroke={COLORS.gold} strokeWidth="0.5" opacity={0.2} />
      <line x1={cx + 115} y1={cy - 50} x2={cx + 100} y2={cy + 75}
        stroke={COLORS.gold} strokeWidth="0.5" opacity={0.2} />
    </g>
  );
}

// ─── Achievement emblem ───────────────────────────────────────────────────────

function AchievementEmblem({ x, y, label, active }: { x: number; y: number; label: string; active: boolean }) {
  const pts = hexPoints(x, y, 22);
  return (
    <g opacity={active ? 1 : 0.2}>
      <polygon points={pts} fill={active ? 'rgba(21,157,184,0.15)' : 'rgba(21,157,184,0.05)'}
        stroke={active ? COLORS.teal : '#2a4a56'} strokeWidth="1.5" />
      <text x={x} y={y + 4} textAnchor="middle" fill={active ? COLORS.electric : '#2a5a6a'}
        fontSize="7" fontFamily="'Orbitron', monospace" fontWeight="600" letterSpacing="0">
        {label.split(' ').map((w, i, arr) => (
          <tspan key={i} x={x} dy={i === 0 ? (arr.length > 1 ? -5 : 0) : 11}>{w}</tspan>
        ))}
      </text>
    </g>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g>
      <rect x={x - 32} y={y - 10} width={64} height={20} rx={10}
        fill={`${color}22`} stroke={color} strokeWidth="1" />
      <text x={x} y={y + 4} textAnchor="middle" fill={color}
        fontSize="8" fontFamily="'Orbitron', monospace" fontWeight="700" letterSpacing="1">
        {label}
      </text>
    </g>
  );
}

// ─── Main badge SVG ───────────────────────────────────────────────────────────

function BadgeSVG({
  tier, isGenesis, isStakeholder, isGovernor, signalCount, achievementLevel, walletAddress, memberSince,
}: {
  tier:             Tier;
  isGenesis:        boolean;
  isStakeholder:    boolean;
  isGovernor:       boolean;
  signalCount:      number;
  achievementLevel: string;
  walletAddress:    string;
  memberSince:      string;
}) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.INITIATE;
  const W = 360, H = 480;
  const cx = W / 2, cy = 200;
  const imgSize = 240;

  const badgeImage = getBadgeImage(tier, isGenesis, isStakeholder);

  const unlocked = (level: string) => {
    const order = ['', 'FIRST_SIGNAL', 'AMPLIFIER_I', 'AMPLIFIER_II', 'BROADCASTER'];
    return order.indexOf(achievementLevel) >= order.indexOf(level);
  };

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'No wallet';

  const badgeLevel = isGenesis ? 'GENESIS' : isStakeholder ? 'STAKEHOLDER'
    : tier === 'VALIDATOR' ? 'RARE' : tier === 'BUILDER' ? 'UNCOMMON' : 'COMMON';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block', margin: '0 auto' }}>

      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0D3A4A" strokeWidth="0.5" />
        </pattern>
        <filter id="glow-filter">
          <feGaussianBlur stdDeviation={cfg.glowRadius / 6} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width={W} height={H} fill={COLORS.navy} rx="12" />
      <rect width={W} height={H} fill="url(#grid)" rx="12" />

      {/* Top brand strip */}
      <text x="16" y="24" fill={COLORS.electric} fontSize="10"
        fontFamily="'Orbitron', monospace" fontWeight="700" letterSpacing="2">
        DUAL // SIGNAL
      </text>
      <line x1="0" y1="34" x2={W} y2="34" stroke={COLORS.teal} strokeWidth="0.5" opacity={0.3} />

      {/* Aura */}
      <Aura cx={cx} cy={cy} color={cfg.glowColor} opacity={cfg.auraOpacity} />

      {/* Genesis particles */}
      {isGenesis && <GenesisParticles cx={cx} cy={cy} />}

      {/* Badge image */}
      <image
        href={badgeImage}
        x={cx - imgSize / 2}
        y={cy - imgSize / 2}
        width={imgSize}
        height={imgSize}
        preserveAspectRatio="xMidYMid meet"
        filter="url(#glow-filter)"
      />

      {/* Governor crown */}
      {isGovernor && (
        <text x={cx} y={cy - imgSize / 2 - 10} textAnchor="middle"
          fill={COLORS.gold} fontSize="20">♔</text>
      )}

      {/* Identity label */}
      <text x={cx} y={cy + imgSize / 2 + 24} textAnchor="middle"
        fill={cfg.frameColor} fontSize="14" fontFamily="'Orbitron', monospace"
        fontWeight="900" letterSpacing="4">
        {cfg.label}
      </text>

      {/* Status chips */}
      <g transform={`translate(${cx}, ${cy + imgSize / 2 + 46})`}>
        {isGenesis && isStakeholder ? (
          <>
            <StatusChip x={-36} y={0} label="GENESIS" color={COLORS.gold} />
            <StatusChip x={36} y={0} label="STAKER" color={COLORS.electric} />
          </>
        ) : isGenesis ? (
          <StatusChip x={0} y={0} label="GENESIS" color={COLORS.gold} />
        ) : isStakeholder ? (
          <StatusChip x={0} y={0} label="STAKEHOLDER" color={COLORS.electric} />
        ) : null}
      </g>

      {/* Achievement emblems row */}
      <g transform={`translate(${cx}, ${cy + imgSize / 2 + 80})`}>
        <AchievementEmblem x={-108} y={0} label="1ST SIGNAL" active={unlocked('FIRST_SIGNAL')} />
        <AchievementEmblem x={-54}  y={0} label="AMP I"      active={unlocked('AMPLIFIER_I')} />
        <AchievementEmblem x={0}    y={0} label="AMP II"     active={unlocked('AMPLIFIER_II')} />
        <AchievementEmblem x={54}   y={0} label="BROAD"      active={unlocked('BROADCASTER')} />
        {isStakeholder && (
          <AchievementEmblem x={108} y={0} label="STAKER" active={true} />
        )}
      </g>

      {/* Metadata strip */}
      <rect x={0} y={H - 54} width={W} height={54} fill={COLORS.midnight} rx="0" />
      <rect x={0} y={H - 54} width={W} height={54} rx="0"
        style={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} />
      <line x1={0} y1={H - 54} x2={W} y2={H - 54} stroke={cfg.frameColor} strokeWidth="0.8" opacity={0.5} />

      {/* Strip: brand / wallet / level */}
      <text x={12} y={H - 34} fill={COLORS.electric} fontSize="8"
        fontFamily="'Orbitron', monospace" fontWeight="700" letterSpacing="1">
        DUAL // SIGNAL
      </text>
      <text x={cx} y={H - 34} textAnchor="middle" fill={COLORS.silver} fontSize="8"
        fontFamily="monospace" opacity={0.7}>
        {shortWallet}
      </text>
      <text x={W - 12} y={H - 34} textAnchor="end" fill={cfg.frameColor} fontSize="8"
        fontFamily="'Orbitron', monospace" fontWeight="700" letterSpacing="1">
        {badgeLevel}
      </text>

      {/* Strip row 2: signal count / member since */}
      <text x={12} y={H - 16} fill={COLORS.teal} fontSize="7.5" fontFamily="monospace" opacity={0.8}>
        ⚡ {signalCount} signals
      </text>
      {memberSince && (
        <text x={W - 12} y={H - 16} textAnchor="end" fill={COLORS.silver} fontSize="7.5"
          fontFamily="monospace" opacity={0.6}>
          SINCE {memberSince}
        </text>
      )}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ObjectData {
  custom?: {
    identity_tier?:    string;
    is_genesis?:       string;
    is_stakeholder?:   string;
    is_governor?:      string;
    signal_count?:     string;
    achievement_level?:string;
    wallet_address?:   string;
    member_since?:     string;
    discord_handle?:   string;
  };
  metadata?: { name?: string };
}

export default function BadgeFacePage() {
  const params = useSearchParams();
  const objectId = params.get('id');

  const [data, setData] = useState<ObjectData | null>(null);
  const [loading, setLoading] = useState(!!objectId);

  useEffect(() => {
    if (!objectId) return;
    fetch(`https://api.dual.network/public/objects/${objectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [objectId]);

  const custom = data?.custom ?? {};

  const tier       = (custom.identity_tier as Tier | undefined) ?? 'INITIATE';
  const isGenesis  = custom.is_genesis     === 'true';
  const isStaker   = custom.is_stakeholder === 'true';
  const isGovernor = custom.is_governor    === 'true';
  const signals    = parseInt(custom.signal_count ?? '0', 10);
  const achLevel   = custom.achievement_level ?? '';
  const wallet     = custom.wallet_address    ?? '';
  const since      = custom.member_since      ?? '';

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: COLORS.electric, fontFamily: 'Orbitron, monospace', fontSize: 13, letterSpacing: 3 }}>
          LOADING...
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulse-aura {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;   }
        }
        body { margin: 0; background: ${COLORS.navy}; }
      `}</style>
      <BadgeSVG
        tier={tier}
        isGenesis={isGenesis}
        isStakeholder={isStaker}
        isGovernor={isGovernor}
        signalCount={signals}
        achievementLevel={achLevel}
        walletAddress={wallet}
        memberSince={since}
      />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight:      '100vh',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     COLORS.navy,
  padding:        '24px',
};
