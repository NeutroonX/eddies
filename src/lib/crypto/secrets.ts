import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

// Per-user KDF material kept on THIS device only:
//  - salt: reused across backups so the same passphrase derives the same key.
//  - verifier: lets us reject a wrong passphrase locally before re-uploading.
// The passphrase itself is NEVER stored. On a fresh device the salt is recovered
// from the downloaded envelope instead (see crypto/envelope.ts extractSalt).
export interface KdfSecret {
  salt: Uint8Array;
  verifier: Uint8Array;
}

// SecureStore keys must be alphanumeric/._- ; uuids contain hyphens which are fine.
const keyFor = (userId: string) => `backup_kdf_${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;

export async function loadKdfSecret(userId: string): Promise<KdfSecret | null> {
  const raw = await SecureStore.getItemAsync(keyFor(userId));
  if (!raw) return null;
  try {
    const { salt, verifier } = JSON.parse(raw) as { salt: string; verifier: string };
    return { salt: hexToBytes(salt), verifier: hexToBytes(verifier) };
  } catch {
    return null;
  }
}

export async function saveKdfSecret(userId: string, secret: KdfSecret): Promise<void> {
  const payload = JSON.stringify({
    salt: bytesToHex(secret.salt),
    verifier: bytesToHex(secret.verifier),
  });
  await SecureStore.setItemAsync(keyFor(userId), payload);
}

export async function clearKdfSecret(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(userId));
}
