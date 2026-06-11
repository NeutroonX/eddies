import { seal, open, extractSalt, ENVELOPE_VERSION } from '../crypto/envelope';
import {
  deriveKey,
  generateSalt,
  makeVerifier,
  checkVerifier,
  ARGON2_PARAMS,
  SALT_LEN,
} from '../crypto/kdf';

// Cheap Argon2 params for fast tests; correctness is param-independent. One test
// below exercises the real production ARGON2_PARAMS to prove that config works.
const FAST = { t: 1, m: 256, p: 1, dkLen: 32 };

// Fixed 32-byte key for fast envelope tests (avoids running Argon2 every case).
const key = () => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const otherKey = () => Uint8Array.from({ length: 32 }, (_, i) => (i * 11 + 1) & 0xff);
const salt = () => Uint8Array.from({ length: SALT_LEN }, (_, i) => i);

const SAMPLE = JSON.stringify({
  version: '1.0.0',
  transactions: Array.from({ length: 200 }, (_, i) => ({
    id: `tx_${i}`,
    amount_minor: i * 137,
    note: 'coffee ☕ at ₹ café — UPI',
  })),
});

describe('envelope seal/open', () => {
  it('round-trips plaintext byte-identically', () => {
    const env = seal(SAMPLE, key(), salt());
    expect(open(env, key())).toBe(SAMPLE);
  });

  it('produces a versioned, magic-prefixed envelope', () => {
    const env = seal('hello', key(), salt());
    expect(String.fromCharCode(...env.slice(0, 4))).toBe('EDBK');
    expect(env[4]).toBe(ENVELOPE_VERSION);
  });

  it('embeds the salt so a fresh device can recover it', () => {
    const s = salt();
    const env = seal('hello', key(), s);
    expect(Array.from(extractSalt(env))).toEqual(Array.from(s));
  });

  it('rejects a wrong key (GCM auth tag)', () => {
    const env = seal(SAMPLE, key(), salt());
    expect(() => open(env, otherKey())).toThrow(/wrong passphrase|corrupted/i);
  });

  it('rejects a tampered ciphertext byte', () => {
    const env = seal(SAMPLE, key(), salt());
    env[env.length - 1] ^= 0xff; // flip last ciphertext/tag byte
    expect(() => open(env, key())).toThrow();
  });

  it('rejects a truncated / non-Eddies blob', () => {
    expect(() => open(new Uint8Array(10), key())).toThrow(/corrupted|too short/i);
    const notOurs = new Uint8Array(80);
    expect(() => open(notOurs, key())).toThrow(/not an eddies/i);
  });

  it('compresses repetitive ledger JSON below plaintext size', () => {
    const env = seal(SAMPLE, key(), salt());
    expect(env.length).toBeLessThan(SAMPLE.length);
  });
});

describe('kdf', () => {
  it('derives a deterministic 256-bit key', () => {
    const s = generateSalt();
    const k1 = deriveKey('correct horse battery staple', s, FAST);
    const k2 = deriveKey('correct horse battery staple', s, FAST);
    expect(k1.length).toBe(32);
    expect(Array.from(k1)).toEqual(Array.from(k2));
  });

  it('different passphrase → different key', () => {
    const s = generateSalt();
    const k1 = deriveKey('passphrase-A', s, FAST);
    const k2 = deriveKey('passphrase-B', s, FAST);
    expect(Array.from(k1)).not.toEqual(Array.from(k2));
  });

  it('different salt → different key (same passphrase)', () => {
    const k1 = deriveKey('same-pass', Uint8Array.from({ length: 16 }, () => 1), FAST);
    const k2 = deriveKey('same-pass', Uint8Array.from({ length: 16 }, () => 2), FAST);
    expect(Array.from(k1)).not.toEqual(Array.from(k2));
  });

  it('rejects empty passphrase and bad salt length', () => {
    expect(() => deriveKey('', generateSalt(), FAST)).toThrow(/passphrase/i);
    expect(() => deriveKey('x', new Uint8Array(8), FAST)).toThrow(/salt/i);
  });

  it('generateSalt yields the expected length', () => {
    expect(generateSalt().length).toBe(SALT_LEN);
  });

  it('verifier accepts the right key and rejects the wrong one', () => {
    const v = makeVerifier(key());
    expect(checkVerifier(key(), v)).toBe(true);
    expect(checkVerifier(otherKey(), v)).toBe(false);
  });

  it('end-to-end with REAL production params: passphrase → key → seal → open', () => {
    const s = generateSalt();
    const k = deriveKey('hunter2-hunter2', s, ARGON2_PARAMS);
    const env = seal(SAMPLE, k, s);
    const recovered = deriveKey('hunter2-hunter2', extractSalt(env), ARGON2_PARAMS);
    expect(open(env, recovered)).toBe(SAMPLE);
  }, 120_000);
});
