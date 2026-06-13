/**
 * Subscription radar (Beta v2 Tier 2 §6.2).
 *
 * Detects recurring, near-same-amount outflows (monthly / annual cadence) by
 * grouping `transactions` on their normalized note (which is where an accepted
 * SMS import stores the merchant). Purely derived — no new tables. Dismissed
 * suggestions live in the existing `settings` key/value table (this project has
 * no MMKV), mirroring src/lib/sms/merchant-learning.ts.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';

export type SubscriptionCadence = 'monthly' | 'yearly';

export type Subscription = {
  /** Normalized note — stable identity used for dismiss + dedup. */
  key: string;
  /** Display name (original-case note of the most recent charge). */
  label: string;
  /** Representative (median) charge in minor units. */
  amountMinor: number;
  /** Monthly-equivalent cost, for the header total. */
  monthlyEquivMinor: number;
  cadence: SubscriptionCadence;
  lastChargedAt: number;
  occurrences: number;
  /** Most-frequent category among the group's charges, for rule prefill. */
  categoryId: string | null;
  /** Account of the most recent charge, for rule prefill. */
  accountId: string | null;
};

// ── Tuning constants ─────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;
// Two years back: enough to surface a yearly charge with two occurrences, and
// keeps monthly grouping anchored to recent behaviour.
const LOOKBACK_MS = 730 * DAY_MS;
// A subscription needs at least one cadence gap to infer a rhythm.
const MIN_OCCURRENCES = 2;
// Charges must be near-same — rejects variable merchants (food delivery, fuel).
const AMOUNT_TOLERANCE = 0.25;
// Cadence bands on the median inter-charge gap, in days.
const MONTHLY_MIN = 26, MONTHLY_MAX = 35;
const YEARLY_MIN = 350, YEARLY_MAX = 380;

const IGNORED_KEY = 'subscriptions_ignored';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const StringArraySchema = z.array(z.string());

/** Set of normalized keys the user has dismissed from the radar. */
export async function getIgnoredSubscriptions(db: SQLiteDatabase): Promise<Set<string>> {
  const raw = await getSetting(db, IGNORED_KEY);
  if (!raw) return new Set();
  try {
    const parsed = StringArraySchema.safeParse(JSON.parse(raw));
    return new Set(parsed.success ? parsed.data : []);
  } catch {
    return new Set();
  }
}

/** Dismiss a subscription suggestion so it no longer surfaces in the radar. */
export async function ignoreSubscription(db: SQLiteDatabase, key: string): Promise<void> {
  const set = await getIgnoredSubscriptions(db);
  set.add(key);
  await setSetting(db, IGNORED_KEY, JSON.stringify([...set]));
}

type Charge = {
  note: string;
  amount_minor: number;
  occurred_at: number;
  category_id: string | null;
  account_id: string | null;
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function classifyCadence(medianGapDays: number): SubscriptionCadence | null {
  if (medianGapDays >= MONTHLY_MIN && medianGapDays <= MONTHLY_MAX) return 'monthly';
  if (medianGapDays >= YEARLY_MIN && medianGapDays <= YEARLY_MAX) return 'yearly';
  return null;
}

function mostFrequent<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) { bestN = n; best = v; }
  }
  return best;
}

/**
 * Analyse outflow history and return detected subscriptions, sorted by monthly
 * cost descending. Dismissed keys are excluded.
 */
export async function detectSubscriptions(
  db: SQLiteDatabase,
  now: number = Date.now()
): Promise<Subscription[]> {
  const sinceMs = now - LOOKBACK_MS;
  const rows = await db.getAllAsync<Charge>(
    `SELECT note, amount_minor, occurred_at, category_id, account_id
       FROM transactions
      WHERE kind = 'outflow'
        AND transfer_group_id IS NULL
        AND note IS NOT NULL AND TRIM(note) != ''
        AND occurred_at >= ?
      ORDER BY occurred_at ASC`,
    sinceMs
  );

  const ignored = await getIgnoredSubscriptions(db);

  // Group charges by normalized note.
  const groups = new Map<string, Charge[]>();
  for (const r of rows) {
    const key = norm(r.note);
    if (!key || ignored.has(key)) continue;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const subs: Subscription[] = [];
  for (const [key, charges] of groups) {
    if (charges.length < MIN_OCCURRENCES) continue;

    // Near-same amount: every charge within tolerance of the median.
    const amounts = charges.map((c) => c.amount_minor);
    const medAmount = median([...amounts].sort((a, b) => a - b));
    if (medAmount <= 0) continue;
    const consistent = amounts.every(
      (a) => Math.abs(a - medAmount) / medAmount <= AMOUNT_TOLERANCE
    );
    if (!consistent) continue;

    // Cadence from the median gap between consecutive charges (already ascending).
    const gaps: number[] = [];
    for (let i = 1; i < charges.length; i++) {
      gaps.push((charges[i].occurred_at - charges[i - 1].occurred_at) / DAY_MS);
    }
    const medGapDays = median([...gaps].sort((a, b) => a - b));
    const cadence = classifyCadence(medGapDays);
    if (!cadence) continue;

    const last = charges[charges.length - 1];
    const monthlyEquivMinor = cadence === 'monthly' ? medAmount : Math.round(medAmount / 12);

    subs.push({
      key,
      label: last.note.trim(),
      amountMinor: medAmount,
      monthlyEquivMinor,
      cadence,
      lastChargedAt: last.occurred_at,
      occurrences: charges.length,
      categoryId: mostFrequent(charges.map((c) => c.category_id)),
      accountId: last.account_id,
    });
  }

  return subs.sort((a, b) => b.monthlyEquivMinor - a.monthlyEquivMinor);
}

/** Total monthly-equivalent spend across detected subscriptions, in minor units. */
export function totalMonthlyMinor(subs: Subscription[]): number {
  return subs.reduce((sum, s) => sum + s.monthlyEquivMinor, 0);
}
