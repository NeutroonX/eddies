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
       (id,name,type,currency,opening_balance_minor,color,archived,created_at,
        bank_account_number, bank_account_type, bank_ifsc, bank_branch, 
        upi_id, upi_phone,
        card_network, card_last_four, card_full_number, card_cvv, card_expiry)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    account.id, account.name, account.type, account.currency,
    account.opening_balance_minor, account.color, account.archived, account.created_at,
    account.bank_account_number ?? null, account.bank_account_type ?? null, account.bank_ifsc ?? null, account.bank_branch ?? null,
    account.upi_id ?? null, account.upi_phone ?? null,
    account.card_network ?? null, account.card_last_four ?? null, account.card_full_number ?? null, account.card_cvv ?? null, account.card_expiry ?? null
  );
  return account;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: string,
  data: Partial<NewAccount>
): Promise<void> {
  const ALLOWED_COLS: Array<keyof NewAccount> = [
    'name', 'type', 'currency', 'opening_balance_minor', 'color',
    'bank_account_number', 'bank_account_type', 'bank_ifsc', 'bank_branch',
    'upi_id', 'upi_phone',
    'card_network', 'card_last_four', 'card_full_number', 'card_cvv', 'card_expiry'
  ];
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

/**
 * One query for every active vault's balance, keyed by account id.
 * Equivalent to calling getAccountBalance per account, but avoids N round-trips.
 */
export async function getAllAccountBalances(db: SQLiteDatabase): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ id: string; balance: number }>(
    `SELECT a.id AS id,
        a.opening_balance_minor + COALESCE(SUM(CASE
          WHEN t.kind = 'inflow'  THEN t.amount_minor
          WHEN t.kind = 'outflow' THEN -t.amount_minor
          ELSE 0
        END), 0) AS balance
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id
     WHERE a.archived = 0
     GROUP BY a.id, a.opening_balance_minor`
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.id] = r.balance;
  return out;
}

export async function getAccountBalance(db: SQLiteDatabase, accountId: string): Promise<number> {
  const account = await getAccountById(db, accountId);
  if (!account) return 0;

  const row = await db.getFirstAsync<{ net: number }>(
    `SELECT COALESCE(SUM(CASE 
        WHEN kind = 'inflow' THEN amount_minor 
        WHEN kind = 'outflow' THEN -amount_minor 
        ELSE 0 
      END), 0) AS net
     FROM transactions
     WHERE account_id = ?`,
    accountId
  );

  return account.opening_balance_minor + (row?.net ?? 0);
}
