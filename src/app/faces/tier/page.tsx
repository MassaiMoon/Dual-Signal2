'use client';

/**
 * DUAL // SIGNAL — Tier Certificate Face
 *
 * ?id=<objectId> a minted certificate, read from DUAL
 * ?mock=<tier>  one sample certificate (e.g. ?mock=builder)
 * ?gallery=1    all six tiers stacked, for design review
 * ?embed=1      transparent page for iframing into the DUAL face
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TierCertificate, type TierCertificateData } from '@/components/TierCertificate';

const MOCKS: Record<string, TierCertificateData> = {
  initiate:    { tier: 'INITIATE',    username: 'Preview',    scoreAtAchievement: 0,   achievedAt: '2026-09-03', memberSince: '2026-09', serial: 12 },
  explorer:    { tier: 'EXPLORER',    username: 'Explorer',   scoreAtAchievement: 152, achievedAt: '2026-09-21', memberSince: '2026-09', serial: 7 },
  builder:     { tier: 'BUILDER',     username: 'Builder',    scoreAtAchievement: 356, achievedAt: '2026-10-02', memberSince: '2026-09', serial: 3 },
  stakeholder: { tier: 'STAKEHOLDER', username: 'Stakeholder', scoreAtAchievement: 551, achievedAt: '2026-10-09', memberSince: '2026-09', serial: 1 },
  genesis:     { tier: 'GENESIS',     username: 'Genesis',    scoreAtAchievement: 760, achievedAt: '2026-11-14', memberSince: '2026-09', serial: 1 },
  legend:      { tier: 'LEGEND',      username: 'Legend',     scoreAtAchievement: 904, achievedAt: '2026-12-31', memberSince: '2026-09', serial: 1 },
};

function TierFaceInner() {
  const params  = useSearchParams();
  const embed   = params.get('embed') === '1';
  const gallery = params.get('gallery') === '1';
  const mock    = MOCKS[params.get('mock') ?? ''];
  const id      = params.get('id');

  const [fetched, setFetched] = useState<TierCertificateData | null>(null);
  const [loading, setLoading] = useState(!!id && !mock && !gallery);

  useEffect(() => {
    if (!id || mock || gallery) return;
    fetch(`/api/tier-certificates/${encodeURIComponent(id)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: TierCertificateData | null) => setFetched(d))
      .catch(() => setFetched(null))
      .finally(() => setLoading(false));
  }, [id, mock, gallery]);

  const items = gallery ? Object.values(MOCKS) : mock ? [mock] : fetched ? [fetched] : [];

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${embed ? 'transparent' : '#040E1A'}; }
      `}</style>
      {loading ? (
        <div style={emptyStyle}>LOADING...</div>
      ) : items.length === 0 ? (
        <div style={emptyStyle}>CERTIFICATE NOT FOUND</div>
      ) : (
        <div style={{ width: '100%', maxWidth: 700, margin: '0 auto', display: 'grid', gap: gallery ? 32 : 0, padding: gallery ? '32px 16px' : 0 }}>
          {items.map(d => <TierCertificate key={d.tier} data={d} />)}
        </div>
      )}
    </>
  );
}

export default function TierFacePage() {
  return (
    <Suspense fallback={null}>
      <TierFaceInner />
    </Suspense>
  );
}

const emptyStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#159DB8', fontSize: 12, letterSpacing: 2, background: '#040E1A',
};
