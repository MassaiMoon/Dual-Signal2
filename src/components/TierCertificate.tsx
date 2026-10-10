/**
 * TierCertificate — a frozen, wallet-owned record of reaching a tier.
 *
 * Shares the Passport's frame, ring and tier accents so both read as one
 * family; the right column swaps live stats for the moment of achievement.
 */

import { tierAssets } from '@/lib/assets';
import { CSS, FrameArt, TierRing, TIER_ORDER, TIER_ACCENT } from '@/components/PassportCard';

export interface TierCertificateData {
  tier:               string;
  username:           string;
  scoreAtAchievement: number;
  /** YYYY-MM-DD */
  achievedAt:         string;
  memberSince:        string;
  /** Nth certificate issued for this tier. */
  serial?:            number;
}

const TIER_CODE: Record<string, string> = {
  INITIATE: 'INI', EXPLORER: 'EXP', BUILDER: 'BLD', STAKEHOLDER: 'STK', GENESIS: 'GEN', LEGEND: 'LGD',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Manual formatting keeps SSR and client output identical.
function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

const TC_CSS = `
  .tc-stats { margin-top: 2.6cqw; display: grid; grid-template-columns: 1fr 1fr; gap: 3cqw; }
  .tc-stat b { display: block; margin-top: 0.7cqw; font-size: 2.6cqw; font-weight: 800; letter-spacing: 0.02em; color: #FFFFFF;
    font-variant-numeric: tabular-nums; line-height: 1.1; }
  .tc-stat b span { margin-left: 0.5cqw; font-size: 1.2cqw; font-weight: 600; color: rgba(220,234,242,0.5); }

  .tc-ladder { position: relative; margin-top: 3.4cqw; display: grid; grid-template-columns: repeat(6, 1fr); }
  .tc-ladder::before { content: ''; position: absolute; left: 8.3%; right: 8.3%; top: 1.1cqw; height: 0.12cqw;
    background: rgba(255,255,255,0.10); }
  .tc-ladder-fill { position: absolute; left: 8.3%; top: 1.1cqw; height: 0.16cqw;
    background: linear-gradient(90deg, rgba(var(--pp-glow), 0.35), var(--pp-accent)); box-shadow: 0 0 0.8cqw rgba(var(--pp-glow), 0.6); }
  .tc-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.9cqw; }
  .tc-step i { width: 1.3cqw; height: 1.3cqw; margin-top: 0.45cqw; transform: rotate(45deg);
    border: 0.14cqw solid rgba(255,255,255,0.22); background: #06111D; }
  .tc-step.done i { border-color: var(--pp-accent); background: rgba(var(--pp-glow), 0.55); }
  .tc-step.now i { width: 2.2cqw; height: 2.2cqw; margin-top: 0; border-color: var(--pp-accent); background: var(--pp-accent);
    box-shadow: 0 0 1.4cqw rgba(var(--pp-glow), 0.9); }
  .tc-step span { font-size: 0.82cqw; font-weight: 700; letter-spacing: 0.12em; color: rgba(220,234,242,0.3); white-space: nowrap; }
  .tc-step.done span { color: rgba(220,234,242,0.6); }
  .tc-step.now span { color: var(--pp-accent); }
`;

export function TierCertificate({ data }: { data: TierCertificateData }) {
  const tier    = TIER_ORDER.includes(data.tier) ? data.tier : 'INITIATE';
  const [accent, glow] = TIER_ACCENT[tier];
  const tierIdx = TIER_ORDER.indexOf(tier);
  const score   = Math.max(0, Math.min(1000, data.scoreAtAchievement));
  const name    = data.username || '—';
  const serial  = data.serial ? `${TIER_CODE[tier]}-${String(data.serial).padStart(4, '0')}` : 'PREVIEW';

  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '<');
  const pad   = (s: string) => (s + '<'.repeat(44)).slice(0, 44);
  const mrz1  = pad(`C<DUAL<SIGNAL<<TIER<${clean(tier)}`);
  const mrz2  = pad(`${clean(name).slice(0, 18)}<${String(score).padStart(4, '0')}<${data.achievedAt.replace(/-/g, '')}<${clean(serial)}`);

  const vars = { '--pp-accent': accent, '--pp-glow': glow } as React.CSSProperties;

  return (
    <div className="pp" style={vars} role="img"
      aria-label={`DUAL // SIGNAL tier certificate — ${name} reached ${tier} on ${formatDate(data.achievedAt)}`}>
      <style>{CSS + TC_CSS}</style>
      <FrameArt />
      <div className="pp-sheen" />

      <div className="pp-body">
        <div className="pp-left">
          <div className="pp-ring">
            <TierRing progress={(tierIdx + 1) / TIER_ORDER.length} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pp-art" src={tierAssets[tier]} alt="" draggable={false} />
          </div>
          <div className="pp-plate">
            <div className="pp-tier">{tier}</div>
          </div>
          <div className="pp-tier-step">TIER {tierIdx + 1} / 6</div>
        </div>

        <div className="pp-right">
          <div className="pp-head">
            <div>
              <div className="pp-brand">DUAL <span>//</span> SIGNAL</div>
              <div className="pp-sub">TIER ACHIEVEMENT CERTIFICATE</div>
            </div>
            <div className="pp-serial"><small>CERT. NO.</small>{serial}</div>
          </div>

          <div className="pp-rule" />

          <div style={{ minWidth: 0 }}>
            <div className="pp-label">AWARDED TO</div>
            <div className="pp-name">{name}</div>
            {data.memberSince && <div className="pp-since">Member since {data.memberSince}</div>}
          </div>

          <div className="tc-stats">
            <div className="tc-stat">
              <div className="pp-label">ACHIEVED</div>
              <b>{formatDate(data.achievedAt)}</b>
            </div>
            <div className="tc-stat">
              <div className="pp-label">SIGNAL AT ACHIEVEMENT</div>
              <b>{score.toLocaleString('en-US')}<span>/ 1,000</span></b>
            </div>
          </div>

          <div className="tc-ladder" aria-hidden>
            <div className="tc-ladder-fill" style={{ width: `${(tierIdx / (TIER_ORDER.length - 1)) * 83.4}%` }} />
            {TIER_ORDER.map((t, i) => (
              <div key={t} className={`tc-step${i < tierIdx ? ' done' : i === tierIdx ? ' now' : ''}`}>
                <i />
                <span>{t}</span>
              </div>
            ))}
          </div>

          <div className="pp-seal" aria-hidden />
          <div className="pp-seal-text" aria-hidden>DUAL</div>
        </div>
      </div>

      <div className="pp-foot">
        <span>DUAL NETWORK · CHAIN 6301</span>
        <span><i />ISSUED ON-CHAIN</span>
      </div>
      <div className="pp-mrz" aria-hidden>
        <div>{mrz1}</div>
        <div>{mrz2}</div>
      </div>
    </div>
  );
}
