/**
 * /leaderboard — Public DUAL // SIGNAL member ranking.
 *
 * Server Component — queries DB at request time, no client JS needed.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { achievementConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

// ── Meta ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'DUAL // SIGNAL Leaderboard',
  description: 'Ranked community members by SIGNAL score — the on-chain identity layer of the DUAL Network.',
  openGraph: {
    title:       'DUAL // SIGNAL Leaderboard',
    description: 'See who is building the DUAL community.',
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_ORDER = ['LEGEND', 'GENESIS', 'STAKEHOLDER', 'BUILDER', 'EXPLORER', 'INITIATE'] as const;
type Tier = typeof TIER_ORDER[number];

const TIER_COLOR: Record<Tier, string> = {
  LEGEND:      '#FFD700',
  GENESIS:     '#F7C873',
  STAKEHOLDER: '#A8EDF9',
  BUILDER:     '#7FE4F4',
  EXPLORER:    '#5ED3EA',
  INITIATE:    '#4A7A8A',
};

const TIER_BG: Record<Tier, string> = {
  LEGEND:      'rgba(255,215,0,0.07)',
  GENESIS:     'rgba(247,200,115,0.06)',
  STAKEHOLDER: 'rgba(168,237,249,0.05)',
  BUILDER:     'rgba(127,228,244,0.05)',
  EXPLORER:    'rgba(94,211,234,0.04)',
  INITIATE:    'rgba(74,122,138,0.03)',
};

const TIER_MIN: Record<Tier, number> = {
  LEGEND:      900,
  GENESIS:     750,
  STAKEHOLDER: 550,
  BUILDER:     350,
  EXPLORER:    150,
  INITIATE:    0,
};

const TRACK_ICON: Record<string, string> = {
  xSignal:    'X',
  telegram:   'TG',
  governance: 'GOV',
  discord:    'DC',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function short(wallet: string) {
  return wallet ? `${wallet.slice(0, 6)}···${wallet.slice(-4)}` : '—';
}

function progressBar(score: number, tier: Tier) {
  const min  = TIER_MIN[tier];
  const next = achievementConfig.butterflyTiers.find(t => t.minScore > min)?.minScore ?? achievementConfig.maxSignalScore;
  const pct  = Math.min(100, Math.round(((score - min) / (next - min)) * 100));
  return { pct, next };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const badges = await db.badge.findMany({
    orderBy: [{ signalScore: 'desc' }, { createdAt: 'asc' }],
    select: {
      id:              true,
      dualObjectId:    true,
      walletAddress:   true,
      cachedTier:      true,
      signalScore:     true,
      memberSince:     true,
      isOG:            true,
      xSignalLevel:    true,
      telegramLevel:   true,
      governanceLevel: true,
      discordLevel:    true,
    },
  });

  const totalMembers = badges.length;
  const topScore     = badges[0]?.signalScore ?? 0;
  const byTier       = TIER_ORDER.reduce<Record<string, number>>((acc, t) => {
    acc[t] = badges.filter(b => b.cachedTier === t).length;
    return acc;
  }, {});

  // Group into sections: non-INITIATE tiers first (if any), then INITIATE
  const tiersWithMembers = TIER_ORDER.filter(t => byTier[t] > 0);

  return (
    <main style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.eyebrow}>DUAL // SIGNAL</div>
        <h1 style={s.h1}>Community Leaderboard</h1>
        <p style={s.subtitle}>
          On-chain identity scores across {totalMembers} verified member{totalMembers !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Top stats */}
      <div style={s.statsRow}>
        <Stat label="Members"  value={String(totalMembers)} />
        <Stat label="Top SIGNAL" value={topScore.toLocaleString()} accent />
        {tiersWithMembers.slice(0, 4).map(t => (
          <Stat key={t} label={t} value={String(byTier[t])} color={TIER_COLOR[t]} />
        ))}
      </div>

      {/* Tier sections */}
      {tiersWithMembers.map(tier => {
        const members = badges.filter(b => b.cachedTier === tier);
        const color   = TIER_COLOR[tier];
        const nextMin = achievementConfig.butterflyTiers.find(t => t.minScore > TIER_MIN[tier])?.minScore;
        return (
          <section key={tier} style={{ marginBottom: 40 }}>
            {/* Tier heading */}
            <div style={{ ...s.tierHeading, borderColor: color + '30', background: TIER_BG[tier] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color, fontSize: 13, fontWeight: 700, letterSpacing: 4 }}>{tier}</span>
                <span style={{ color: color + '80', fontSize: 11 }}>
                  {TIER_MIN[tier].toLocaleString()}
                  {nextMin ? `–${nextMin.toLocaleString()}` : '+'} SIGNAL
                </span>
              </div>
              <span style={{ color: color + '60', fontSize: 12 }}>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Member rows */}
            <div style={s.memberList}>
              {members.map((b, idx) => {
                const globalRank = badges.indexOf(b) + 1;
                const tier_      = b.cachedTier as Tier;
                const { pct, next } = progressBar(b.signalScore, tier_);
                return (
                  <Link
                    key={b.id}
                    href={`/badge/${b.dualObjectId}`}
                    style={s.memberRow}
                  >
                    {/* Rank */}
                    <div style={s.rank}>
                      {globalRank <= 3
                        ? <span style={{ fontSize: 16 }}>{['🥇','🥈','🥉'][globalRank - 1]}</span>
                        : <span style={{ color: '#3A6070', fontSize: 13 }}>#{globalRank}</span>
                      }
                    </div>

                    {/* Identity */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={s.wallet}>{short(b.walletAddress)}</span>
                        {b.isOG && <span style={s.ogPill}>OG</span>}
                        {b.memberSince && (
                          <span style={s.since}>since {b.memberSince}</span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div style={s.barTrack}>
                        <div style={{ ...s.barFill, width: `${pct}%`, background: TIER_COLOR[tier_] }} />
                      </div>
                    </div>

                    {/* Track levels */}
                    <div style={s.tracks}>
                      {(
                        [
                          ['xSignal',    b.xSignalLevel],
                          ['telegram',   b.telegramLevel],
                          ['governance', b.governanceLevel],
                          ['discord',    b.discordLevel],
                        ] as [string, number][]
                      ).map(([track, lvl]) => (
                        <div key={track} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1, color: '#2A4A5A', marginBottom: 2 }}>
                            {TRACK_ICON[track]}
                          </div>
                          <div style={{ ...s.trackLvl, color: lvl > 0 ? TIER_COLOR[tier_] : '#2A4050' }}>
                            {lvl > 0 ? `L${lvl}` : '—'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Score */}
                    <div style={s.scoreCol}>
                      <span style={{ color: TIER_COLOR[tier_], fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                        {b.signalScore.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10, color: '#3A6070', letterSpacing: 1 }}>SIGNAL</span>
                    </div>

                    {/* Arrow */}
                    <div style={{ color: '#2A4A5A', fontSize: 14, paddingLeft: 8 }}>›</div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      {totalMembers === 0 && (
        <div style={{ textAlign: 'center', color: '#2A4A5A', padding: '80px 0', fontSize: 14 }}>
          No members yet. Be the first to earn a DUAL // SIGNAL badge.
        </div>
      )}

      {/* Footer */}
      <div style={s.footer}>
        Powered by{' '}
        <span style={{ color: '#3A7A8A' }}>DUAL Network</span>
        {' '}· Scores update in real time via on-chain writes
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, accent, color }: {
  label: string; value: string; accent?: boolean; color?: string;
}) {
  return (
    <div style={{
      background:   'rgba(94,211,234,0.04)',
      border:       '1px solid rgba(94,211,234,0.1)',
      borderRadius: 10,
      padding:      '12px 18px',
    }}>
      <div style={{
        fontSize:           20,
        fontWeight:         700,
        color:              color ?? (accent ? '#5ED3EA' : '#D4E8F0'),
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#3A6070', textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight:   '100vh',
    background:  '#00111E',
    color:       '#D4E8F0',
    fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding:     '56px 24px 80px',
    maxWidth:    860,
    margin:      '0 auto',
    boxSizing:   'border-box' as const,
  },
  header: {
    textAlign:    'center' as const,
    marginBottom: 40,
  },
  eyebrow: {
    fontSize:    12,
    letterSpacing: 5,
    color:       '#5ED3EA',
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  h1: {
    fontSize:    32,
    fontWeight:  700,
    color:       '#FFFFFF',
    margin:      0,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize:    14,
    color:       '#4A7A8A',
    marginTop:   10,
    marginBottom: 0,
  },
  statsRow: {
    display:     'flex',
    flexWrap:    'wrap' as const,
    gap:         10,
    marginBottom: 40,
    justifyContent: 'center' as const,
  },
  tierHeading: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '10px 16px',
    borderRadius:   '8px 8px 0 0',
    border:         '1px solid',
    borderBottom:   'none',
  },
  memberList: {
    border:       '1px solid rgba(94,211,234,0.08)',
    borderTop:    'none',
    borderRadius: '0 0 8px 8px',
    overflow:     'hidden',
  },
  memberRow: {
    display:        'flex',
    alignItems:     'center',
    gap:            16,
    padding:        '14px 16px',
    borderBottom:   '1px solid rgba(94,211,234,0.05)',
    textDecoration: 'none',
    color:          'inherit',
    transition:     'background 0.15s',
    cursor:         'pointer',
    background:     'transparent',
  } as React.CSSProperties,
  rank: {
    width:     36,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  wallet: {
    fontFamily:  'monospace',
    fontSize:    14,
    color:       '#C0D8E4',
    fontWeight:  600,
  },
  ogPill: {
    fontSize:    9,
    letterSpacing: 2,
    color:       '#F7C873',
    background:  'rgba(247,200,115,0.1)',
    border:      '1px solid rgba(247,200,115,0.25)',
    borderRadius: 4,
    padding:     '1px 5px',
  },
  since: {
    fontSize:    11,
    color:       '#3A6070',
  },
  barTrack: {
    height:      3,
    background:  'rgba(94,211,234,0.08)',
    borderRadius: 2,
    marginTop:   6,
    overflow:    'hidden',
  },
  barFill: {
    height:      '100%',
    borderRadius: 2,
    opacity:     0.7,
  },
  tracks: {
    display:    'flex',
    gap:        12,
    flexShrink: 0,
  },
  trackLvl: {
    fontSize:           11,
    fontWeight:         600,
    fontVariantNumeric: 'tabular-nums' as const,
    textAlign:          'center' as const,
  },
  scoreCol: {
    display:       'flex',
    flexDirection: 'column' as const,
    alignItems:    'flex-end',
    flexShrink:    0,
    minWidth:      72,
  },
  footer: {
    textAlign:  'center' as const,
    fontSize:   12,
    color:      '#1A3A4A',
    marginTop:  60,
  },
};
