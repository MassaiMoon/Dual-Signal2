/**
 * Design tokens for inline styles. Values are CSS variables defined in
 * src/app/globals.css — change colors there, not here.
 */

export const C = {
  bg:           'var(--ds-bg)',
  bgCard:       'var(--ds-bg-card)',
  bgInset:      'var(--ds-bg-inset)',
  bgRaised:     'var(--ds-bg-raised)',
  border:       'var(--ds-border)',
  borderStrong: 'var(--ds-border-strong)',
  cyan:         'var(--ds-cyan)',
  cyanStrong:   'var(--ds-cyan-strong)',
  cyanWash:     'var(--ds-cyan-wash)',
  gold:         'var(--ds-gold)',
  textStrong:   'var(--ds-text-strong)',
  text:         'var(--ds-text)',
  textDim:      'var(--ds-text-dim)',
  textFaint:    'var(--ds-text-faint)',
  success:      'var(--ds-success)',
  danger:       'var(--ds-danger)',
  warning:      'var(--ds-warning)',
} as const;

export const TIERS = [
  { name: 'INITIATE',    range: '0–149',    color: 'var(--ds-tier-initiate)'    },
  { name: 'EXPLORER',    range: '150–349',  color: 'var(--ds-tier-explorer)'    },
  { name: 'BUILDER',     range: '350–549',  color: 'var(--ds-tier-builder)'     },
  { name: 'STAKEHOLDER', range: '550–749',  color: 'var(--ds-tier-stakeholder)' },
  { name: 'GENESIS',     range: '750–899',  color: 'var(--ds-tier-genesis)'     },
  { name: 'LEGEND',      range: '900–1000', color: 'var(--ds-tier-legend)'      },
] as const;

export function tierColor(tier: string): string {
  return TIERS.find(t => t.name === tier)?.color ?? TIERS[0].color;
}
