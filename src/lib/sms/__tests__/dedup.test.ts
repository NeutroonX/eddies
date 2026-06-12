import { dedupHash, dedupKey } from '../dedup';

const base = {
  amount_minor: 50000,
  occurred_at: Date.UTC(2026, 5, 12, 9, 30, 0),
  account_tail: '1234',
  ref_id: '102938475612',
  kind: 'outflow' as const,
};

describe('dedupKey / dedupHash', () => {
  it('is deterministic for the same input', () => {
    expect(dedupHash(base)).toBe(dedupHash({ ...base }));
  });

  it('keys on ref_id when present (ignores time/amount drift)', () => {
    const a = dedupHash(base);
    const b = dedupHash({ ...base, amount_minor: 99999, occurred_at: base.occurred_at + 10 * 60_000 });
    expect(b).toBe(a);
  });

  it('different ref_id → different hash', () => {
    expect(dedupHash({ ...base, ref_id: '999' + base.ref_id })).not.toBe(dedupHash(base));
  });

  it('falls back to amount+tail+time bucket when no ref_id', () => {
    const noRef = { ...base, ref_id: null };
    // within the same minute bucket → identical
    expect(dedupHash({ ...noRef, occurred_at: noRef.occurred_at + 30_000 })).toBe(dedupHash(noRef));
    // different amount → different
    expect(dedupHash({ ...noRef, amount_minor: 60000 })).not.toBe(dedupHash(noRef));
    // different account tail → different
    expect(dedupHash({ ...noRef, account_tail: '5678' })).not.toBe(dedupHash(noRef));
  });

  it('same amount but opposite direction → different hash', () => {
    const noRef = { ...base, ref_id: null };
    expect(dedupHash({ ...noRef, kind: 'inflow' })).not.toBe(dedupHash(noRef));
  });

  it('produces a stable-width hex string', () => {
    expect(dedupHash(base)).toMatch(/^[0-9a-f]{8}$/);
    expect(dedupKey(base)).toContain('ref:');
  });
});
