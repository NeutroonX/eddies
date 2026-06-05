import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';
import { getAllAccounts } from './db/repos/accounts';
import { getAllCategories } from './db/repos/categories';
import { getTransactions } from './db/repos/transactions';
import { getAllBudgets } from './db/repos/budgets';
import { getAllSettings } from './db/repos/settings-repo';

// Schema for validating backup files
const BackupSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  accounts: z.array(z.any()),
  categories: z.array(z.any()),
  transactions: z.array(z.any()),
  budgets: z.array(z.any()),
  settings: z.record(z.string()),
});

export type BackupData = z.infer<typeof BackupSchema>;

export async function createBackup(db: SQLiteDatabase): Promise<string> {
  try {
    const accounts = await getAllAccounts(db);
    const categories = await getAllCategories(db);
    const transactions = await getTransactions(db);
    const budgets = await getAllBudgets(db);
    const settings = await getAllSettings(db);

    const backup: BackupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      accounts,
      categories,
      transactions,
      budgets,
      settings,
    };

    return JSON.stringify(backup, null, 2);
  } catch (err) {
    throw new Error(`Failed to create backup: ${err}`);
  }
}

export async function validateBackup(data: unknown): Promise<BackupData> {
  try {
    return BackupSchema.parse(data);
  } catch (err) {
    throw new Error(`Invalid backup file: ${err}`);
  }
}

export interface BackupSummary {
  exportedAt: string;
  transactionCount: number;
  accountCount: number;
  categoryCount: number;
  budgetCount: number;
}

export async function getBackupSummary(backup: BackupData): Promise<BackupSummary> {
  return {
    exportedAt: backup.exportedAt,
    transactionCount: backup.transactions.length,
    accountCount: backup.accounts.length,
    categoryCount: backup.categories.length,
    budgetCount: backup.budgets.length,
  };
}

export async function restoreBackup(
  db: SQLiteDatabase,
  backup: BackupData
): Promise<void> {
  try {
    // Wipe all tables
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM budgets;
      DELETE FROM categories;
      DELETE FROM accounts;
      DELETE FROM settings;
    `);

    // Restore accounts
    for (const account of backup.accounts) {
      await db.runAsync(
        `INSERT INTO accounts (id, name, type, currency, opening_balance_minor, color, archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        account.id,
        account.name,
        account.type,
        account.currency,
        account.opening_balance_minor,
        account.color,
        account.archived,
        account.created_at
      );
    }

    // Restore categories
    for (const category of backup.categories) {
      await db.runAsync(
        `INSERT INTO categories (id, name, kind, glyph, color, archived, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        category.id,
        category.name,
        category.kind,
        category.glyph,
        category.color,
        category.archived,
        category.sort
      );
    }

    // Restore transactions
    for (const transaction of backup.transactions) {
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, category_id, kind, amount_minor, note, occurred_at, created_at, transfer_group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        transaction.id,
        transaction.account_id,
        transaction.category_id,
        transaction.kind,
        transaction.amount_minor,
        transaction.note,
        transaction.occurred_at,
        transaction.created_at,
        transaction.transfer_group_id
      );
    }

    // Restore budgets
    for (const budget of backup.budgets) {
      await db.runAsync(
        `INSERT INTO budgets (id, category_id, period, amount_minor, start_date)
         VALUES (?, ?, ?, ?, ?)`,
        budget.id,
        budget.category_id,
        budget.period,
        budget.amount_minor,
        budget.start_date
      );
    }

    // Restore settings
    for (const [key, value] of Object.entries(backup.settings)) {
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key,
        value
      );
    }
  } catch (err) {
    throw new Error(`Failed to restore backup: ${err}`);
  }
}
