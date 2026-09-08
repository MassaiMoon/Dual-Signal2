/**
 * Auth utility tests — pure functions only.
 * No real DB, no real API calls, no real DUAL objects.
 */

import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, normalizeEmail } from '../auth';

describe('generateToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('returns a different token each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('hashToken', () => {
  it('returns a 64-character hex SHA-256 digest', () => {
    const hash = hashToken('abc');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('is deterministic — same input yields same hash', () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it('different inputs produce different hashes', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });

  it('raw token is never equal to its hash', () => {
    const t = generateToken();
    expect(hashToken(t)).not.toBe(t);
  });
});

describe('normalizeEmail', () => {
  it('lower-cases the email', () => {
    expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEmail('  alice@example.com  ')).toBe('alice@example.com');
  });

  it('handles already-normalised input unchanged', () => {
    expect(normalizeEmail('bob@example.com')).toBe('bob@example.com');
  });
});
