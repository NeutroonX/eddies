/**
 * SMS ingest orchestration: parse → suggest → enqueue into pending_imports.
 *
 * Two entry points share one pass (`ingestRawSms`):
 *   - pull (`scanSms`): internal builds read the inbox via a READ_SMS reader,
 *     with a BACKFILL_DAYS first scan and a watermark for incremental re-scans.
 *   - push (`ingestRawSms` directly): Play-compliant builds feed messages the
 *     user shares into the app — no history, no watermark.
 *
 * Idempotent end-to-end — the parser is pure, dedup_hash + the UNIQUE index drop
 * duplicates across both paths. Raw SMS text never leaves the device (only a
 * short raw_excerpt is stored locally).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertManyPending } from '@/lib/db/repos/pending-imports';
import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';
import { dedupHash } from '@/lib/sms/dedup';
import { suggestAccount, suggestCategory } from '@/lib/sms/merchant-learning';
import { parseSms, type ParsedSms, type RawSms } from '@/lib/sms/parser';
import type { SmsReader } from '@/lib/sms/reader';
import type { NewPendingImport } from '@/lib/schemas';
import { trackEvent } from '@/lib/telemetry';

const WATERMARK_KEY = 'last_sms_scan_at';
const BACKFILL_DAYS = 90;
const MAX_SCAN = 500; // cap first-scan render/parse work

export type ScanResult = {
  scanned: number; // raw messages read
  parsed: number; // recognized as transactions
  inserted: number; // new rows after dedup
};

type Suggestions = { accountId: string | null; categoryId: string | null };

/**
 * Pure mapping from a parsed SMS + suggestions to a pending_imports row.
 * Separated out so it can be unit-tested without a database.
 */
export function buildPendingFromParsed(
  parsed: ParsedSms,
  suggestions: Suggestions
): NewPendingImport {
  return {
    origin: 'sms',
    amount_minor: parsed.amount_minor,
    kind: parsed.kind,
    suggested_account_id: suggestions.accountId,
    suggested_category_id: suggestions.categoryId,
    merchant: parsed.merchant,
    note: parsed.merchant,
    occurred_at: parsed.occurred_at,
    raw_excerpt: parsed.raw_excerpt,
    dedup_hash: dedupHash(parsed),
    confidence: parsed.confidence,
    recurring_rule_id: null,
  };
}

/**
 * Shared parse → suggest → dedup → insert pass over a batch of raw messages.
 * Both entry points funnel through here so dedup (dedup_hash + UNIQUE index)
 * holds identically across the pull and push paths. No watermark logic lives
 * here — the push path (share sheet) has no history to watermark.
 */
export async function ingestRawSms(
  db: SQLiteDatabase,
  messages: RawSms[],
  opts: { source?: 'pull' | 'push' } = {}
): Promise<ScanResult> {
  // Parse is pure/synchronous; do it up front, then run every message's two
  // suggestion lookups concurrently rather than serialising 500 messages on a
  // first-scan backfill (~1k sequential DB round-trips). dedup/order are
  // unaffected — insertManyPending handles dedup across the whole batch.
  const parsedBatch = messages
    .map(parseSms)
    .filter((p): p is ParsedSms => p !== null);
  const rows = await Promise.all(
    parsedBatch.map(async (parsed) => {
      const [accountId, categoryId] = await Promise.all([
        suggestAccount(db, parsed.account_tail),
        suggestCategory(db, parsed.merchant),
      ]);
      return buildPendingFromParsed(parsed, { accountId, categoryId });
    })
  );

  const inserted = rows.length > 0 ? await insertManyPending(db, rows) : 0;

  trackEvent('sms_scan_completed', {
    scanned: messages.length,
    parsed: rows.length,
    inserted,
    // string event values aren't allowed; flag the push path as a boolean.
    push: (opts.source ?? 'pull') === 'push',
  });

  return { scanned: messages.length, parsed: rows.length, inserted };
}

export async function scanSms(
  db: SQLiteDatabase,
  reader: SmsReader,
  opts: { now?: number } = {}
): Promise<ScanResult> {
  const now = opts.now ?? Date.now();
  if (!reader.isSupported() || !(await reader.hasPermission())) {
    return { scanned: 0, parsed: 0, inserted: 0 };
  }

  const watermarkRaw = await getSetting(db, WATERMARK_KEY);
  const sinceMs = watermarkRaw
    ? Number(watermarkRaw)
    : now - BACKFILL_DAYS * 24 * 60 * 60 * 1000;

  const messages = await reader.list({ sinceMs, maxCount: MAX_SCAN });

  // Advance the watermark to the newest message read, even if none parse, so
  // re-scans never re-walk the same window.
  let maxDate = sinceMs;
  for (const m of messages) {
    if (m.date > maxDate) maxDate = m.date;
  }

  const result = await ingestRawSms(db, messages, { source: 'pull' });
  await setSetting(db, WATERMARK_KEY, String(maxDate));

  return result;
}
