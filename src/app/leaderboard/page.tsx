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

const TIER_BORDER_ALPHA: Record<Tier, string> = {
  LEGEND:      'rgba(255,215,0,0.18)',
  GENESIS:     'rgba(247,200,115,0.16)',
  STAKEHOLDER: 'rgba(168,237,249,0.14)',
  BUILDER:     'rgba(127,228,244,0.14)',
  EXPLORER:    'rgba(94,211,234,0.12)',
  INITIATE:    'rgba(74,122,138,0.14)',
};

const TIER_BG: Record<Tier, string> = {
  LEGEND:      'rgba(255,215,0,0.04)',
  GENESIS:     'rgba(247,200,115,0.03)',
  STAKEHOLDER: 'rgba(168,237,249,0.02)',
  BUILDER:     'rgba(127,228,244,0.02)',
  EXPLORER:    'rgba(94,211,234,0.02)',
  INITIATE:    'rgba(74,122,138,0.03)',
};

const TIER_SCORE_ALPHA: Record<Tier, string> = {
  LEGEND:      'rgba(255,215,0,0.4)',
  GENESIS:     'rgba(247,200,115,0.4)',
  STAKEHOLDER: 'rgba(168,237,249,0.35)',
  BUILDER:     'rgba(127,228,244,0.35)',
  EXPLORER:    'rgba(94,211,234,0.35)',
  INITIATE:    'rgba(74,122,138,0.4)',
};

const TIER_MIN: Record<Tier, number> = {
  LEGEND:      900,
  GENESIS:     750,
  STAKEHOLDER: 550,
  BUILDER:     350,
  EXPLORER:    150,
  INITIATE:    0,
};

const TIER_RANGE: Record<Tier, string> = {
  LEGEND:      '900–1000 SIGNAL',
  GENESIS:     '750–900 SIGNAL',
  STAKEHOLDER: '550–750 SIGNAL',
  BUILDER:     '350–550 SIGNAL',
  EXPLORER:    '150–350 SIGNAL',
  INITIATE:    '0–150 SIGNAL',
};

const TRACK_COLOR: Record<string, string> = {
  xSignal:    '#E8F4FC',
  telegram:   '#5ED3EA',
  governance: '#F7C873',
  discord:    '#7B83EB',
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

function progressPct(score: number, tier: Tier) {
  const min  = TIER_MIN[tier];
  const next = achievementConfig.butterflyTiers.find(t => t.minScore > min)?.minScore ?? achievementConfig.maxSignalScore;
  return Math.min(100, Math.round(((score - min) / (next - min)) * 100));
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
      user:            { select: { username: true } },
    },
  });

  const totalMembers = badges.length;
  const topScore     = badges[0]?.signalScore ?? 0;
  const byTier       = TIER_ORDER.reduce<Record<string, number>>((acc, t) => {
    acc[t] = badges.filter(b => b.cachedTier === t).length;
    return acc;
  }, {});

  const tiersWithMembers = TIER_ORDER.filter(t => byTier[t] > 0);

  return (
    <>
      <style>{`
        body { background: #040E1A; }
        .lb-member-row:hover { background: rgba(94,211,234,0.025) !important; }
        .lb-top1:hover { background: rgba(255,215,0,0.04) !important; }
        .lb-top2:hover { background: rgba(192,192,192,0.04) !important; }
        .lb-top3:hover { background: rgba(205,127,50,0.04) !important; }
        .lb-stat:hover { border-color: rgba(94,211,234,0.18) !important; }
        @media (max-width: 768px) {
          .lb-tracks { display: none !important; }
          .lb-score-col { min-width: 64px !important; }
          .lb-rank { width: 32px !important; }
        }
      `}</style>

      {/* ── Fixed Nav ── */}
      <nav style={{
        position:       'fixed',
        top:            0,
        left:           0,
        right:          0,
        zIndex:         100,
        height:         64,
        background:     'rgba(4,14,26,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom:   '1px solid rgba(94,211,234,0.09)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 48px',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize:      15,
            fontWeight:    800,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         '#E8F4FC',
          }}>
            DUAL <span style={{ color: '#5ED3EA' }}>//</span> SIGNAL
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         'rgba(94,211,234,0.4)',
            border:        '1px solid rgba(94,211,234,0.14)',
            borderRadius:  4,
            padding:       '3px 8px',
          }}>ALPHA</span>
          <span style={{
            fontSize:      11,
            fontWeight:    500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color:         '#5ED3EA',
          }}>Leaderboard</span>
          <Link href="/me" style={{
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background:    '#0EB4D0',
            color:         '#fff',
            borderRadius:  8,
            padding:       '9px 18px',
            textDecoration: 'none',
          }}>Dashboard →</Link>
        </div>
      </nav>

      <main style={{
        minHeight:  '100vh',
        background: '#040E1A',
        color:      '#C8D8E8',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        paddingTop: 64,
      }}>

        {/* ── Hero ── */}
        <div style={{
          background: 'radial-gradient(ellipse 1200px 600px at 50% -60px, rgba(14,180,208,0.07) 0%, transparent 65%)',
          padding:    '64px 48px 56px',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ display: 'block', width: 32, height: 1, background: 'rgba(94,211,234,0.3)' }} />
              <span style={{
                fontSize:      9,
                fontWeight:    700,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color:         '#5ED3EA',
              }}>Community Leaderboard</span>
              <span style={{ display: 'block', width: 32, height: 1, background: 'rgba(94,211,234,0.3)' }} />
            </div>

            <h1 style={{
              fontSize:      52,
              fontWeight:    900,
              color:         '#F0F8FC',
              letterSpacing: '-0.04em',
              lineHeight:    1,
              margin:        0,
              marginBottom:  14,
            }}>
              SIGNAL Rankings
            </h1>
            <p style={{
              fontSize:      14,
              color:         '#4A6A7A',
              letterSpacing: '0.06em',
              marginBottom:  48,
            }}>
              {totalMembers} verified member{totalMembers !== 1 ? 's' : ''} · scores updated in real time via on-chain writes
            </p>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <StatCard label="Members"     value={String(totalMembers)}        valueColor="#E8F4FC" />
              <StatCard label="Top Signal"  value={topScore.toLocaleString()}   valueColor="#5ED3EA" />
              {TIER_ORDER.filter(t => byTier[t] > 0).map(t => (
                <StatCard
                  key={t}
                  label={t.charAt(0) + t.slice(1).toLowerCase()}
                  value={String(byTier[t])}
                  valueColor={TIER_COLOR[t]}
                  borderColor={TIER_BORDER_ALPHA[t]}
                  bg={TIER_BG[t]}
                />
              ))}
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(94,211,234,0.06)', margin: 0 }} />

        {/* ── Leaderboard Content ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 48px 96px' }}>

          {tiersWithMembers.map(tier => {
            const members = badges.filter(b => b.cachedTier === tier);
            const color   = TIER_COLOR[tier];

            return (
              <section key={tier} style={{ marginBottom: 48 }}>

                {/* Tier header */}
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '16px 24px',
                  background:     TIER_BG[tier],
                  border:         `1px solid ${TIER_BORDER_ALPHA[tier]}`,
                  borderLeft:     `3px solid ${color}`,
                  borderRadius:   '12px 12px 0 0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{
                      fontSize:      12,
                      fontWeight:    800,
                      letterSpacing: '0.24em',
                      textTransform: 'uppercase',
                      color,
                    }}>{tier}</span>
                    <span style={{
                      fontSize:      10,
                      letterSpacing: '0.08em',
                      color:         color + '80',
                      background:    color + '10',
                      border:        `1px solid ${color}25`,
                      borderRadius:  4,
                      padding:       '2px 8px',
                    }}>{TIER_RANGE[tier]}</span>
                  </div>
                  <span style={{
                    fontSize:      11,
                    color:         color + '60',
                    letterSpacing: '0.1em',
                  }}>
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Member rows */}
                <div style={{
                  border:       `1px solid ${TIER_BORDER_ALPHA[tier]}`,
                  borderTop:    'none',
                  borderRadius: '0 0 12px 12px',
                  overflow:     'hidden',
                }}>
                  {members.map((b, idx) => {
                    const globalRank = badges.indexOf(b) + 1;
                    const tier_      = b.cachedTier as Tier;
                    const pct        = progressPct(b.signalScore, tier_);
                    const tierColor  = TIER_COLOR[tier_];
                    const hoverClass = globalRank === 1 ? 'lb-top1' : globalRank === 2 ? 'lb-top2' : globalRank === 3 ? 'lb-top3' : 'lb-member-row';

                    const rankCircle = globalRank <= 3
                      ? {
                          background: [
                            'linear-gradient(135deg,#FFD700 0%,#E09000 100%)',
                            'linear-gradient(135deg,#D4D4D4 0%,#A0A0A0 100%)',
                            'linear-gradient(135deg,#CD7F32 0%,#A05020 100%)',
                          ][globalRank - 1],
                          boxShadow: [
                            '0 0 16px rgba(255,215,0,0.25)',
                            '0 0 12px rgba(192,192,192,0.15)',
                            '0 0 10px rgba(205,127,50,0.2)',
                          ][globalRank - 1],
                          color: globalRank === 1 ? 'rgba(0,0,0,0.7)' : globalRank === 2 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
                          fontSize: 15,
                          fontWeight: 900,
                        }
                      : {
                          background: 'rgba(94,211,234,0.05)',
                          border:     '1px solid rgba(94,211,234,0.1)',
                          color:      '#3A5A6A',
                          fontSize:   12,
                          fontWeight: 600,
                        };

                    return (
                      <Link
                        key={b.id}
                        href={`/badge/${b.dualObjectId}`}
                        className={hoverClass}
                        style={{
                          display:        'flex',
                          alignItems:     'center',
                          gap:            20,
                          padding:        '20px 24px',
                          borderBottom:   idx < members.length - 1 ? '1px solid rgba(94,211,234,0.05)' : 'none',
                          textDecoration: 'none',
                          color:          'inherit',
                          cursor:         'pointer',
                          background:     'transparent',
                        } as React.CSSProperties}
                      >
                        {/* Rank circle */}
                        <div className="lb-rank" style={{
                          width:         40,
                          height:        40,
                          borderRadius:  '50%',
                          display:       'flex',
                          alignItems:    'center',
                          justifyContent: 'center',
                          flexShrink:    0,
                          ...rankCircle,
                        }}>
                          {globalRank <= 3 ? globalRank : `#${globalRank}`}
                        </div>

                        {/* Identity + progress */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{
                              fontSize:   15,
                              fontWeight: 700,
                              color:      b.user?.username ? '#F0F8FC' : '#C8D8E8',
                              fontFamily: b.user?.username ? 'inherit' : 'monospace',
                            }}>
                              {b.user?.username ? `@${b.user.username}` : short(b.walletAddress)}
                            </span>
                            {b.isOG && (
                              <span style={{
                                fontSize:      9,
                                fontWeight:    700,
                                letterSpacing: '0.16em',
                                color:         '#F7C873',
                                background:    'rgba(247,200,115,0.1)',
                                border:        '1px solid rgba(247,200,115,0.25)',
                                borderRadius:  4,
                                padding:       '1px 6px',
                              }}>OG</span>
                            )}
                            {b.memberSince && (
                              <span style={{ fontSize: 11, color: '#3A5A6A' }}>
                                since {b.memberSince}
                              </span>
                            )}
                          </div>
                          <div style={{
                            height:      5,
                            background:  tierColor + '15',
                            borderRadius: 3,
                            overflow:    'hidden',
                          }}>
                            <div style={{
                              height:      '100%',
                              width:       `${pct}%`,
                              background:  tierColor,
                              borderRadius: 3,
                              opacity:     0.7,
                            }} />
                          </div>
                        </div>

                        {/* Track chips */}
                        <div className="lb-tracks" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          {(
                            [
                              ['xSignal',    b.xSignalLevel],
                              ['telegram',   b.telegramLevel],
                              ['governance', b.governanceLevel],
                              ['discord',    b.discordLevel],
                            ] as [string, number][]
                          ).map(([track, lvl]) => {
                            const active = lvl > 0;
                            return (
                              <span key={track} style={{
                                fontSize:      9,
                                fontWeight:    active ? 700 : 600,
                                letterSpacing: '0.06em',
                                color:         active ? TRACK_COLOR[track] : '#3A5A6A',
                                background:    active ? TRACK_COLOR[track] + '12' : 'rgba(94,211,234,0.03)',
                                border:        active ? `1px solid ${TRACK_COLOR[track]}20` : '1px solid rgba(94,211,234,0.07)',
                                borderRadius:  4,
                                padding:       '3px 7px',
                              }}>
                                {active ? `${TRACK_ICON[track]} L${lvl}` : `${TRACK_ICON[track]} —`}
                              </span>
                            );
                          })}
                        </div>

                        {/* Score */}
                        <div className="lb-score-col" style={{
                          display:       'flex',
                          flexDirection: 'column',
                          alignItems:    'flex-end',
                          flexShrink:    0,
                          minWidth:      88,
                        }}>
                          <span style={{
                            fontSize:           28,
                            fontWeight:         900,
                            color:              tierColor,
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing:      '-0.03em',
                            lineHeight:         1,
                          }}>
                            {b.signalScore.toLocaleString()}
                          </span>
                          <span style={{
                            fontSize:      9,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color:         TIER_SCORE_ALPHA[tier_],
                            marginTop:     3,
                          }}>SIGNAL</span>
                        </div>

                        <div style={{ color: '#2A4A5A', fontSize: 18, paddingLeft: 4 }}>›</div>
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

        </div>

        {/* ── Footer ── */}
        <footer style={{
          borderTop:      '1px solid rgba(94,211,234,0.06)',
          padding:        '24px 48px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize:      12,
            fontWeight:    700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         '#1A2E3A',
          }}>
            DUAL <span style={{ color: '#1E3A4A' }}>//</span> SIGNAL
          </span>
          <span style={{
            fontSize:      10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         '#12202C',
          }}>DUAL Network · Chain 6301</span>
        </footer>

      </main>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, valueColor, borderColor, bg,
}: {
  label: string;
  value: string;
  valueColor: string;
  borderColor?: string;
  bg?: string;
}) {
  return (
    <div className="lb-stat" style={{
      background:   bg ?? '#071525',
      border:       `1px solid ${borderColor ?? 'rgba(94,211,234,0.1)'}`,
      borderRadius: 12,
      padding:      '18px 28px',
      minWidth:     120,
      transition:   'border-color 0.15s',
      cursor:       'default',
    }}>
      <div style={{
        fontSize:           32,
        fontWeight:         800,
        color:              valueColor,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing:      '-0.03em',
        lineHeight:         1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color:         borderColor ? valueColor + '60' : '#3A5A6A',
        marginTop:     6,
      }}>
        {label}
      </div>
    </div>
  );
}
