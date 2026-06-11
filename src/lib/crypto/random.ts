import * as Crypto from 'expo-crypto';

// Secure random bytes. Prefers expo-crypto's native CSPRNG on device; falls back
// to the WebCrypto RNG (present in the jest/node test runtime) so the crypto
// layer is unit-testable without native modules.
export function randomBytes(n: number): Uint8Array {
  try {
    const b = Crypto.getRandomBytes(n);
    if (b && b.length === n) return b instanceof Uint8Array ? b : Uint8Array.from(b);
  } catch {
    // fall through to WebCrypto
  }
  const g = (globalThis as { crypto?: Crypto_ }).crypto;
  if (g?.getRandomValues) return g.getRandomValues(new Uint8Array(n));
  throw new Error('No secure random source available.');
}

type Crypto_ = { getRandomValues<T extends ArrayBufferView>(a: T): T };
