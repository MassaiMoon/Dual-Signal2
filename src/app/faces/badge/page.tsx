'use client';

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

// ─── Track row (right panel) ─────────────────────────────────────────────────

function TrackRow({ src, label, level, gold }: {
  src:   string;
  label: string;
  level: number;
  gold?: boolean;
}) {
  const active = level > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: active ? 1 : 0.28 }}>
      <img src={src} alt={label}
        style={{
          width: 28, height: 28,
          objectFit: 'contain',
          display: 'block',
          background: 'transparent',
          filter: active
            ? gold ? 'drop-shadow(0 0 5px #F7C87399)' : 'drop-shadow(0 0 5px #5ED3EA88)'
            : 'none',
        }} />
      <span style={{ flex: 1, color: gold ? C.gold : C.silver, fontFamily: 'Orbitron, monospace',
        fontSize: 7.5, letterSpacing: 0.6, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: active ? (gold ? C.gold : C.electric) : C.dim,
        fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>
        {active ? (gold ? 'YES' : ROMAN[level]) : '—'}
      </span>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function BadgeCard({ data }: { data: BadgeData }) {
  const tierSrc = tierAssets[data.tier] ?? tierAssets['INITIATE'];

  const xSrc   = achievementAssets.xSignal[Math.max(1, data.xSignalLevel) as keyof typeof achievementAssets.xSignal];
  const tgSrc  = achievementAssets.telegram[Math.max(1, data.telegramLevel) as keyof typeof achievementAssets.telegram];
  const govSrc = achievementAssets.governance[Math.max(1, data.governanceLevel) as keyof typeof achievementAssets.governance];
  const hldSrc = achievementAssets.holderStaking[Math.max(1, data.holderLevel) as keyof typeof achievementAssets.holderStaking];

  const shortWallet = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}···${data.walletAddress.slice(-4)}`
    : '';

  const scorePercent = Math.min(100, (data.signalScore / 1000) * 100);

  return (
    <div style={{ position: 'relative', width: 520, margin: '0 auto', userSelect: 'none' }}>

      {/* Layer 1: Card background */}
      <img
        src={specialAssets.cardBackground}
        alt=""
        draggable={false}
        style={{ width: '100%', display: 'block', borderRadius: 16 }}
      />

      {/* Layer 2: Two-column overlay + bottom bar */}
      <div style={{
        position:      'absolute',
        inset:         0,
        borderRadius:  16,
        display:       'flex',
        flexDirection: 'column',
      }}>

        {/* ── Top section: butterfly (left) + stats (right) ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left: butterfly — sits inside the circular frame of the card background */}
          <div style={{
            flex:           '0 0 62%',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            position:       'relative',
            paddingLeft:    24,
          }}>
            <img
              src={tierSrc}
              alt={data.tier}
              draggable={false}
              style={{
                width:     210,
                height:    210,
                objectFit: 'contain',
                filter:    'drop-shadow(0 0 28px #5ED3EA66)',
              }}
            />
            {data.isOG && (
              <img
                src={specialAssets.OG}
                alt="OG"
                draggable={false}
                style={{
                  position:  'absolute',
                  top:       12,
                  right:     8,
                  width:     40,
                  height:    40,
                  objectFit: 'contain',
                  filter:    'drop-shadow(0 0 8px #F7C87388)',
                }}
              />
            )}
          </div>

          {/* Right: stats panel */}
          <div style={{
            flex:          1,
            display:       'flex',
            flexDirection: 'column',
            justifyContent:'center',
            gap:           10,
            padding:       '20px 22px 12px 0',
          }}>

            {/* DUAL // SIGNAL wordmark */}
            <div style={{ color: C.teal, fontFamily: 'Orbitron, monospace', fontSize: 8,
              fontWeight: 700, letterSpacing: 2.5, marginBottom: -2 }}>
              DUAL // SIGNAL
            </div>

            {/* Wallet */}
            <div>
              <div style={{ color: C.dim, fontFamily: 'Orbitron, monospace', fontSize: 6.5, letterSpacing: 1.5 }}>WALLET</div>
              <div style={{ color: C.silver, fontFamily: 'monospace', fontSize: 9, marginTop: 2, letterSpacing: 0.5 }}>
                {shortWallet || '—'}
              </div>
            </div>

            {/* Signal score */}
            <div>
              <div style={{ color: C.dim, fontFamily: 'Orbitron, monospace', fontSize: 6.5, letterSpacing: 1.5 }}>SIGNAL</div>
              <div style={{ marginTop: 2, fontFamily: 'Orbitron, monospace', fontWeight: 900, lineHeight: 1 }}>
                <span style={{ color: C.electric, fontSize: 22 }}>
                  {data.signalScore.toLocaleString()}
                </span>
                <span style={{ color: C.dim, fontSize: 10, fontWeight: 400 }}> / 1,000</span>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 5, height: 4, background: '#0d2535', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${scorePercent}%`, borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.teal}, ${C.electric})`,
                  transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {/* Track rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
              <TrackRow src={xSrc}   label="X SIGNAL"        level={data.xSignalLevel} />
              <TrackRow src={tgSrc}  label="TELEGRAM"         level={data.telegramLevel} />
              <TrackRow src={govSrc} label="GOVERNANCE"       level={data.governanceLevel} />
              <TrackRow src={hldSrc} label="HOLDER / STAKING" level={data.holderLevel} />
              {data.isOG && (
                <TrackRow src={specialAssets.OG} label="OG" level={1} gold />
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom bar: tier name ── */}
        <div style={{ textAlign: 'center', padding: '0 20px 14px', flexShrink: 0 }}>
          <div style={{ color: C.electric, fontFamily: 'Orbitron, monospace', fontSize: 17,
            fontWeight: 900, letterSpacing: 6, textShadow: `0 0 16px ${C.electric}88` }}>
            {data.tier}
          </div>
          <div style={{ color: C.teal, fontFamily: 'Orbitron, monospace', fontSize: 6.5,
            letterSpacing: 3, marginTop: 2 }}>
            COMMUNITY IDENTITY PASSPORT
          </div>
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

// ─── Page inner (uses search params) ─────────────────────────────────────────

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
      <style>{`body { margin: 0; background: ${C.navy}; }`}</style>
      <BadgeCard data={data} />
    </div>
  );
}

// ─── Exported page ─────────────────────────────────────────────────────────────

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
