/**
 * SMS scan orchestration: read → parse → suggest → enqueue into pending_imports.
 *
 * Two entry points share one pass:
 *   - backfill: first enable reads the last BACKFILL_DAYS of SMS.
 *   - incremental: on app focus, reads only messages newer than the watermark.
 *
 * Idempotent end-to-end — the parser is pure, dedup_hash + the UNIQUE index drop
 * duplicates, and the watermark advances so re-scans do no work. Raw SMS text
 * never leaves the device (only a short raw_excerpt is stored locally).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertManyPending } from '@/lib/db/repos/pending-imports';
import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';
import { dedupHash } from '@/lib/sms/dedup';
import { suggestAccount, suggestCategory } from '@/lib/sms/merchant-learning';
import { parseSms, type ParsedSms } from '@/lib/sms/parser';
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

  const rows: NewPendingImport[] = [];
  let maxDate = sinceMs;
  for (const m of messages) {
    if (m.date > maxDate) maxDate = m.date;
    const parsed = parseSms(m);
    if (!parsed) continue;
    const [accountId, categoryId] = await Promise.all([
      suggestAccount(db, parsed.account_tail),
      suggestCategory(db, parsed.merchant),
    ]);
    rows.push(buildPendingFromParsed(parsed, { accountId, categoryId }));
  }

  const inserted = rows.length > 0 ? await insertManyPending(db, rows) : 0;
  await setSetting(db, WATERMARK_KEY, String(maxDate));

  trackEvent('sms_scan_completed', {
    scanned: messages.length,
    parsed: rows.length,
    inserted,
  });

  return { scanned: messages.length, parsed: rows.length, inserted };
}
