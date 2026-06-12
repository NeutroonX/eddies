/** Pure presentation helpers for recurring rules (no DB, no I/O). */
import type { RecurringRule } from '@/lib/schemas';
import { nextOccurrence } from '@/lib/recurring/schedule';

const FREQ_NOUN: Record<RecurringRule['freq'], string> = {
  daily: 'DAY',
  weekly: 'WEEK',
  monthly: 'MONTH',
  yearly: 'YEAR',
};

/** Short uppercase cadence label, e.g. "MONTHLY · DAY 1", "EVERY 2 WEEKS". */
export function scheduleSummary(rule: Pick<RecurringRule, 'freq' | 'interval_n' | 'anchor_day'>): string {
  const noun = FREQ_NOUN[rule.freq];
  const base =
    rule.interval_n === 1
      ? { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[rule.freq]
      : `EVERY ${rule.interval_n} ${noun}S`;
  if (rule.freq === 'monthly' && rule.anchor_day != null) {
    return `${base} · DAY ${rule.anchor_day}`;
  }
  return base;
}

/**
 * Approximate monthly cost in minor units (always positive magnitude).
 * Used to compare rules at a common cadence in the list.
 */
export function monthlyEquivalentMinor(
  rule: Pick<RecurringRule, 'freq' | 'interval_n' | 'amount_minor'>
): number {
  const perInterval = rule.amount_minor;
  switch (rule.freq) {
    case 'daily':
      return Math.round((perInterval * 30.437) / rule.interval_n);
    case 'weekly':
      return Math.round((perInterval * 4.348) / rule.interval_n);
    case 'monthly':
      return Math.round(perInterval / rule.interval_n);
    case 'yearly':
      return Math.round(perInterval / (12 * rule.interval_n));
  }
}

/** Next occurrence strictly after now, or null if the rule has ended. */
export function nextRunAt(rule: RecurringRule, now: number = Date.now()): number | null {
  // Never run before the watermark; otherwise from now.
  const after = Math.max(now, rule.last_run_at ?? rule.start_date - 1);
  return nextOccurrence(rule, after);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Short uppercase run date, e.g. "12 JUN". Returns "ENDED" for null. When the
 * date falls in a future year, the year is appended ("12 JUN '27") so a yearly
 * rule's next run is never ambiguous.
 */
export function formatRunDate(ms: number | null, now: number = Date.now()): string {
  if (ms === null) return 'ENDED';
  const d = new Date(ms);
  const base = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() !== new Date(now).getFullYear()
    ? `${base} '${String(d.getFullYear()).slice(-2)}`
    : base;
}
