import {
  occurrenceAt,
  nextOccurrence,
  occurrencesBetween,
  type ScheduleSpec,
} from '../recurring/schedule';

const at = (y: number, mo: number, d: number, h = 9) => new Date(y, mo, d, h, 0, 0, 0).getTime();
const dayOf = (ts: number) => new Date(ts).getDate();
const monthOf = (ts: number) => new Date(ts).getMonth();

function spec(over: Partial<ScheduleSpec>): ScheduleSpec {
  return {
    freq: 'monthly',
    interval_n: 1,
    anchor_day: null,
    start_date: at(2026, 0, 1),
    end_kind: 'never',
    end_date: null,
    end_count: null,
    ...over,
  };
}

describe('occurrenceAt — daily', () => {
  const s = spec({ freq: 'daily', interval_n: 3, start_date: at(2026, 0, 1) });
  it('index 0 is start', () => expect(occurrenceAt(s, 0)).toBe(at(2026, 0, 1)));
  it('steps by interval days', () => expect(occurrenceAt(s, 2)).toBe(at(2026, 0, 7)));
  it('preserves time-of-day', () =>
    expect(new Date(occurrenceAt(s, 5)).getHours()).toBe(9));
});

describe('occurrenceAt — weekly', () => {
  const s = spec({ freq: 'weekly', interval_n: 2, start_date: at(2026, 0, 5) });
  it('steps by interval weeks', () => expect(occurrenceAt(s, 1)).toBe(at(2026, 0, 19)));
  it('keeps the same weekday', () =>
    expect(new Date(occurrenceAt(s, 3)).getDay()).toBe(new Date(at(2026, 0, 5)).getDay()));
});

describe('occurrenceAt — monthly with day clamp', () => {
  const s = spec({ freq: 'monthly', anchor_day: 31, start_date: at(2026, 0, 31) });
  it('Jan 31 stays 31', () => expect(dayOf(occurrenceAt(s, 0))).toBe(31));
  it('Feb clamps to 28 (2026 common year)', () => {
    const feb = occurrenceAt(s, 1);
    expect(monthOf(feb)).toBe(1);
    expect(dayOf(feb)).toBe(28);
  });
  it('Mar returns to 31', () => expect(dayOf(occurrenceAt(s, 2))).toBe(31));
  it('rolls into next year', () => {
    const ts = occurrenceAt(s, 12);
    expect(new Date(ts).getFullYear()).toBe(2027);
    expect(monthOf(ts)).toBe(0);
  });
  it('occurrences are strictly increasing despite clamping', () => {
    for (let k = 1; k < 24; k++) {
      expect(occurrenceAt(s, k)).toBeGreaterThan(occurrenceAt(s, k - 1));
    }
  });
});

describe('occurrenceAt — monthly with interval', () => {
  const s = spec({ freq: 'monthly', interval_n: 3, start_date: at(2026, 0, 15) });
  it('jumps 3 months', () => {
    const ts = occurrenceAt(s, 1);
    expect(monthOf(ts)).toBe(3);
    expect(dayOf(ts)).toBe(15);
  });
});

describe('occurrenceAt — yearly Feb 29', () => {
  // 2024 is a leap year.
  const s = spec({ freq: 'yearly', start_date: at(2024, 1, 29) });
  it('leap-year start keeps Feb 29', () => expect(dayOf(occurrenceAt(s, 0))).toBe(29));
  it('clamps to Feb 28 on common years', () => {
    const ts = occurrenceAt(s, 1); // 2025
    expect(monthOf(ts)).toBe(1);
    expect(dayOf(ts)).toBe(28);
  });
  it('returns to Feb 29 on the next leap year', () =>
    expect(dayOf(occurrenceAt(s, 4))).toBe(29)); // 2028
});

describe('nextOccurrence', () => {
  const s = spec({ freq: 'monthly', anchor_day: 1, start_date: at(2026, 0, 1) });
  it('start_date - 1 yields the first occurrence', () =>
    expect(nextOccurrence(s, s.start_date - 1)).toBe(at(2026, 0, 1)));
  it('is strictly after the cursor', () =>
    expect(nextOccurrence(s, at(2026, 0, 1))).toBe(at(2026, 1, 1)));
  it('skips ahead efficiently for a far cursor', () =>
    expect(nextOccurrence(s, at(2026, 5, 15))).toBe(at(2026, 6, 1)));
  it('returns null once after_n is exhausted', () => {
    const ended = spec({ freq: 'monthly', anchor_day: 1, end_kind: 'after_n', end_count: 3 });
    expect(nextOccurrence(ended, at(2026, 2, 1))).toBeNull(); // 3 made (Jan,Feb,Mar), none after Mar
  });
  it('returns null past an on_date end', () => {
    const ended = spec({ end_kind: 'on_date', end_date: at(2026, 2, 1) });
    expect(nextOccurrence(ended, at(2026, 2, 2))).toBeNull();
  });
});

describe('occurrencesBetween', () => {
  const s = spec({ freq: 'monthly', anchor_day: 1, start_date: at(2026, 0, 1) });

  it('returns occurrences in the half-open window', () => {
    const out = occurrencesBetween(s, at(2026, 0, 1), at(2026, 3, 1));
    // (Jan 1 exclusive, Apr 1 inclusive] => Feb 1, Mar 1, Apr 1
    expect(out).toEqual([at(2026, 1, 1), at(2026, 2, 1), at(2026, 3, 1)]);
  });

  it('includes the lower bound only when strictly greater', () => {
    const out = occurrencesBetween(s, at(2026, 0, 1) - 1, at(2026, 0, 1));
    expect(out).toEqual([at(2026, 0, 1)]);
  });

  it('returns empty when window is inverted or empty', () => {
    expect(occurrencesBetween(s, at(2026, 5, 1), at(2026, 2, 1))).toEqual([]);
  });

  it('respects after_n across the window', () => {
    const ended = spec({ freq: 'monthly', anchor_day: 1, end_kind: 'after_n', end_count: 2 });
    const out = occurrencesBetween(ended, at(2025, 11, 1), at(2026, 11, 1));
    expect(out).toEqual([at(2026, 0, 1), at(2026, 1, 1)]); // only 2 ever exist
  });

  it('caps catch-up to avoid pathological loops', () => {
    const daily = spec({ freq: 'daily', interval_n: 1, start_date: at(2020, 0, 1) });
    const out = occurrencesBetween(daily, at(2020, 0, 1), at(2026, 0, 1), 60);
    expect(out.length).toBe(60);
  });

  it('is idempotent: re-running the same window past the watermark yields none', () => {
    const now = at(2026, 3, 1);
    const first = occurrencesBetween(s, s.start_date - 1, now);
    const watermark = first[first.length - 1];
    const second = occurrencesBetween(s, watermark, now);
    expect(second).toEqual([]);
  });
});
