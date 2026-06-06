import {
  toMinorUnits,
  fromMinorUnits,
  formatAmount,
  formatAmountTabular,
  addMinorUnits,
  subtractMinorUnits,
  isPositive,
} from '../money';

describe('toMinorUnits', () => {
  it('converts whole dollars', () => expect(toMinorUnits(5)).toBe(500));
  it('converts cents', () => expect(toMinorUnits(5.99)).toBe(599));
  // IEEE 754: 1.005 * 100 === 100.49999..., so rounds down to 100 not 101.
  it('rounds floating-point noise (IEEE 754 floor case)', () => expect(toMinorUnits(1.005)).toBe(100));
  it('handles zero', () => expect(toMinorUnits(0)).toBe(0));
});

describe('fromMinorUnits', () => {
  it('converts cents to dollars', () => expect(fromMinorUnits(599)).toBe(5.99));
  it('handles zero', () => expect(fromMinorUnits(0)).toBe(0));
  it('round-trips with toMinorUnits', () => {
    expect(fromMinorUnits(toMinorUnits(12.50))).toBe(12.50);
  });
});

describe('formatAmountTabular', () => {
  it('formats with two decimals', () => expect(formatAmountTabular(100)).toBe('1.00'));
  it('adds thousands separator', () => expect(formatAmountTabular(1_000_00)).toBe('1,000.00'));
  it('handles absolute value for negatives', () => expect(formatAmountTabular(-500)).toBe('5.00'));
  it('formats large amount', () => expect(formatAmountTabular(1_234_567_89)).toBe('1,234,567.89'));
});

describe('addMinorUnits / subtractMinorUnits', () => {
  it('adds correctly', () => expect(addMinorUnits(100, 200)).toBe(300));
  it('subtracts correctly', () => expect(subtractMinorUnits(500, 200)).toBe(300));
  it('subtract can go negative', () => expect(subtractMinorUnits(100, 300)).toBe(-200));
});

describe('isPositive', () => {
  it('returns true for positive', () => expect(isPositive(1)).toBe(true));
  it('returns false for zero', () => expect(isPositive(0)).toBe(false));
  it('returns false for negative', () => expect(isPositive(-1)).toBe(false));
});
