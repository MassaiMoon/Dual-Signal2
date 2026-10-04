/**
 * PassportCard — renders a DUAL // SIGNAL Passport (3:2) from badge state.
 *
 * Built entirely in code: a chamfered glass card with a drawn double frame,
 * guilloche security pattern, holographic seal and a passport-style machine
 * readable zone. Accents follow the holder's tier; channel badges are
 * code-drawn <AchievementEmblem>s that share the tier emblems' motifs.
 *
 * Sizes use container-query units (cqw = 1% of card width) and the frame SVG
 * uses a 300×200 viewBox, so 1 frame unit = 1/3 cqw.
 *
 * Used by the badge face (/faces/badge), the /me dashboard and /join.
 */

import { tierAssets, specialAssets } from '@/lib/assets';
import { AchievementEmblem, type EmblemTrack } from '@/components/AchievementEmblem';

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
  /** DUAL object ID — printed as the serial number when present. */
  objectId?:           string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_ORDER = ['INITIATE', 'EXPLORER', 'BUILDER', 'STAKEHOLDER', 'GENESIS', 'LEGEND'];

// Accent per tier: [primary, glow rgb]
const TIER_ACCENT: Record<string, [string, string]> = {
  INITIATE:    ['#7FA6B5', '127,166,181'],
  EXPLORER:    ['#5ED3EA', '94,211,234'],
  BUILDER:     ['#7FE4F4', '127,228,244'],
  STAKEHOLDER: ['#F2C46B', '242,196,107'],
  GENESIS:     ['#A8EDF9', '168,237,249'],
  LEGEND:      ['#B79BFF', '183,155,255'],
};

const TRACKS: { key: EmblemTrack; label: string; level: keyof BadgeData; connected: keyof BadgeData }[] = [
  { key: 'xSignal',    label: 'X Signal',   level: 'xSignalLevel',    connected: 'xConnected'          },
  { key: 'telegram',   label: 'Telegram',   level: 'telegramLevel',   connected: 'telegramConnected'   },
  { key: 'governance', label: 'Governance', level: 'governanceLevel', connected: 'governanceConnected' },
  { key: 'discord',    label: 'Discord',    level: 'discordLevel',    connected: 'discordConnected'    },
];

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// ─── Static geometry (precomputed + rounded → identical SSR / client markup) ──

// Guilloche: interleaved sine waves across the card
const GUILLOCHE = Array.from({ length: 16 }, (_, i) => {
  const y0 = 18 + i * 10.5, amp = 5 + (i % 3) * 1.6, phase = i * 0.55, f = 0.032 + (i % 2) * 0.008;
  let d = '';
  for (let x = 0; x <= 300; x += 6) {
    const y = y0 + amp * Math.sin(x * f + phase);
    d += `${x === 0 ? 'M' : 'L'}${x},${r3(y)} `;
  }
  return d.trim();
});

// Tier ring ticks
const RING_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const long = i % 10 === 0;
  const r1 = long ? 40.5 : 41.8, r2 = 43.2;
  return {
    long,
    x1: r3(50 + r1 * Math.sin(a)), y1: r3(50 - r1 * Math.cos(a)),
    x2: r3(50 + r2 * Math.sin(a)), y2: r3(50 - r2 * Math.cos(a)),
  };
});

// Edge ticks on the left/right frame rails
const RAIL_TICKS = Array.from({ length: 11 }, (_, i) => 60 + i * 8);

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .pp { container-type: inline-size; position: relative; width: 100%; aspect-ratio: 3 / 2; overflow: hidden;
    color: #DCEAF2; font-family: var(--font-inter), 'Inter', system-ui, sans-serif;
    clip-path: polygon(3.4% 0, 96.6% 0, 100% 5.1%, 100% 94.9%, 96.6% 100%, 3.4% 100%, 0 94.9%, 0 5.1%);
    background:
      radial-gradient(55cqw 45cqw at 21% 44%, rgba(var(--pp-glow), 0.22), transparent 70%),
      radial-gradient(70cqw 40cqw at 100% 0%, rgba(94,211,234,0.07), transparent 70%),
      linear-gradient(150deg, #0C1D2F 0%, #06111D 52%, #030A12 100%); }
  .pp-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .pp-sheen { position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(115deg, transparent 36%, rgba(255,255,255,0.04) 45%, transparent 54%); }

  .pp-body { position: absolute; inset: 5.4cqw 5.6cqw 11.2cqw; display: grid; grid-template-columns: 35% 1fr; gap: 4.6cqw; }

  .pp-left { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .pp-ring { position: relative; width: 100%; aspect-ratio: 1; }
  .pp-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pp-art { position: absolute; inset: 11%; width: 78%; height: 78%; object-fit: contain;
    filter: drop-shadow(0 0 2.2cqw rgba(var(--pp-glow), 0.45)); }
  .pp-plate { margin-top: 1.4cqw; padding: 0.7cqw 2.2cqw; text-align: center;
    clip-path: polygon(1.4cqw 0, calc(100% - 1.4cqw) 0, 100% 50%, calc(100% - 1.4cqw) 100%, 1.4cqw 100%, 0 50%);
    background: linear-gradient(90deg, rgba(var(--pp-glow), 0.06), rgba(var(--pp-glow), 0.18), rgba(var(--pp-glow), 0.06)); }
  .pp-tier { font-size: 2.15cqw; font-weight: 800; letter-spacing: 0.3em; text-indent: 0.3em; color: var(--pp-accent); line-height: 1.2; }
  .pp-tier-step { margin-top: 0.6cqw; font-size: 1cqw; font-weight: 600; letter-spacing: 0.26em; color: rgba(220,234,242,0.45); }
  .pp-pins { display: flex; gap: 0.8cqw; margin-top: 1.1cqw; }
  .pp-pin { display: flex; align-items: center; gap: 0.5cqw; padding: 0.4cqw 0.9cqw 0.4cqw 0.5cqw; border-radius: 99cqw;
    border: 0.12cqw solid rgba(247,200,115,0.45); background: rgba(247,200,115,0.08);
    font-size: 0.92cqw; font-weight: 700; letter-spacing: 0.18em; color: #F7C873; }
  .pp-pin img { width: 1.8cqw; height: 1.8cqw; object-fit: contain; }

  .pp-right { display: flex; flex-direction: column; justify-content: center; min-width: 0; position: relative; }
  .pp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 2cqw; }
  .pp-brand { font-size: 2.15cqw; font-weight: 800; letter-spacing: 0.2em; color: #F2F8FB; white-space: nowrap; }
  .pp-brand span { color: #5ED3EA; }
  .pp-sub { margin-top: 0.5cqw; font-size: 1cqw; font-weight: 600; letter-spacing: 0.3em; color: rgba(220,234,242,0.5); white-space: nowrap; }
  .pp-serial { text-align: right; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.05cqw; letter-spacing: 0.12em; color: rgba(220,234,242,0.55); white-space: nowrap; }
  .pp-serial small { display: block; font-family: var(--font-inter), 'Inter', sans-serif; font-size: 0.85cqw; font-weight: 700; letter-spacing: 0.26em; color: rgba(220,234,242,0.38); margin-bottom: 0.4cqw; }

  .pp-rule { position: relative; height: 0.12cqw; margin: 2cqw 0 2.2cqw; background: linear-gradient(90deg, rgba(var(--pp-glow), 0.6), rgba(var(--pp-glow), 0.04)); }
  .pp-rule::before { content: ''; position: absolute; left: 0; top: 50%; width: 0.9cqw; height: 0.9cqw; transform: translate(-50%, -50%) rotate(45deg); background: var(--pp-accent); }

  .pp-label { font-size: 0.95cqw; font-weight: 700; letter-spacing: 0.26em; color: rgba(220,234,242,0.48); }
  .pp-row2 { display: grid; grid-template-columns: 1fr auto; gap: 3cqw; align-items: end; }
  .pp-name { margin-top: 0.6cqw; font-size: 3.7cqw; font-weight: 800; letter-spacing: -0.01em; color: #FFFFFF; line-height: 1.05;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pp-since { margin-top: 0.6cqw; font-size: 1.15cqw; color: rgba(220,234,242,0.55); }
  .pp-score { text-align: right; font-variant-numeric: tabular-nums; }
  .pp-score b { font-size: 4.4cqw; font-weight: 800; letter-spacing: -0.02em; line-height: 1; color: #FFFFFF; }
  .pp-score span { margin-left: 0.6cqw; font-size: 1.3cqw; color: rgba(220,234,242,0.5); }
  .pp-bar { position: relative; margin-top: 1.7cqw; height: 0.7cqw; border-radius: 1cqw; background: rgba(255,255,255,0.06); }
  .pp-bar > div { height: 100%; border-radius: 1cqw; background: linear-gradient(90deg, rgba(var(--pp-glow), 0.55), var(--pp-accent));
    box-shadow: 0 0 1.4cqw rgba(var(--pp-glow), 0.6); }
  .pp-bar > i { position: absolute; top: -0.35cqw; width: 0.12cqw; height: 1.4cqw; background: rgba(255,255,255,0.18); }

  .pp-ach { margin-top: 2.2cqw; display: flex; flex-direction: column; gap: 0.7cqw; }
  .pp-track { display: grid; grid-template-columns: 24% 1fr; align-items: center; }
  .pp-track-name { font-size: 1.25cqw; font-weight: 600; letter-spacing: 0.06em; color: rgba(220,234,242,0.82); }
  .pp-track-name.off { color: rgba(220,234,242,0.32); }
  .pp-slots { display: flex; gap: 0.75cqw; }
  .pp-slot { width: 4.8cqw; height: 4.8cqw; flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; }
  .pp-slot::before { content: ''; position: absolute; inset: 14%; border-radius: 50%; border: 0.12cqw solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.015); }
  .pp-slot.next::before { border: 0.14cqw dashed rgba(var(--pp-glow), 0.6); }
  .pp-slot.on::before { display: none; }
  .pp-slot.on { filter: drop-shadow(0 0 0.7cqw rgba(94,211,234,0.35)); }

  .pp-seal { position: absolute; right: 0; bottom: 0; width: 7.4cqw; height: 7.4cqw; border-radius: 50%;
    background: conic-gradient(from 20deg, #5ED3EA, #B79BFF, #F7C873, #4AC89A, #5ED3EA);
    opacity: 0.32; mix-blend-mode: screen;
    -webkit-mask-image: radial-gradient(circle, #000 52%, transparent 53%, transparent 60%, #000 61%, #000 69%, transparent 70%);
            mask-image: radial-gradient(circle, #000 52%, transparent 53%, transparent 60%, #000 61%, #000 69%, transparent 70%); }
  .pp-seal-text { position: absolute; right: 0; bottom: 0; width: 7.4cqw; height: 7.4cqw; display: flex; align-items: center; justify-content: center;
    font-size: 1.05cqw; font-weight: 800; letter-spacing: 0.18em; text-indent: 0.18em; color: rgba(255,255,255,0.55); }

  .pp-mrz { position: absolute; left: 6.2cqw; right: 6.2cqw; bottom: 3.6cqw; font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 1.32cqw; line-height: 1.55; letter-spacing: 0.28em; color: rgba(220,234,242,0.34); white-space: nowrap; overflow: hidden; }
  .pp-foot { position: absolute; left: 6.2cqw; right: 6.2cqw; bottom: 8.6cqw; display: flex; justify-content: space-between; align-items: center;
    font-size: 0.9cqw; font-weight: 600; letter-spacing: 0.26em; color: rgba(220,234,242,0.42); }
  .pp-foot i { display: inline-block; width: 0.7cqw; height: 0.7cqw; border-radius: 50%; margin-right: 0.8cqw; vertical-align: middle;
    background: #4AC89A; box-shadow: 0 0 0 0.35cqw rgba(74,200,154,0.18); }
`;

// ─── Pieces ───────────────────────────────────────────────────────────────────

function FrameArt() {
  // 300×200 units; chamfer = 10
  const outer = 'M10.5,0.75 H289.5 L299.25,10.5 V189.5 L289.5,199.25 H10.5 L0.75,189.5 V10.5 Z';
  const inner = 'M13,4.5 H287 L295.5,13 V187 L287,195.5 H13 L4.5,187 V13 Z';
  const accent = { stroke: 'var(--pp-accent)' };
  return (
    <svg className="pp-layer" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden>
      {/* Guilloche security pattern */}
      <g fill="none" strokeWidth="0.25" style={{ stroke: 'rgba(var(--pp-glow), 0.09)' }}>
        {GUILLOCHE.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* Double frame */}
      <path d={outer} fill="none" strokeWidth="0.8" style={{ ...accent, strokeOpacity: 0.55 }} />
      <path d={inner} fill="none" strokeWidth="0.35" stroke="rgba(255,255,255,0.10)" />

      {/* Header tab (top centre) and footer tab (bottom centre) */}
      <path d="M118,0.75 L124,6.5 H176 L182,0.75" fill="rgba(0,0,0,0.25)" strokeWidth="0.6" style={accent} />
      <path d="M128,199.25 L132,195 H168 L172,199.25" fill="none" strokeWidth="0.5" style={{ ...accent, strokeOpacity: 0.6 }} />
      <circle cx="150" cy="3.6" r="0.9" style={{ fill: 'var(--pp-accent)' }} />

      {/* Corner diamonds on the chamfers */}
      {[[5.6, 5.6], [294.4, 5.6], [5.6, 194.4], [294.4, 194.4]].map(([x, y], i) => (
        <rect key={i} x={x - 1.3} y={y - 1.3} width="2.6" height="2.6" transform={`rotate(45 ${x} ${y})`} style={{ fill: 'var(--pp-accent)' }} />
      ))}

      {/* Rail ticks */}
      <g strokeWidth="0.4" style={{ stroke: 'var(--pp-accent)', strokeOpacity: 0.45 }}>
        {RAIL_TICKS.map(y => (
          <g key={y}>
            <line x1="0.75" y1={y} x2={y % 16 === 12 ? 4 : 2.6} y2={y} />
            <line x1="299.25" y1={y} x2={y % 16 === 12 ? 296 : 297.4} y2={y} />
          </g>
        ))}
      </g>

      {/* MRZ separator */}
      <line x1="16" y1="170" x2="284" y2="170" stroke="rgba(255,255,255,0.08)" strokeWidth="0.35" strokeDasharray="1.2 1.4" />
    </svg>
  );
}

function TierRing({ progress }: { progress: number }) {
  // progress: 0–1 of the overall 1,000 SIGNAL journey
  const r = 46;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.1" />
      <circle
        cx="50" cy="50" r={r} fill="none" strokeWidth="1.1" style={{ stroke: 'var(--pp-accent)' }} strokeLinecap="round"
        strokeDasharray={`${r3(circ * Math.max(0.015, progress))} ${r3(circ)}`} transform="rotate(-90 50 50)"
      />
      {RING_TICKS.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          style={{ stroke: t.long ? 'var(--pp-accent)' : 'rgba(255,255,255,0.14)' }}
          strokeOpacity={t.long ? 0.7 : 1} strokeWidth={t.long ? 0.6 : 0.35}
        />
      ))}
    </svg>
  );
}

function mrzLines(identity: string, tier: string, score: number, objectId: string | undefined, memberSince: string) {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '<');
  const pad   = (s: string) => (s + '<'.repeat(44)).slice(0, 44);
  const line1 = pad(`P<DUAL<SIGNAL<<${clean(identity)}`);
  const line2 = pad(`${clean(objectId ?? 'PREVIEW').slice(0, 24)}<${String(score).padStart(4, '0')}<${clean(tier)}<${clean(memberSince)}`);
  return [line1, line2];
}

// ─── Badge card ──────────────────────────────────────────────────────────────

export function BadgeCard({ data }: { data: BadgeData; debug?: boolean }) {
  const tier      = TIER_ORDER.includes(data.tier) ? data.tier : 'INITIATE';
  const [accent, glow] = TIER_ACCENT[tier];
  const tierIdx   = TIER_ORDER.indexOf(tier);
  const score     = Math.max(0, Math.min(1000, data.signalScore));

  const identity = data.username
    || (data.walletAddress ? `${data.walletAddress.slice(0, 6)}···${data.walletAddress.slice(-4)}` : '—');
  const serial   = data.objectId ? `${data.objectId.slice(0, 4)}···${data.objectId.slice(-6)}`.toUpperCase() : 'PREVIEW';
  const [mrz1, mrz2] = mrzLines(identity, tier, score, data.objectId, data.memberSince);

  const vars = { '--pp-accent': accent, '--pp-glow': glow } as React.CSSProperties;

  return (
    <div className="pp" style={vars} role="img" aria-label={`DUAL // SIGNAL Passport — ${identity}, ${tier}, ${score} SIGNAL`}>
      <style>{CSS}</style>
      <FrameArt />
      <div className="pp-sheen" />

      <div className="pp-body">
        {/* Tier */}
        <div className="pp-left">
          <div className="pp-ring">
            <TierRing progress={score / 1000} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pp-art" src={tierAssets[tier]} alt="" draggable={false} />
          </div>
          <div className="pp-plate">
            <div className="pp-tier">{tier}</div>
          </div>
          <div className="pp-tier-step">TIER {tierIdx + 1} / 6</div>
          {(data.isGenesis || data.isOG) && (
            <div className="pp-pins">
              {/* eslint-disable @next/next/no-img-element */}
              {data.isGenesis && <span className="pp-pin"><img src={specialAssets.GENESIS} alt="" />GENESIS</span>}
              {data.isOG      && <span className="pp-pin"><img src={specialAssets.OG} alt="" />OG</span>}
              {/* eslint-enable @next/next/no-img-element */}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="pp-right">
          <div className="pp-head">
            <div>
              <div className="pp-brand">DUAL <span>//</span> SIGNAL</div>
              <div className="pp-sub">COMMUNITY IDENTITY PASSPORT</div>
            </div>
            <div className="pp-serial"><small>NO.</small>{serial}</div>
          </div>

          <div className="pp-rule" />

          <div className="pp-row2">
            <div style={{ minWidth: 0 }}>
              <div className="pp-label">HOLDER</div>
              <div className="pp-name">{identity}</div>
              {data.memberSince && <div className="pp-since">Member since {data.memberSince}</div>}
            </div>
            <div className="pp-score">
              <div className="pp-label" style={{ marginBottom: '0.8cqw' }}>SIGNAL</div>
              <b>{score.toLocaleString('en-US')}</b><span>/ 1,000</span>
            </div>
          </div>
          <div className="pp-bar">
            <div style={{ width: `${Math.max(1.5, score / 10)}%` }} />
            {/* Tier thresholds */}
            {[15, 35, 55, 75, 90].map(p => <i key={p} style={{ left: `${p}%` }} />)}
          </div>

          <div className="pp-ach">
            {TRACKS.map(t => {
              const level     = Number(data[t.level]) || 0;
              const connected = Boolean(data[t.connected]);
              return (
                <div key={t.key} className="pp-track">
                  <span className={`pp-track-name${connected || level > 0 ? '' : ' off'}`}>{t.label}</span>
                  <div className="pp-slots">
                    {[1, 2, 3, 4, 5].map(l => {
                      const earned = l <= level;
                      const next   = !earned && connected && l === level + 1;
                      return (
                        <span key={l} className={`pp-slot${earned ? ' on' : next ? ' next' : ''}`}>
                          {earned && <AchievementEmblem track={t.key} level={l} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pp-seal" aria-hidden />
          <div className="pp-seal-text" aria-hidden>DUAL</div>
        </div>
      </div>

      <div className="pp-foot">
        <span>DUAL NETWORK · CHAIN 6301</span>
        <span><i />VERIFIED ON-CHAIN</span>
      </div>
      <div className="pp-mrz" aria-hidden>
        <div>{mrz1}</div>
        <div>{mrz2}</div>
      </div>
    </div>
  );
}
