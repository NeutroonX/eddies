import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';
import { getAllAccounts } from './db/repos/accounts';
import { getAllCategories } from './db/repos/categories';
import { getTransactions } from './db/repos/transactions';
import { getAllBudgets } from './db/repos/budgets';
import { getAllSettings } from './db/repos/settings-repo';
import {
  AccountSchema,
  CategorySchema,
  BudgetSchema,
  TransactionSchema,
} from './schemas';

const BackupTransactionSchema = TransactionSchema.extend({
  archived: z.number().int().optional(),
});

const MonthlyArchiveRowSchema = z.object({
  id: z.string(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  label: z.string().max(20),
  total_inflow: z.number().int().nonnegative(),
  total_outflow: z.number().int().nonnegative(),
  tx_count: z.number().int().nonnegative(),
  exported_csv: z.number().int(),
  exported_pdf: z.number().int(),
  archived_at: z.number().int().nullable(),
});

const BackupSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  accounts: z.array(AccountSchema),
  categories: z.array(CategorySchema),
  transactions: z.array(BackupTransactionSchema),
  budgets: z.array(BudgetSchema),
  settings: z.record(z.string(), z.string()),
  monthly_archives: z.array(MonthlyArchiveRowSchema).optional(),
});

export type BackupData = z.infer<typeof BackupSchema>;

export async function createBackup(db: SQLiteDatabase): Promise<string> {
  const accounts = await getAllAccounts(db);
  const categories = await getAllCategories(db);
  const transactions = await getTransactions(db);
  const budgets = await getAllBudgets(db);
  const settings = await getAllSettings(db);
  const monthly_archives = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM monthly_archives ORDER BY year DESC, month DESC'
  );

  const backup: BackupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    accounts,
    categories,
    transactions,
    budgets,
    settings,
    monthly_archives,
  };

  return JSON.stringify(backup, null, 2);
}

export async function validateBackup(data: unknown): Promise<BackupData> {
  try {
    return BackupSchema.parse(data);
  } catch {
    throw new Error('Invalid backup file — check format and version.');
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
  // All-or-nothing: if any row fails the DB is not left half-wiped.
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM monthly_archives');
    await db.runAsync('DELETE FROM budgets');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM accounts');
    await db.runAsync('DELETE FROM settings');

    for (const account of backup.accounts) {
      await db.runAsync(
        `INSERT INTO accounts (id,name,type,currency,opening_balance_minor,color,archived,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        account.id, account.name, account.type, account.currency,
        account.opening_balance_minor, account.color, account.archived, account.created_at
      );
    }

    for (const category of backup.categories) {
      await db.runAsync(
        `INSERT INTO categories (id,name,kind,glyph,color,archived,sort)
         VALUES (?,?,?,?,?,?,?)`,
        category.id, category.name, category.kind, category.glyph,
        category.color, category.archived, category.sort
      );
    }

    for (const tx of backup.transactions) {
      await db.runAsync(
        `INSERT INTO transactions
           (id,account_id,category_id,kind,amount_minor,note,occurred_at,created_at,transfer_group_id,archived)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        tx.id, tx.account_id, tx.category_id, tx.kind, tx.amount_minor,
        tx.note, tx.occurred_at, tx.created_at, tx.transfer_group_id,
        (tx as { archived?: number }).archived ?? 0
      );
    }

    for (const budget of backup.budgets) {
      await db.runAsync(
        `INSERT INTO budgets (id,category_id,period,amount_minor,start_date)
         VALUES (?,?,?,?,?)`,
        budget.id, budget.category_id, budget.period, budget.amount_minor, budget.start_date
      );
    }

    for (const archive of backup.monthly_archives ?? []) {
      await db.runAsync(
        `INSERT INTO monthly_archives
           (id,year,month,label,total_inflow,total_outflow,tx_count,exported_csv,exported_pdf,archived_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        archive.id, archive.year, archive.month, archive.label,
        archive.total_inflow, archive.total_outflow, archive.tx_count,
        archive.exported_csv, archive.exported_pdf, archive.archived_at ?? null
      );
    }

    for (const [key, value] of Object.entries(backup.settings)) {
      await db.runAsync(
        `INSERT INTO settings (key,value) VALUES (?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        key, value
      );
    }
  });
}
