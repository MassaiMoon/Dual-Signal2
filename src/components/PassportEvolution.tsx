'use client';

/**
 * PassportEvolution — animated demo of a Passport levelling up from a fresh
 * mint to LEGEND. Renders the real PassportCard for each stage and morphs
 * between them; autoplays, pauses on hover/focus, and the tier track is
 * clickable. With prefers-reduced-motion it stays still until clicked.
 */

import { useEffect, useRef, useState } from 'react';
import { BadgeCard, type BadgeData } from '@/components/PassportCard';
import { calculateTier } from '@/lib/config';
import { TIERS } from '@/lib/theme';

// ── Stages ────────────────────────────────────────────────────────────────────
// Levels per channel: [X, Telegram, Discord, Governance]. 0 = not connected,
// -1 = connected but nothing earned yet. Each level is worth 50 pts (max 250),
// mirroring computeSignalScore in rules-engine.

type Levels = [number, number, number, number];

const STAGES: { title: string; caption: string; levels: Levels }[] = [
  { title: 'Fresh mint',          caption: 'Your Passport is minted on DUAL the moment you join.',                levels: [0, 0, 0, 0]   },
  { title: 'Accounts connected',  caption: 'Link X, Telegram, Discord and the forum — first badges appear.',      levels: [1, 1, -1, -1] },
  { title: 'Explorer',            caption: 'Regular activity pushes you past 150 SIGNAL.',                         levels: [2, 2, -1, 1]  },
  { title: 'Builder',             caption: 'Your posts travel further and governance badges start to stack.',     levels: [3, 3, 1, 2]   },
  { title: 'Stakeholder',         caption: 'A core member across every channel.',                                  levels: [4, 3, 3, 3]   },
  { title: 'Genesis',             caption: 'Top-tier presence across all four channels — the crest gets its full crown.',                          levels: [4, 4, 4, 4]   },
  { title: 'Legend',              caption: 'Level 5 everywhere — the final form, at 1,000 SIGNAL.',                                    levels: [5, 5, 5, 5]   },
];

function stageData({ levels: [x, tg, dc, gov] }: typeof STAGES[number]): BadgeData {
  const pts = (l: number) => Math.max(0, l) * 50;
  const score = pts(x) + pts(tg) + pts(dc) + pts(gov);
  return {
    signalScore:         score,
    tier:                calculateTier(score),
    xSignalLevel:        Math.max(0, x),
    telegramLevel:       Math.max(0, tg),
    discordLevel:        Math.max(0, dc),
    governanceLevel:     Math.max(0, gov),
    xConnected:          x !== 0,
    telegramConnected:   tg !== 0,
    discordConnected:    dc !== 0,
    governanceConnected: gov !== 0,
    isOG:                false,
    isGenesis:           false,
    walletAddress:       '',
    username:            'YourName',
    memberSince:         '',
  };
}

const DATA = STAGES.map(stageData);
const STEP_MS  = 3400;
const COUNT_MS = 900;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PassportEvolution() {
  const [index,  setIndex]  = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [score,  setScore]  = useState(DATA[0].signalScore);
  const fromScore = useRef(DATA[0].signalScore);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Autoplay
  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % STAGES.length), index === STAGES.length - 1 ? STEP_MS * 1.6 : STEP_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduced]);

  // Count the SIGNAL score up/down to the new stage
  useEffect(() => {
    const target = DATA[index].signalScore;
    const from   = fromScore.current;
    fromScore.current = target;
    if (reduced || from === target) { setScore(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setScore(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, reduced]);

  const current     = DATA[index];
  const stage       = STAGES[index];
  const currentTier = current.tier;

  return (
    <figure
      className="pe"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label="How a DUAL // SIGNAL Passport evolves through the tiers"
    >
      <style>{`
        .pe { margin: 0; width: 100%; }
        .pe-stage { position: relative; aspect-ratio: 3 / 2; width: 100%; filter: drop-shadow(0 24px 36px rgba(94,211,234,0.16)); }
        .pe-layer { position: absolute; inset: 0; opacity: 0; transform: scale(1.025); filter: blur(6px) brightness(1.6);
          transition: opacity 0.9s ease, transform 0.9s ease, filter 0.9s ease; }
        .pe-layer.is-on { opacity: 1; transform: scale(1); filter: none; }
        .pe-flash { position: absolute; inset: 0; pointer-events: none; z-index: 10;
          background: radial-gradient(circle at 31% 46%, rgba(94,211,234,0.55), transparent 45%); opacity: 0; }
        @keyframes pe-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
        .pe-flash.go { animation: pe-flash 1.1s ease-out; }

        .pe-cap { margin-top: 18px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .pe-title { font-size: 16px; font-weight: 700; color: var(--ds-text-strong); margin: 0; }
        .pe-score { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--ds-text-dim); white-space: nowrap; }
        .pe-score b { color: var(--ds-cyan); font-size: 16px; }
        .pe-text { margin: 4px 0 0; font-size: 13px; line-height: 1.6; color: var(--ds-text-dim); min-height: 2.6em; }

        .pe-bar { margin-top: 14px; height: 4px; border-radius: 2px; background: var(--ds-border); overflow: hidden; }
        .pe-bar > div { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--ds-cyan-strong), var(--ds-cyan), var(--ds-gold));
          background-size: 1000px 100%; transition: width 0.9s cubic-bezier(.2,.7,.2,1); }

        .pe-tiers { margin-top: 10px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
        .pe-tier { appearance: none; background: none; border: 0; padding: 6px 0 0; cursor: pointer; font-family: inherit;
          font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: var(--ds-text-faint); text-align: left;
          border-top: 2px solid transparent; transition: color 0.3s, border-color 0.3s; overflow: hidden; text-overflow: ellipsis; }
        .pe-tier.is-reached { color: var(--ds-text-dim); }
        .pe-tier.is-current { border-top-color: currentColor; }
        .pe-tier:hover { color: var(--ds-text); }

        @media (max-width: 420px) { .pe-tier { font-size: 8px; letter-spacing: 0.06em; } }
        @media (prefers-reduced-motion: reduce) { .pe-layer { transition: none; } }
      `}</style>

      <div className="pe-stage">
        {DATA.map((d, i) => (
          <div key={i} className={`pe-layer${i === index ? ' is-on' : ''}`} aria-hidden={i !== index}>
            <BadgeCard data={i === index ? { ...d, signalScore: score } : d} />
          </div>
        ))}
        {!reduced && (
          <div key={index} className="pe-flash go" />
        )}
      </div>

      <figcaption>
        <div className="pe-cap">
          <p className="pe-title">{stage.title}</p>
          <span className="pe-score"><b>{score.toLocaleString('en-US')}</b> / 1,000 SIGNAL</span>
        </div>
        <p className="pe-text" aria-live="polite">{stage.caption}</p>

        <div className="pe-bar"><div style={{ width: `${(score / 1000) * 100}%` }} /></div>
        <div className="pe-tiers">
          {TIERS.map(t => {
            const reached = TIERS.findIndex(x => x.name === t.name) <= TIERS.findIndex(x => x.name === currentTier);
            const target  = DATA.findIndex(d => d.tier === t.name);
            return (
              <button
                key={t.name}
                type="button"
                className={`pe-tier${reached ? ' is-reached' : ''}${t.name === currentTier ? ' is-current' : ''}`}
                style={t.name === currentTier ? { color: t.color } : undefined}
                onClick={() => setIndex(target)}
                aria-label={`Show ${t.name} Passport`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </figcaption>
    </figure>
  );
}
