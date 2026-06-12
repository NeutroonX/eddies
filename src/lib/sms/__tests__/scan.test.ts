import { buildPendingFromParsed } from '../scan';
import { dedupHash } from '../dedup';
import type { ParsedSms } from '../parser';

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
