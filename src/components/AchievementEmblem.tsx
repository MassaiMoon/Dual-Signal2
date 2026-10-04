/**
 * AchievementEmblem — code-drawn channel badge (X / Telegram / Governance /
 * Discord) for levels 1–5. Shares the motifs of the tier emblems so the two
 * read as one set:
 *
 *   L1  ring + four crystal studs            (Initiate / Explorer orbs)
 *   L2  + ticked outer ring                   (card frame ticks)
 *   L3  + hexagon frame                       (Builder)
 *   L4  gold metal + long crystal points      (Stakeholder)
 *   L5  + glow halo, diagonal studs, crown    (Genesis / Legend)
 *
 * Gradient ids are shared between instances on purpose — every definition is
 * identical, so whichever one the browser resolves renders the same.
 */

export type EmblemTrack = 'xSignal' | 'telegram' | 'governance' | 'discord';

// Glyphs drawn in a 24×24 box
const GLYPH: Record<EmblemTrack, string> = {
  xSignal:    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  telegram:   'M21.6 3.2 2.6 10.6c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.4c.3.9 1.4 1.1 2 .4l2.6-2.7 4.8 3.5c.8.6 1.9.1 2.1-.8l3.2-15c.2-1.1-.8-2-1.8-1.6zM9.5 14.3l-.5 4.1-1.4-4.6L18 7.4z',
  governance: 'M12 2 2 7v2h20V7L12 2zM4 10h3v8H4zm4.5 0h3v8h-3zm4.5 0h3v8h-3zm4.5 0h3v8h-3zM2 19h20v3H2z',
  discord:    'M19.3 5.3A16.5 16.5 0 0 0 15.2 4l-.5 1a15 15 0 0 0-5.4 0L8.8 4a16.5 16.5 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.6 16.6 0 0 0 5 2.5l1.1-1.7c-.6-.2-1.2-.5-1.7-.8l.4-.3a11.8 11.8 0 0 0 11 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.5 16.5 0 0 0 5-2.5c.4-4.3-.7-8-3-11.4zM8.7 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z',
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function diamond(cx: number, cy: number, w: number, h: number) {
  return `${r3(cx)},${r3(cy - h)} ${r3(cx + w)},${r3(cy)} ${r3(cx)},${r3(cy + h)} ${r3(cx - w)},${r3(cy)}`;
}

const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i;
  return `${r3(50 + 44 * Math.sin(a))},${r3(50 - 44 * Math.cos(a))}`;
}).join(' ');

const TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2;
  return { x1: r3(50 + 38.2 * Math.sin(a)), y1: r3(50 - 38.2 * Math.cos(a)), x2: r3(50 + 40.6 * Math.sin(a)), y2: r3(50 - 40.6 * Math.cos(a)) };
});

const DIAG = [45, 135, 225, 315].map(d => {
  const a = (d * Math.PI) / 180;
  return { x: r3(50 + 37 * Math.sin(a)), y: r3(50 - 37 * Math.cos(a)) };
});

export function AchievementEmblem({ track, level }: { track: EmblemTrack; level: number }) {
  const lv    = Math.max(1, Math.min(5, level));
  const metal = lv >= 4 ? 'url(#ae-gold)' : 'url(#ae-silver)';

  return (
    <svg viewBox="0 0 100 100" aria-hidden style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <radialGradient id="ae-disc" cx="50%" cy="38%" r="65%">
          <stop offset="0%"   stopColor="#123150" />
          <stop offset="70%"  stopColor="#071425" />
          <stop offset="100%" stopColor="#040B15" />
        </radialGradient>
        <linearGradient id="ae-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#F2FBFF" />
          <stop offset="45%"  stopColor="#8FB3C2" />
          <stop offset="100%" stopColor="#DDEBF2" />
        </linearGradient>
        <linearGradient id="ae-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FFF0B8" />
          <stop offset="45%"  stopColor="#C9922F" />
          <stop offset="100%" stopColor="#FFD86B" />
        </linearGradient>
        <linearGradient id="ae-crystal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#D8FAFF" />
          <stop offset="55%"  stopColor="#3FB8F0" />
          <stop offset="100%" stopColor="#1A5FD0" />
        </linearGradient>
        <linearGradient id="ae-glyph" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#E6FCFF" />
          <stop offset="100%" stopColor="#4CCBF0" />
        </linearGradient>
        <radialGradient id="ae-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#5ED3EA" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#5ED3EA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ae-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%"  stopColor="#5ED3EA" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#5ED3EA" stopOpacity="0" />
        </radialGradient>
      </defs>

      {lv >= 5 && <circle cx="50" cy="50" r="50" fill="url(#ae-halo)" />}

      {lv >= 3 && <polygon points={HEX} fill="none" stroke={metal} strokeWidth="1.6" strokeLinejoin="round" />}

      {lv >= 2 && (
        <g>
          <circle cx="50" cy="50" r="40.6" fill="none" stroke={metal} strokeWidth="0.9" opacity="0.85" />
          {TICKS.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={metal} strokeWidth="0.7" opacity="0.6" />)}
        </g>
      )}

      {/* Core disc */}
      <circle cx="50" cy="50" r="31" fill="url(#ae-disc)" />
      <circle cx="50" cy="50" r="31" fill="none" stroke={metal} strokeWidth="2.6" />
      <circle cx="50" cy="50" r="24" fill="url(#ae-core)" />
      <circle cx="50" cy="50" r="27.2" fill="none" stroke="#5ED3EA" strokeOpacity="0.35" strokeWidth="0.8" />

      {/* Cardinal studs; L4+ stretches N/S into long crystal points */}
      <polygon points={lv >= 4 ? diamond(50, 13, 5, 12) : diamond(50, 15.5, 4.2, 6)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.8" />
      <polygon points={lv >= 4 ? diamond(50, 87, 5, 12) : diamond(50, 84.5, 4.2, 6)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.8" />
      <polygon points={diamond(15.5, 50, 6, 4.2)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.8" />
      <polygon points={diamond(84.5, 50, 6, 4.2)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.8" />

      {lv >= 5 && (
        <g>
          {DIAG.map((d, i) => <polygon key={i} points={diamond(d.x, d.y, 3, 3)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.6" />)}
          {/* Crown */}
          <polygon points={diamond(40, 6, 2.6, 5)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.6" />
          <polygon points={diamond(60, 6, 2.6, 5)} fill="url(#ae-crystal)" stroke={metal} strokeWidth="0.6" />
        </g>
      )}

      {/* Channel glyph */}
      <g transform="translate(35 35) scale(1.25)">
        <path d={GLYPH[track]} fill="url(#ae-glyph)" fillRule="evenodd" />
      </g>
    </svg>
  );
}
