/**
 * Materialization pass: turn due recurring rules into real transactions.
 *
 * Idempotent by construction — each rule carries a `last_run_at` watermark, and
 * occurrences are only ever posted in the half-open window (watermark, now].
 * Re-running with the same `now` produces nothing new.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertPending } from '@/lib/db/repos/pending-imports';
import { getActiveRules, setLastRun } from '@/lib/db/repos/recurring';
import { createTransaction } from '@/lib/db/repos/transactions';
import { dedupHash } from '@/lib/sms/dedup';
import { occurrencesBetween } from '@/lib/recurring/schedule';

// Cap catch-up after a long gap so we never post thousands of rows on one focus.
// Remaining occurrences are picked up on subsequent passes (watermark advances
// to the last posted occurrence, not `now`).
const MAX_CATCHUP = 60;

export type MaterializeResult = {
  rulesProcessed: number;
  autoPosted: number;
  confirmDue: number;
};

export async function materializeDueRules(
  db: SQLiteDatabase,
  now: number = Date.now()
): Promise<MaterializeResult> {
  const rules = await getActiveRules(db);
  let autoPosted = 0;
  let confirmDue = 0;

  for (const rule of rules) {
    // First pass uses start_date - 1 so the very first occurrence is included.
    const from = rule.last_run_at ?? rule.start_date - 1;
    const due = occurrencesBetween(rule, from, now, MAX_CATCHUP);
    if (due.length === 0) continue;

    if (rule.mode === 'auto') {
      const watermark = due[due.length - 1];
      await db.withTransactionAsync(async () => {
        for (const ts of due) {
          await createTransaction(db, {
            account_id: rule.account_id,
            category_id: rule.category_id,
            kind: rule.kind,
            amount_minor: rule.amount_minor,
            note: rule.note,
            occurred_at: ts,
            transfer_group_id: null,
            source: 'recurring',
            recurring_rule_id: rule.id,
          });
        }
        await setLastRun(db, rule.id, watermark, rule.occurrences_made + due.length);
      });
      autoPosted += due.length;
    } else {
      // confirm mode (M7): each due occurrence is routed into the review inbox
      // (pending_imports, origin 'recurring'). dedup_hash is keyed on rule+ts so
      // re-running a pass never enqueues the same occurrence twice; the watermark
      // then advances exactly as in auto mode.
      const watermark = due[due.length - 1];
      await db.withTransactionAsync(async () => {
        for (const ts of due) {
          await insertPending(db, {
            origin: 'recurring',
            amount_minor: rule.amount_minor,
            kind: rule.kind,
            suggested_account_id: rule.account_id,
            suggested_category_id: rule.category_id,
            merchant: null,
            note: rule.note,
            occurred_at: ts,
            raw_excerpt: null,
            dedup_hash: dedupHash({
              amount_minor: rule.amount_minor,
              occurred_at: ts,
              account_tail: null,
              ref_id: `rr_${rule.id}_${ts}`,
              kind: rule.kind,
            }),
            confidence: 1,
            recurring_rule_id: rule.id,
          });
        }
        await setLastRun(db, rule.id, watermark, rule.occurrences_made + due.length);
      });
      confirmDue += due.length;
    }
  }

  return { rulesProcessed: rules.length, autoPosted, confirmDue };
}
