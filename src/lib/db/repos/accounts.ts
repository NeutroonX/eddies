import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { AccountSchema, type Account, type NewAccount } from '@/lib/schemas';

function genId(): string {
  return `acc_${Crypto.randomUUID().replace(/-/g, '')}`;
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
  const ALLOWED_COLS: Array<keyof NewAccount> = ['name', 'type', 'currency', 'opening_balance_minor', 'color'];
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  for (const col of ALLOWED_COLS) {
    if (col in data) {
      updates.push(`${col} = ?`);
      values.push(data[col] as string | number | null);
    }
  }
  if (updates.length === 0) return;
  await db.runAsync(
    `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`,
    ...values,
    id
  );
}

export async function archiveAccount(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE accounts SET archived = 1 WHERE id = ?', id);
}

export async function getAccountBalance(db: SQLiteDatabase, accountId: string): Promise<number> {
  const account = await getAccountById(db, accountId);
  if (!account) return 0;

  const result = await db.getFirstAsync<{ net: number }>(
    `SELECT COALESCE(opening_balance_minor, 0) +
            COALESCE(SUM(CASE WHEN kind = 'inflow' THEN amount_minor ELSE -amount_minor END), 0) AS net
     FROM accounts
     LEFT JOIN transactions ON accounts.id = transactions.account_id
       AND transfer_group_id IS NULL
     WHERE accounts.id = ?
     GROUP BY accounts.id`,
    accountId
  );

  return result?.net ?? account.opening_balance_minor;
}
