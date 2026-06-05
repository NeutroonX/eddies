import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { TransactionSchema, type NewTransaction, type Transaction } from '@/lib/schemas';

function genId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getTransactions(
  db: SQLiteDatabase,
  opts: { fromMs?: number; toMs?: number; accountId?: string; limit?: number } = {}
): Promise<Transaction[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.fromMs !== undefined) {
    conditions.push('occurred_at >= ?');
    params.push(opts.fromMs);
  }
  if (opts.toMs !== undefined) {
    conditions.push('occurred_at < ?');
    params.push(opts.toMs);
  }
  if (opts.accountId !== undefined) {
    conditions.push('account_id = ?');
    params.push(opts.accountId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit !== undefined ? `LIMIT ${opts.limit}` : '';
  const rows = await db.getAllAsync(
    `SELECT * FROM transactions ${where} ORDER BY occurred_at DESC ${limit}`,
    ...params
  );
  return z.array(TransactionSchema).parse(rows);
}

export async function getTransactionById(
  db: SQLiteDatabase,
  id: string
): Promise<Transaction | null> {
  const row = await db.getFirstAsync('SELECT * FROM transactions WHERE id = ?', id);
  return row ? TransactionSchema.parse(row) : null;
}

export async function createTransaction(
  db: SQLiteDatabase,
  data: NewTransaction
): Promise<Transaction> {
  const tx: Transaction = { id: genId(), ...data, created_at: Date.now() };
  await db.runAsync(
    `INSERT INTO transactions
       (id,account_id,category_id,kind,amount_minor,note,occurred_at,created_at,transfer_group_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    tx.id, tx.account_id, tx.category_id, tx.kind, tx.amount_minor,
    tx.note, tx.occurred_at, tx.created_at, tx.transfer_group_id
  );
  return tx;
}

export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function deleteTransferGroup(
  db: SQLiteDatabase,
  transferGroupId: string
): Promise<void> {
  await db.runAsync(
    'DELETE FROM transactions WHERE transfer_group_id = ?',
    transferGroupId
  );
}
