import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { AccountSchema, type Account, type NewAccount } from '@/lib/schemas';

function genId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getAllAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync(
    'SELECT * FROM accounts WHERE archived = 0 ORDER BY created_at ASC'
  );
  return z.array(AccountSchema).parse(rows);
}

export async function getAccountById(db: SQLiteDatabase, id: string): Promise<Account | null> {
  const row = await db.getFirstAsync('SELECT * FROM accounts WHERE id = ?', id);
  return row ? AccountSchema.parse(row) : null;
}

export async function createAccount(db: SQLiteDatabase, data: NewAccount): Promise<Account> {
  const account: Account = { id: genId(), ...data, archived: 0, created_at: Date.now() };
  await db.runAsync(
    `INSERT INTO accounts
       (id,name,type,currency,opening_balance_minor,color,archived,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    account.id, account.name, account.type, account.currency,
    account.opening_balance_minor, account.color, account.archived, account.created_at
  );
  return account;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: string,
  data: Partial<NewAccount>
): Promise<void> {
  const entries = Object.entries(data);
  if (entries.length === 0) return;
  const set = entries.map(([k]) => `${k} = ?`).join(', ');
  await db.runAsync(
    `UPDATE accounts SET ${set} WHERE id = ?`,
    ...entries.map(([, v]) => v as string | number),
    id
  );
}

export async function archiveAccount(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE accounts SET archived = 1 WHERE id = ?', id);
}
