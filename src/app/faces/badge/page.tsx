'use client';

/**
 * DUAL // SIGNAL — Badge Face Renderer
 *
 * PNG ASSET TRANSPARENCY STATUS (inspected 2026-09-04):
 *   Tier PNGs        → color_type=6 (RGBA) ✓ transparent backgrounds work
 *   Achievement PNGs → color_type=2 (RGB)  ✗ NO alpha channel
 *   OG PNG           → color_type=2 (RGB)  ✗ NO alpha channel
 *   Card background  → color_type=2 (RGB)  ✓ expected (opaque background)
 *
 * TODO: All achievement PNGs and og.png must be replaced with true RGBA PNGs.
 *       The grey/white square backgrounds are baked into the current pixels.
 *       Affected files (21 total):
 *         achievements/x/x-{1-5}-*.png
 *         achievements/telegram/telegram-{1-5}-*.png
 *         achievements/governance/governance-{1-5}-*.png
 *         achievements/holder-staking/holder-{1-5}-*.png
 *         special/og.png
 *       No CSS workaround is applied — replace the source files.
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { tierAssets, achievementAssets, specialAssets } from '@/lib/assets';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  navy:    '#002433',
  teal:    '#159DB8',
  electric:'#5ED3EA',
  gold:    '#F7C873',
  silver:  '#E5F0F8',
  dim:     '#4A7A8A',
} as const;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

const LEVEL_NAMES = {
  xSignal:       ['—', 'FIRST SIGNAL', 'SPARK', 'PULSE', 'WAVE', 'IMPACT'],
  telegram:      ['—', 'FIRST CONTACT', 'REGULAR', 'CONNECTED', 'CORE MEMBER', 'PILLAR'],
  governance:    ['—', 'FIRST VOTE', 'VOTER', 'PARTICIPANT', 'GOVERNOR', 'STEWARD'],
  holderStaking: ['—', 'HOLDER', 'COMMITTED', 'DEDICATED', 'BELIEVER', 'DIAMOND WINGS'],
} as const;

// Enable in dev to see layout zones
const DEBUG = false;

// ─── Badge data shape ─────────────────────────────────────────────────────────

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

// ─── Achievement row ──────────────────────────────────────────────────────────

function AchievementRow({
  src, trackName, levelNames, level,
}: {
  src:        string;
  trackName:  string;
  levelNames: readonly string[];
  level:      number;
}) {
  const active    = level > 0;
  const levelName = levelNames[level] ?? levelNames[0];

  return (
    <div style={{
      display:       'grid',
      gridTemplateColumns: '60px 1fr auto',
      alignItems:    'center',
      gap:           10,
      minHeight:     64,
      opacity:       active ? 1 : 0.28,
      outline:       DEBUG ? '1px dashed lime' : undefined,
    }}>
      {/* Achievement icon — 60px; note: PNGs currently lack alpha, see TODO above */}
      <img
        src={src}
        alt={trackName}
        draggable={false}
        style={{
          width:      60,
          height:     60,
          objectFit:  'contain',
          display:    'block',
          background: 'transparent',
          filter:     active ? 'drop-shadow(0 0 6px #5ED3EA66)' : 'none',
        }}
      />

      {/* Track name + level subtitle */}
      <div>
        <div style={{
          color:       C.silver,
          fontFamily:  'Orbitron, monospace',
          fontSize:    8,
          fontWeight:  700,
          letterSpacing: 1,
        }}>
          {trackName}
        </div>
        <div style={{
          color:       active ? C.teal : C.dim,
          fontFamily:  'Orbitron, monospace',
          fontSize:    6.5,
          letterSpacing: 0.5,
          marginTop:   2,
        }}>
          {levelName}
        </div>
      </div>

      {/* Roman numeral level */}
      <div style={{
        color:       active ? C.electric : C.dim,
        fontFamily:  'Orbitron, monospace',
        fontSize:    11,
        fontWeight:  900,
        letterSpacing: 1,
        minWidth:    20,
        textAlign:   'right',
      }}>
        {active ? ROMAN[level] : '—'}
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function BadgeCard({ data }: { data: BadgeData }) {
  const tierSrc = tierAssets[data.tier] ?? tierAssets['INITIATE'];

  // Pick the icon for the CURRENT level; fall back to level-1 icon when locked
  const xLevel  = data.xSignalLevel;
  const tgLevel = data.telegramLevel;
  const govLevel = data.governanceLevel;
  const hldLevel = data.holderLevel;

  const xSrc   = achievementAssets.xSignal[(Math.max(1, xLevel))   as keyof typeof achievementAssets.xSignal];
  const tgSrc  = achievementAssets.telegram[(Math.max(1, tgLevel))  as keyof typeof achievementAssets.telegram];
  const govSrc = achievementAssets.governance[(Math.max(1, govLevel)) as keyof typeof achievementAssets.governance];
  const hldSrc = achievementAssets.holderStaking[(Math.max(1, hldLevel)) as keyof typeof achievementAssets.holderStaking];

  const shortWallet   = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}···${data.walletAddress.slice(-4)}`
    : '';
  const scorePercent  = Math.min(100, (data.signalScore / 1000) * 100);

  return (
    <div style={{
      position:  'relative',
      width:     520,
      margin:    '0 auto',
      userSelect:'none',
      outline:   DEBUG ? '2px solid red' : undefined,
    }}>

      {/* Card background — drives aspect ratio (1536×1024 → 3:2) */}
      <img
        src={specialAssets.cardBackground}
        alt=""
        draggable={false}
        style={{ width: '100%', display: 'block', borderRadius: 16 }}
      />

      {/* ── Tier art zone: left 3–54%, top 8–82% ── */}
      <div style={{
        position:       'absolute',
        left:           '3%',
        top:            '8%',
        width:          '51%',
        height:         '74%',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        outline:        DEBUG ? '2px dashed cyan' : undefined,
      }}>
        <img
          src={tierSrc}
          alt={data.tier}
          draggable={false}
          style={{
            width:     '100%',
            height:    '100%',
            objectFit: 'contain',
            filter:    'drop-shadow(0 0 22px #5ED3EA55)',
          }}
        />

        {/* OG prestige pin — top-right of art zone, does not obscure butterfly */}
        {data.isOG && (
          <img
            src={specialAssets.OG}
            alt="OG"
            draggable={false}
            style={{
              position:  'absolute',
              top:       0,
              right:     0,
              width:     '20%',
              height:    'auto',
              objectFit: 'contain',
              /* TODO: og.png also lacks alpha — replace with RGBA asset */
            }}
          />
        )}
      </div>

      {/* ── Stats panel: right side, 54–96%, top 8% ── */}
      <div style={{
        position:      'absolute',
        left:          '55%',
        top:           '8%',
        right:         '3%',
        bottom:        '18%',
        display:       'flex',
        flexDirection: 'column',
        justifyContent:'center',
        gap:           8,
        outline:       DEBUG ? '2px dashed orange' : undefined,
      }}>

        {/* Wordmark */}
        <div style={{
          color:       C.teal,
          fontFamily:  'Orbitron, monospace',
          fontSize:    8,
          fontWeight:  700,
          letterSpacing: 2.5,
        }}>
          DUAL // SIGNAL
        </div>

        {/* Wallet */}
        <div>
          <div style={{ color: C.dim, fontFamily: 'Orbitron, monospace', fontSize: 6, letterSpacing: 1.5 }}>
            WALLET
          </div>
          <div style={{ color: C.silver, fontFamily: 'monospace', fontSize: 8.5, marginTop: 2 }}>
            {shortWallet || '—'}
          </div>
        </div>

        {/* Signal score */}
        <div>
          <div style={{ color: C.dim, fontFamily: 'Orbitron, monospace', fontSize: 6, letterSpacing: 1.5 }}>
            SIGNAL
          </div>
          <div style={{ fontFamily: 'Orbitron, monospace', fontWeight: 900, lineHeight: 1, marginTop: 2 }}>
            <span style={{ color: C.electric, fontSize: 19 }}>{data.signalScore.toLocaleString()}</span>
            <span style={{ color: C.dim, fontSize: 9, fontWeight: 400 }}> / 1,000</span>
          </div>
          <div style={{ marginTop: 5, height: 3, background: '#0d2535', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${scorePercent}%`,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${C.teal}, ${C.electric})`,
            }} />
          </div>
        </div>

        {/* Achievement rows */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           0,
          marginTop:     2,
          outline:       DEBUG ? '1px dashed yellow' : undefined,
        }}>
          <AchievementRow src={xSrc}   trackName="X SIGNAL"        levelNames={LEVEL_NAMES.xSignal}       level={xLevel} />
          <AchievementRow src={tgSrc}  trackName="TELEGRAM"         levelNames={LEVEL_NAMES.telegram}      level={tgLevel} />
          <AchievementRow src={govSrc} trackName="GOVERNANCE"       levelNames={LEVEL_NAMES.governance}    level={govLevel} />
          <AchievementRow src={hldSrc} trackName="HOLDER / STAKING" levelNames={LEVEL_NAMES.holderStaking} level={hldLevel} />
        </div>
      </div>

      {/* ── Tier label: bottom center ── */}
      <div style={{
        position:  'absolute',
        bottom:    '3%',
        left:      0,
        right:     0,
        textAlign: 'center',
        outline:   DEBUG ? '1px dashed magenta' : undefined,
      }}>
        <div style={{
          color:        C.electric,
          fontFamily:   'Orbitron, monospace',
          fontSize:     16,
          fontWeight:   900,
          letterSpacing: 6,
          textShadow:   `0 0 14px ${C.electric}77`,
        }}>
          {data.tier}
        </div>
        <div style={{
          color:        C.teal,
          fontFamily:   'Orbitron, monospace',
          fontSize:     6,
          letterSpacing: 3,
          marginTop:    2,
        }}>
          COMMUNITY IDENTITY PASSPORT
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={pageStyle}>
      <div style={{ color: C.electric, fontFamily: 'Orbitron, monospace', fontSize: 13, letterSpacing: 3 }}>
        LOADING...
      </div>
    </div>
  );
}

// ─── Page inner ───────────────────────────────────────────────────────────────

function BadgeFaceInner() {
  const params       = useSearchParams();
  const dualObjectId = params.get('id');

  const [data, setData]       = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(!!dualObjectId);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!dualObjectId) { setLoading(false); return; }

    fetch(`/api/faces/${dualObjectId}`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((d: BadgeData) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [dualObjectId]);

  if (loading) return <LoadingState />;

  if (error || !data) {
    return (
      <div style={pageStyle}>
        <div style={{ color: C.teal, fontFamily: 'Orbitron, monospace', fontSize: 11, letterSpacing: 2 }}>
          BADGE NOT FOUND
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; } body { margin: 0; background: ${C.navy}; }`}</style>
      <BadgeCard data={data} />
    </div>
  );
}

// ─── Exported page ────────────────────────────────────────────────────────────

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
  background:     C.navy,
  padding:        '24px',
};
