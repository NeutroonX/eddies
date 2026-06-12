import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { createTransaction } from '@/lib/db/repos/transactions';
import {
  PendingImportSchema,
  type NewPendingImport,
  type PendingImport,
  type Transaction,
} from '@/lib/schemas';

function genId(): string {
  return `pi_${Crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Insert one pending import. Idempotent on `dedup_hash` — a row whose hash
 * already exists is silently skipped (returns null) so re-scans never duplicate.
 */
export async function insertPending(
  db: SQLiteDatabase,
  data: NewPendingImport
): Promise<PendingImport | null> {
  const row: PendingImport = {
    id: genId(),
    ...data,
    status: 'pending',
    created_at: Date.now(),
  };
  const res = await db.runAsync(
    `INSERT OR IGNORE INTO pending_imports
       (id,origin,amount_minor,kind,suggested_account_id,suggested_category_id,
        merchant,note,occurred_at,raw_excerpt,dedup_hash,confidence,status,
        recurring_rule_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.id, row.origin, row.amount_minor, row.kind, row.suggested_account_id,
    row.suggested_category_id, row.merchant, row.note, row.occurred_at,
    row.raw_excerpt, row.dedup_hash, row.confidence, row.status,
    row.recurring_rule_id, row.created_at
  );
  // changes === 0 → the unique dedup index rejected it (already queued/imported).
  return res.changes > 0 ? row : null;
}

/**
 * Batch insert inside a single transaction. Returns the count actually inserted
 * (after dedup), so callers can report "parsed N, new M".
 */
export async function insertManyPending(
  db: SQLiteDatabase,
  items: NewPendingImport[]
): Promise<number> {
  let inserted = 0;
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      const row = await insertPending(db, item);
      if (row) inserted += 1;
    }
  });
  return inserted;
}

/** Pending rows only, newest occurrence first. */
export async function getPending(db: SQLiteDatabase): Promise<PendingImport[]> {
  const rows = await db.getAllAsync(
    "SELECT * FROM pending_imports WHERE status = 'pending' ORDER BY occurred_at DESC"
  );
  return z.array(PendingImportSchema).parse(rows);
}

export async function getPendingById(
  db: SQLiteDatabase,
  id: string
): Promise<PendingImport | null> {
  const row = await db.getFirstAsync('SELECT * FROM pending_imports WHERE id = ?', id);
  return row ? PendingImportSchema.parse(row) : null;
}

/** Count of items awaiting review — drives the Ledger inbox badge. */
export async function countPending(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM pending_imports WHERE status = 'pending'"
  );
  return row?.cnt ?? 0;
}

/** True if a row with this dedup hash already exists (any status). */
export async function dedupExists(db: SQLiteDatabase, hash: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM pending_imports WHERE dedup_hash = ?',
    hash
  );
  return (row?.cnt ?? 0) > 0;
}

/**
 * Accept a pending import: create the real transaction and mark the row
 * accepted, atomically. `overrides` lets the inbox apply user edits (corrected
 * vault/category/amount) before committing. Returns the created transaction.
 */
export async function acceptPending(
  db: SQLiteDatabase,
  id: string,
  overrides: Partial<
    Pick<PendingImport, 'amount_minor' | 'kind' | 'suggested_account_id' | 'suggested_category_id' | 'merchant' | 'note' | 'occurred_at'>
  > = {}
): Promise<Transaction> {
  const pending = await getPendingById(db, id);
  if (!pending) throw new Error(`pending import ${id} not found`);
  if (pending.status !== 'pending') {
    throw new Error(`pending import ${id} already ${pending.status}`);
  }

  const merchant = overrides.merchant ?? pending.merchant;
  let tx!: Transaction;
  await db.withTransactionAsync(async () => {
    tx = await createTransaction(db, {
      account_id: overrides.suggested_account_id ?? pending.suggested_account_id,
      category_id: overrides.suggested_category_id ?? pending.suggested_category_id,
      kind: overrides.kind ?? pending.kind,
      amount_minor: overrides.amount_minor ?? pending.amount_minor,
      note: overrides.note ?? pending.note ?? merchant,
      occurred_at: overrides.occurred_at ?? pending.occurred_at,
      transfer_group_id: null,
      source: pending.origin === 'recurring' ? 'recurring' : 'sms',
      recurring_rule_id: pending.recurring_rule_id,
    });
    await db.runAsync(
      "UPDATE pending_imports SET status = 'accepted' WHERE id = ?",
      id
    );
  });
  return tx;
}

export async function dismissPending(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("UPDATE pending_imports SET status = 'dismissed' WHERE id = ?", id);
}
