/**
 * Pure recurrence engine. No DB, no I/O — fully unit-testable.
 *
 * `start_date` IS the first occurrence (index 0). Subsequent occurrences step
 * by `freq × interval_n` using LOCAL calendar fields, so DST shifts never drift
 * the wall-clock time and month/year overflows clamp to the last valid day
 * (e.g. monthly anchored on the 31st → Feb 28/29).
 */
import type { RecurringRule } from '@/lib/schemas';

/** Fields the engine needs — a subset of RecurringRule, so tests can pass plain objects. */
export type ScheduleSpec = Pick<
  RecurringRule,
  'freq' | 'interval_n' | 'anchor_day' | 'start_date' | 'end_kind' | 'end_date' | 'end_count'
>;

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of next month = last day of this month.
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Epoch ms of the k-th occurrence (k ≥ 0), preserving start's time-of-day. */
export function occurrenceAt(spec: ScheduleSpec, k: number): number {
  const s = new Date(spec.start_date);
  const y = s.getFullYear();
  const mo = s.getMonth();
  const d = s.getDate();
  const h = s.getHours();
  const mi = s.getMinutes();
  const se = s.getSeconds();
  const ms = s.getMilliseconds();
  const step = spec.interval_n;

  switch (spec.freq) {
    case 'daily':
      return new Date(y, mo, d + k * step, h, mi, se, ms).getTime();
    case 'weekly':
      return new Date(y, mo, d + k * step * 7, h, mi, se, ms).getTime();
    case 'monthly': {
      // Normalize the absolute month, then clamp the day to that month's length.
      const totalMonths = mo + k * step;
      const ty = y + Math.floor(totalMonths / 12);
      const tm = ((totalMonths % 12) + 12) % 12;
      const desiredDay = spec.anchor_day ?? d;
      const day = Math.min(desiredDay, daysInMonth(ty, tm));
      return new Date(ty, tm, day, h, mi, se, ms).getTime();
    }
    case 'yearly': {
      const ty = y + k * step;
      const day = Math.min(d, daysInMonth(ty, mo)); // Feb 29 → Feb 28 on common years
      return new Date(ty, mo, day, h, mi, se, ms).getTime();
    }
  }
}

/** True once index k is past the rule's end condition (no occurrence exists). */
function endReached(spec: ScheduleSpec, k: number, ts: number): boolean {
  if (spec.end_kind === 'after_n') return spec.end_count != null && k >= spec.end_count;
  if (spec.end_kind === 'on_date') return spec.end_date != null && ts > spec.end_date;
  return false;
}

/** Rough occurrence index for time `t`, used to skip ahead instead of scanning from 0. */
function approxIndex(spec: ScheduleSpec, t: number): number {
  if (t <= spec.start_date) return 0;
  const s = new Date(spec.start_date);
  const e = new Date(t);
  let k: number;
  switch (spec.freq) {
    case 'daily':
      k = (t - spec.start_date) / (86400000 * spec.interval_n);
      break;
    case 'weekly':
      k = (t - spec.start_date) / (86400000 * 7 * spec.interval_n);
      break;
    case 'monthly':
      k = (e.getFullYear() * 12 + e.getMonth() - (s.getFullYear() * 12 + s.getMonth())) / spec.interval_n;
      break;
    case 'yearly':
      k = (e.getFullYear() - s.getFullYear()) / spec.interval_n;
      break;
  }
  return Math.max(0, Math.floor(k) - 1);
}

/**
 * Smallest occurrence strictly after `after` (epoch ms), or null if the rule
 * has ended. Pass `after = start_date - 1` to include the first occurrence.
 */
export function nextOccurrence(spec: ScheduleSpec, after: number): number | null {
  let k = approxIndex(spec, after);
  // Back up in case the estimate overshot.
  while (k > 0 && occurrenceAt(spec, k - 1) > after) k--;
  for (let guard = 0; guard < 10000; guard++, k++) {
    const ts = occurrenceAt(spec, k);
    if (endReached(spec, k, ts)) return null;
    if (ts > after) return ts;
  }
  return null;
}

/**
 * All occurrences in the half-open window (fromExclusive, toInclusive], in
 * ascending order, respecting the rule's end condition. `cap` bounds the result
 * to avoid pathological catch-up after the app has been closed for a long time.
 */
export function occurrencesBetween(
  spec: ScheduleSpec,
  fromExclusive: number,
  toInclusive: number,
  cap = 1000
): number[] {
  const out: number[] = [];
  if (toInclusive <= fromExclusive) return out;
  let k = approxIndex(spec, fromExclusive);
  while (k > 0 && occurrenceAt(spec, k - 1) > fromExclusive) k--;
  for (let guard = 0; guard < 100000 && out.length < cap; guard++, k++) {
    const ts = occurrenceAt(spec, k);
    if (endReached(spec, k, ts)) break;
    if (ts > toInclusive) break;
    if (ts > fromExclusive) out.push(ts);
  }
  return out;
}
