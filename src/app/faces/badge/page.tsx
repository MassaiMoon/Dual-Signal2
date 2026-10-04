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
import { BadgeCard, type BadgeData } from '@/components/PassportCard';

// Card rendering lives in @/components/PassportCard.

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
    isOG: false, isGenesis: false, walletAddress: '', username: 'Preview', memberSince: '2025-01',
    xConnected: false, telegramConnected: false, discordConnected: false, governanceConnected: false,
  },
  explorer: {
    signalScore: 150, tier: 'EXPLORER',
    xSignalLevel: 1, telegramLevel: 1, discordLevel: 0, governanceLevel: 1,
    isOG: false, isGenesis: false, walletAddress: '', username: 'Explorer', memberSince: '2025-03',
    xConnected: true, telegramConnected: true, discordConnected: false, governanceConnected: true,
  },
  // Matches spec acceptance test: X=3, Telegram=2, Governance=1, Discord=4
  builder: {
    signalScore: 380, tier: 'BUILDER',
    xSignalLevel: 3, telegramLevel: 2, discordLevel: 4, governanceLevel: 1,
    isOG: false, isGenesis: false, walletAddress: '', username: 'Builder', memberSince: '2025-04',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  stakeholder: {
    signalScore: 750, tier: 'STAKEHOLDER',
    xSignalLevel: 4, telegramLevel: 4, discordLevel: 4, governanceLevel: 4,
    isOG: false, isGenesis: false, walletAddress: '', username: 'Stakeholder', memberSince: '2025-06',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  genesis: {
    signalScore: 920, tier: 'GENESIS',
    xSignalLevel: 5, telegramLevel: 4, discordLevel: 4, governanceLevel: 5,
    isOG: true, isGenesis: true, walletAddress: '', username: 'Genesis', memberSince: '2024-11',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  legend: {
    signalScore: 1000, tier: 'LEGEND',
    xSignalLevel: 5, telegramLevel: 5, discordLevel: 5, governanceLevel: 5,
    isOG: true, isGenesis: true, walletAddress: '', username: 'Legend', memberSince: '2024-09',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  // Mixed state: X=5, Telegram=3, Governance=2, Discord=4
  mixed: {
    signalScore: 640, tier: 'STAKEHOLDER',
    xSignalLevel: 5, telegramLevel: 3, discordLevel: 4, governanceLevel: 2,
    isOG: false, isGenesis: false, walletAddress: '', username: 'Mixed', memberSince: '2025-05',
    xConnected: true, telegramConnected: true, discordConnected: true, governanceConnected: true,
  },
  // Connected at level 0 across all tracks (connected-but-not-yet-earned state)
  connected0: {
    signalScore: 0, tier: 'INITIATE',
    xSignalLevel: 0, telegramLevel: 0, discordLevel: 0, governanceLevel: 0,
    isOG: false, isGenesis: false, walletAddress: '', username: 'Connected', memberSince: '2026-09',
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
