import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import {
  RecurringRuleSchema,
  type NewRecurringRule,
  type RecurringRule,
} from '@/lib/schemas';

function genId(): string {
  return `rr_${Crypto.randomUUID().replace(/-/g, '')}`;
}

export async function createRule(
  db: SQLiteDatabase,
  data: NewRecurringRule
): Promise<RecurringRule> {
  const rule: RecurringRule = {
    id: genId(),
    ...data,
    occurrences_made: 0,
    last_run_at: null,
    paused: 0,
    archived: 0,
    created_at: Date.now(),
  };
  await db.runAsync(
    `INSERT INTO recurring_rules
       (id,account_id,category_id,kind,amount_minor,note,freq,interval_n,anchor_day,
        start_date,end_kind,end_date,end_count,occurrences_made,mode,last_run_at,
        paused,archived,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    rule.id, rule.account_id, rule.category_id, rule.kind, rule.amount_minor,
    rule.note, rule.freq, rule.interval_n, rule.anchor_day, rule.start_date,
    rule.end_kind, rule.end_date, rule.end_count, rule.occurrences_made, rule.mode,
    rule.last_run_at, rule.paused, rule.archived, rule.created_at
  );
  return rule;
}

const EDITABLE_COLS = [
  'account_id', 'category_id', 'kind', 'amount_minor', 'note',
  'freq', 'interval_n', 'anchor_day', 'start_date',
  'end_kind', 'end_date', 'end_count', 'mode', 'paused', 'archived',
] as const;

type EditableCol = (typeof EDITABLE_COLS)[number];

export async function updateRule(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Pick<RecurringRule, EditableCol>>
): Promise<void> {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  for (const col of EDITABLE_COLS) {
    const v = data[col];
    if (v !== undefined) {
      updates.push(`${col} = ?`);
      values.push(v);
    }
  }
  if (updates.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE recurring_rules SET ${updates.join(', ')} WHERE id = ?`, ...values);
}

/** Active = not archived. Includes paused rules so the UI can show + resume them. */
export async function getRules(db: SQLiteDatabase): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync(
    'SELECT * FROM recurring_rules WHERE archived = 0 ORDER BY created_at DESC'
  );
  return z.array(RecurringRuleSchema).parse(rows);
}

/** Rules eligible for materialization: not archived, not paused. */
export async function getActiveRules(db: SQLiteDatabase): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync(
    'SELECT * FROM recurring_rules WHERE archived = 0 AND paused = 0'
  );
  return z.array(RecurringRuleSchema).parse(rows);
}

export async function getRuleById(
  db: SQLiteDatabase,
  id: string
): Promise<RecurringRule | null> {
  const row = await db.getFirstAsync('SELECT * FROM recurring_rules WHERE id = ?', id);
  return row ? RecurringRuleSchema.parse(row) : null;
}

export async function pauseRule(
  db: SQLiteDatabase,
  id: string,
  paused: boolean
): Promise<void> {
  await db.runAsync('UPDATE recurring_rules SET paused = ? WHERE id = ?', paused ? 1 : 0, id);
}

export async function archiveRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE recurring_rules SET archived = 1 WHERE id = ?', id);
}

/** Advance the materialization watermark + occurrence count after a pass. */
export async function setLastRun(
  db: SQLiteDatabase,
  id: string,
  lastRunAt: number,
  occurrencesMade: number
): Promise<void> {
  await db.runAsync(
    'UPDATE recurring_rules SET last_run_at = ?, occurrences_made = ? WHERE id = ?',
    lastRunAt, occurrencesMade, id
  );
}
