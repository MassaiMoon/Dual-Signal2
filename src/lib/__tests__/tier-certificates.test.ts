import { describe, it, expect, vi } from 'vitest';
import { Tier } from '@prisma/client';
import type { DualOrgWallet } from '../dual-client';

vi.mock('../db', () => ({ db: {} }));

const { owedTiers, scoreForTier, indexWallets } = await import('../tier-certificates');

function wallet(over: Partial<DualOrgWallet> = {}): DualOrgWallet {
  return {
    id: 'w1', email: 'naca@proton.me', activated: true, disabled: false, email_verified: true,
    account: { address: '0xabc' }, ...over,
  };
}

describe('owedTiers', () => {
  it('owes only INITIATE to a new member', () => {
    expect(owedTiers(Tier.INITIATE)).toEqual([Tier.INITIATE]);
  });

  it('owes every tier passed on the way up', () => {
    expect(owedTiers(Tier.BUILDER)).toEqual([Tier.INITIATE, Tier.EXPLORER, Tier.BUILDER]);
  });

  it('owes all six at LEGEND', () => {
    expect(owedTiers(Tier.LEGEND)).toHaveLength(6);
  });
});

describe('scoreForTier', () => {
  it('uses the real score for the tier just reached', () => {
    expect(scoreForTier(Tier.BUILDER, Tier.BUILDER, 380)).toBe(380);
  });

  it('uses the threshold for tiers passed through', () => {
    expect(scoreForTier(Tier.EXPLORER, Tier.BUILDER, 380)).toBe(150);
    expect(scoreForTier(Tier.INITIATE, Tier.BUILDER, 380)).toBe(0);
  });
});

describe('indexWallets', () => {
  it('matches emails case-insensitively', () => {
    const idx = indexWallets([wallet({ email: 'NacaPerico@Proton.me' })]);
    expect(idx.get('nacaperico@proton.me')?.account.address).toBe('0xabc');
  });

  it('does not treat a substring as a match', () => {
    const idx = indexWallets([wallet({ email: 'jimbob@x.io' })]);
    expect(idx.get('bob@x.io')).toBeUndefined();
  });

  it('skips wallets that are not activated, disabled, or have no address', () => {
    const idx = indexWallets([
      wallet({ email: 'a@x.io', activated: false }),
      wallet({ email: 'b@x.io', disabled: true }),
      wallet({ email: 'c@x.io', account: { address: '' } }),
    ]);
    expect(idx.size).toBe(0);
  });
});
