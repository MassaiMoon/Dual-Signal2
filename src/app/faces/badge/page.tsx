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

// ─── Track level display names ─────────────────────────────────────────────────

const LEVEL_NAMES = {
  xSignal:       ['—', 'FIRST SIGNAL', 'SPARK', 'PULSE', 'WAVE', 'IMPACT'],
  telegram:      ['—', 'FIRST CONTACT', 'REGULAR', 'CONNECTED', 'CORE MEMBER', 'PILLAR'],
  governance:    ['—', 'FIRST VOTE', 'VOTER', 'PARTICIPANT', 'GOVERNOR', 'STEWARD'],
  holderStaking: ['—', 'HOLDER', 'COMMITTED', 'DEDICATED', 'BELIEVER', 'DIAMOND WINGS'],
} as const;

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

// ─── Achievement emblem using PNG ─────────────────────────────────────────────

function TrackEmblem({
  src, label, sublabel, level, active,
}: {
  src:      string;
  label:    string;
  sublabel: string;
  level:    number;
  active:   boolean;
}) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           4,
      opacity:       active ? 1 : 0.22,
      transition:    'opacity 0.3s',
    }}>
      <img src={src} alt={label} width={52} height={52}
        style={{ objectFit: 'contain', filter: active ? 'drop-shadow(0 0 6px #5ED3EA88)' : 'none' }} />
      <span style={{ color: active ? C.electric : C.dim, fontSize: 7, fontFamily: 'Orbitron, monospace',
        fontWeight: 700, letterSpacing: 0.8, textAlign: 'center', lineHeight: 1.2, maxWidth: 58 }}>
        {active ? sublabel : label}
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

  return (
    <div style={{ position: 'relative', width: 360, margin: '0 auto', userSelect: 'none' }}>

      {/* Layer 1: Card background */}
      <img
        src={specialAssets.cardBackground}
        alt=""
        draggable={false}
        style={{ width: '100%', display: 'block', borderRadius: 16 }}
      />

      {/* Layer 2–5: overlays */}
      <div style={{
        position: 'absolute', inset: 0,
        display:  'flex', flexDirection: 'column',
        padding:  '18px 20px 16px',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: C.electric, fontFamily: 'Orbitron, monospace', fontSize: 10,
            fontWeight: 700, letterSpacing: 2 }}>DUAL // SIGNAL</span>
          {data.memberSince && (
            <span style={{ color: C.dim, fontFamily: 'monospace', fontSize: 8 }}>
              SINCE {data.memberSince}
            </span>
          )}
        </div>

        {/* Tier butterfly */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', marginTop: 8 }}>
          <img
            src={tierSrc}
            alt={data.tier}
            draggable={false}
            style={{
              width:  220, height: 220,
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 24px #5ED3EA66)',
            }}
          />

          {/* OG emblem — top-right corner of butterfly */}
          {data.isOG && (
            <img
              src={specialAssets.OG}
              alt="OG"
              draggable={false}
              style={{
                position: 'absolute', top: 0, right: 10,
                width: 48, height: 48,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 8px #F7C87388)',
              }}
            />
          )}
        </div>

        {/* Tier name + Signal Score */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ color: C.electric, fontFamily: 'Orbitron, monospace', fontSize: 18,
            fontWeight: 900, letterSpacing: 4 }}>
            {data.tier}
          </div>
          <div style={{ color: C.gold, fontFamily: 'Orbitron, monospace', fontSize: 11,
            fontWeight: 700, letterSpacing: 2, marginTop: 2 }}>
            ⚡ {data.signalScore} <span style={{ color: C.dim, fontWeight: 400 }}>/ 1000 SIGNAL</span>
          </div>
        </div>

        {/* Achievement track emblems */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
          marginBottom: 10 }}>
          <TrackEmblem src={xSrc}   label="X"          sublabel={LEVEL_NAMES.xSignal[data.xSignalLevel]}
            level={data.xSignalLevel}   active={data.xSignalLevel > 0} />
          <TrackEmblem src={tgSrc}  label="TELEGRAM"   sublabel={LEVEL_NAMES.telegram[data.telegramLevel]}
            level={data.telegramLevel}  active={data.telegramLevel > 0} />
          <TrackEmblem src={govSrc} label="GOVERNANCE" sublabel={LEVEL_NAMES.governance[data.governanceLevel]}
            level={data.governanceLevel} active={data.governanceLevel > 0} />
          <TrackEmblem src={hldSrc} label="HOLDER"     sublabel={LEVEL_NAMES.holderStaking[data.holderLevel]}
            level={data.holderLevel}    active={data.holderLevel > 0} />
        </div>

        {/* Footer: wallet */}
        {shortWallet && (
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: C.dim, fontFamily: 'monospace', fontSize: 8, letterSpacing: 1 }}>
              {shortWallet}
            </span>
          </div>
        )}
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
  const params      = useSearchParams();
  const dualObjectId = params.get('id');

  const [data, setData]   = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(!!dualObjectId);
  const [error, setError]   = useState(false);

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
