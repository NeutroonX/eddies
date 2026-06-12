/**
 * Deterministic de-duplication key for parsed SMS.
 *
 * The `pending_imports.dedup_hash` UNIQUE index uses this so that re-scanning the
 * same inbox never enqueues a transaction twice. When the bank provides a
 * reference id we key on that (globally unique per txn); otherwise we fall back
 * to amount + account tail + a coarse time bucket, which is stable across
 * re-scans of the same message while tolerating minor reader timestamp jitter.
 */
import type { ParsedSms } from '@/lib/sms/parser';

// Round occurred_at to the minute so reader jitter doesn't defeat the fallback key.
const BUCKET_MS = 60_000;

/** djb2 — small, fast, dependency-free, sufficient for collision-resistant keys. */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 coerces to unsigned 32-bit; pad for a stable-width hex string.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function dedupKey(parsed: Pick<ParsedSms, 'amount_minor' | 'occurred_at' | 'account_tail' | 'ref_id' | 'kind'>): string {
  if (parsed.ref_id) {
    return `ref:${parsed.kind}:${parsed.ref_id.toLowerCase()}`;
  }
  const bucket = Math.floor(parsed.occurred_at / BUCKET_MS);
  return `v:${parsed.kind}:${parsed.amount_minor}:${parsed.account_tail ?? '?'}:${bucket}`;
}

export function dedupHash(parsed: Parameters<typeof dedupKey>[0]): string {
  return djb2(dedupKey(parsed));
}
