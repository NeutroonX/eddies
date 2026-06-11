import { argon2id } from '@noble/hashes/argon2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { randomBytes } from './random';

export const SALT_LEN = 16;

export interface Argon2Params {
  t: number; // time cost (passes)
  m: number; // memory cost (KiB)
  p: number; // parallelism
  dkLen: number; // derived key length (bytes)
}

// Argon2id parameters for envelope v1. These are baked into the version: changing
// them REQUIRES bumping ENVELOPE_VERSION, because restore must derive the key with
// identical parameters. ~19 MiB / 2 passes — OWASP-baseline, tuned for pure-JS on
// mobile where a one-off ~3-9s derive on backup/restore is acceptable.
export const ARGON2_PARAMS: Argon2Params = { t: 2, m: 19456, p: 1, dkLen: 32 };

export function generateSalt(): Uint8Array {
  return randomBytes(SALT_LEN);
}

// Derive a 256-bit key from the user's backup passphrase. NFKC-normalise so the
// same typed passphrase yields the same key across keyboards/platforms.
// `params` is overridable only so tests can run cheap derivations; production
// always uses ARGON2_PARAMS (which are pinned to the envelope version).
export function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2Params = ARGON2_PARAMS,
): Uint8Array {
  if (!passphrase) throw new Error('Passphrase required.');
  if (salt.length !== SALT_LEN) throw new Error('Bad salt length.');
  return argon2id(utf8ToBytes(passphrase.normalize('NFKC')), salt, params);
}

// Non-reversible verifier. Lets the current device reject a wrong passphrase
// locally (no server round-trip, no plaintext exposed) before re-uploading.
// Double-hash so the stored value reveals nothing about the key itself.
export function makeVerifier(key: Uint8Array): Uint8Array {
  return sha256(sha256(key));
}

export function checkVerifier(key: Uint8Array, verifier: Uint8Array): boolean {
  const v = makeVerifier(key);
  if (v.length !== verifier.length) return false;
  let diff = 0;
  for (let i = 0; i < v.length; i++) diff |= v[i] ^ verifier[i];
  return diff === 0;
}
