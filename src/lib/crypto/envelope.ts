import { gcm } from '@noble/ciphers/aes.js';
import { utf8ToBytes, bytesToUtf8, concatBytes } from '@noble/ciphers/utils.js';
import { gzipSync, gunzipSync } from 'fflate';
import { randomBytes } from './random';
import { SALT_LEN } from './kdf';

export const ENVELOPE_VERSION = 1;

const MAGIC = utf8ToBytes('EDBK'); // Eddies BacKup
const IV_LEN = 12; // 96-bit nonce for AES-GCM
const VER_OFF = MAGIC.length;
const SALT_OFF = VER_OFF + 1;
const IV_OFF = SALT_OFF + SALT_LEN;
const HEADER_LEN = IV_OFF + IV_LEN; // 4 + 1 + 16 + 12 = 33

/**
 * Self-describing binary backup envelope. Layout:
 *   [ MAGIC(4) | version(1) | salt(16) | iv(12) | ciphertext+gcmTag ]
 * The salt travels with the blob so a *fresh* device can derive the key from the
 * passphrase + downloaded blob alone (no local state needed to restore).
 * Integrity/authenticity come solely from the AES-GCM tag — we deliberately do
 * NOT store a plaintext digest, so the untrusted server cannot fingerprint or
 * confirm-by-guess the backup contents.
 */
export function seal(plaintext: string, key: Uint8Array, salt: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('Key must be 256-bit.');
  if (salt.length !== SALT_LEN) throw new Error('Bad salt length.');
  const iv = randomBytes(IV_LEN);
  const compressed = gzipSync(utf8ToBytes(plaintext));
  const ciphertext = gcm(key, iv).encrypt(compressed); // GCM tag appended by noble
  return concatBytes(MAGIC, Uint8Array.of(ENVELOPE_VERSION), salt, iv, ciphertext);
}

/** Read the embedded salt without the key — used to derive the key on restore. */
export function extractSalt(envelope: Uint8Array): Uint8Array {
  assertHeader(envelope);
  return envelope.slice(SALT_OFF, SALT_OFF + SALT_LEN);
}

export function open(envelope: Uint8Array, key: Uint8Array): string {
  assertHeader(envelope);
  const iv = envelope.slice(IV_OFF, IV_OFF + IV_LEN);
  const ciphertext = envelope.slice(HEADER_LEN);

  let compressed: Uint8Array;
  try {
    compressed = gcm(key, iv).decrypt(ciphertext); // throws if key wrong / tampered (GCM tag)
  } catch {
    throw new Error('Wrong passphrase or corrupted backup.');
  }

  // A valid GCM tag already proves authenticity; a gunzip failure here means
  // genuine corruption, not a wrong passphrase — keep the two distinct.
  let plainBytes: Uint8Array;
  try {
    plainBytes = gunzipSync(compressed);
  } catch {
    throw new Error('Backup integrity check failed.');
  }
  return bytesToUtf8(plainBytes);
}

function assertHeader(envelope: Uint8Array): void {
  if (envelope.length < HEADER_LEN) throw new Error('Backup is corrupted (too short).');
  for (let i = 0; i < MAGIC.length; i++) {
    if (envelope[i] !== MAGIC[i]) throw new Error('Not an Eddies backup.');
  }
  const ver = envelope[VER_OFF];
  if (ver !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported backup format (v${ver}). Update the app to restore.`);
  }
}
