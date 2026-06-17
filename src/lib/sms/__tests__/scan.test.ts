import type { SQLiteDatabase } from 'expo-sqlite';

import { trackEvent } from '@/lib/telemetry';

import { buildPendingFromParsed, ingestRawSms, scanSms } from '../scan';
import { MockSmsReader } from '../reader';
import { dedupHash } from '../dedup';
import { insertManyPending } from '@/lib/db/repos/pending-imports';
import type { ParsedSms, RawSms } from '../parser';

// Stateful in-memory settings store so the watermark round-trips. The `mock`
// prefix lets the hoisted jest.mock factory reference it.
const mockSettings: Record<string, string> = {};

// ingestRawSms touches the suggestion repos, the pending-imports insert, and
// telemetry. Mock those so the test exercises the real parse + dedup pass only.
jest.mock('@/lib/sms/merchant-learning', () => ({
  suggestAccount: jest.fn(async () => null),
  suggestCategory: jest.fn(async () => null),
}));
jest.mock('@/lib/telemetry', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/db/repos/pending-imports', () => ({
  // Mirror the real UNIQUE(dedup_hash) index: duplicate hashes collapse.
  insertManyPending: jest.fn(
    async (_db: unknown, rows: { dedup_hash: string }[]) =>
      new Set(rows.map((r) => r.dedup_hash)).size
  ),
}));
jest.mock('@/lib/db/repos/settings-repo', () => ({
  getSetting: jest.fn(async (_db: unknown, key: string) => mockSettings[key] ?? null),
  setSetting: jest.fn(async (_db: unknown, key: string, val: string) => {
    mockSettings[key] = val;
  }),
}));

const parsed: ParsedSms = {
  amount_minor: 50000,
  kind: 'outflow',
  merchant: 'SWIGGY',
  account_tail: '1234',
  ref_id: '102938475612',
  occurred_at: Date.UTC(2026, 5, 12, 9, 30, 0),
  bank_hint: 'HDFC',
  confidence: 0.93,
  raw_excerpt: 'Rs.500.00 debited ...',
};

describe('buildPendingFromParsed', () => {
  it('maps parsed fields + suggestions into a pending_imports row', () => {
    const row = buildPendingFromParsed(parsed, { accountId: 'acc_1', categoryId: 'cat_food' });
    expect(row.origin).toBe('sms');
    expect(row.amount_minor).toBe(50000);
    expect(row.kind).toBe('outflow');
    expect(row.suggested_account_id).toBe('acc_1');
    expect(row.suggested_category_id).toBe('cat_food');
    expect(row.merchant).toBe('SWIGGY');
    expect(row.note).toBe('SWIGGY');
    expect(row.confidence).toBe(0.93);
    expect(row.recurring_rule_id).toBeNull();
    expect(row.dedup_hash).toBe(dedupHash(parsed));
  });

  it('passes through null suggestions', () => {
    const row = buildPendingFromParsed(parsed, { accountId: null, categoryId: null });
    expect(row.suggested_account_id).toBeNull();
    expect(row.suggested_category_id).toBeNull();
  });
});

describe('ingestRawSms (push path)', () => {
  const db = {} as unknown as SQLiteDatabase;
  const T = Date.UTC(2026, 5, 12, 9, 30, 0);
  const sms = (address: string, body: string, date = T): RawSms => ({ address, body, date });

  const debit = sms(
    'VM-HDFCBK',
    'Rs.500.00 debited from a/c **1234 on 12-06-26 to VPA merchant@okhdfcbank Ref 102938475612. Avl Bal Rs.4500.00 -HDFC Bank'
  );

  beforeEach(() => jest.clearAllMocks());

  it('counts scanned, parsed, and inserted; skips non-transactional messages', async () => {
    const res = await ingestRawSms(db, [
      debit,
      sms('VM-HDFCBK', '123456 is your OTP for txn of Rs.500 at AMAZON. Do not share. -HDFC'),
      sms('AD-SBIINB', 'Get 10% discount! Spend Rs.2000 and win cashback. Apply now -SBI'),
      sms('VM-HDFCBK', 'Avl Bal in A/c XX1234 is Rs.4500.00 as on 12-06-26 -HDFC'),
    ]);
    expect(res).toEqual({ scanned: 4, parsed: 1, inserted: 1 });
  });

  it('dedups identical messages within a batch (UNIQUE dedup_hash)', async () => {
    const res = await ingestRawSms(db, [debit, debit]);
    expect(res.parsed).toBe(2);
    expect(res.inserted).toBe(1);
  });

  it('returns zeros for an empty batch without inserting', async () => {
    const res = await ingestRawSms(db, []);
    expect(res).toEqual({ scanned: 0, parsed: 0, inserted: 0 });
    expect(insertManyPending).not.toHaveBeenCalled();
  });

  it('tags telemetry with the source (default pull)', async () => {
    await ingestRawSms(db, [debit], { source: 'push' });
    expect(trackEvent).toHaveBeenCalledWith(
      'sms_scan_completed',
      expect.objectContaining({ push: true })
    );

    jest.clearAllMocks();
    await ingestRawSms(db, [debit]);
    expect(trackEvent).toHaveBeenCalledWith(
      'sms_scan_completed',
      expect.objectContaining({ push: false })
    );
  });

  it('produces the same dedup_hash a pull-path scan would (cross-path dedup)', () => {
    // The dedup key is derived purely from parsed fields, so a message ingested
    // via the push path collides with the same message read via the pull path.
    const parsedFromShare = buildPendingFromParsed(parsed, { accountId: null, categoryId: null });
    expect(parsedFromShare.dedup_hash).toBe(dedupHash(parsed));
  });
});

describe('scanSms (pull path)', () => {
  const db = {} as unknown as SQLiteDatabase;

  beforeEach(() => {
    for (const k of Object.keys(mockSettings)) delete mockSettings[k];
    jest.clearAllMocks();
  });

  it('advances the watermark to the newest message even when none parse', async () => {
    const newest = Date.UTC(2026, 5, 13, 0, 0, 0);
    const reader = new MockSmsReader([
      { address: 'X', body: 'this is not a transaction', date: newest },
    ]);
    const res = await scanSms(db, reader, { now: newest });
    expect(res.parsed).toBe(0);
    expect(mockSettings['last_sms_scan_at']).toBe(String(newest));
  });

  it('reads nothing and writes no watermark when permission is not granted', async () => {
    const reader = new MockSmsReader([], false);
    const res = await scanSms(db, reader);
    expect(res).toEqual({ scanned: 0, parsed: 0, inserted: 0 });
    expect(mockSettings['last_sms_scan_at']).toBeUndefined();
    expect(insertManyPending).not.toHaveBeenCalled();
  });
});
