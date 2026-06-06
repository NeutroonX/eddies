import type { SQLiteDatabase } from 'expo-sqlite';
import { getAllAccounts } from './db/repos/accounts';
import { getAllCategories } from './db/repos/categories';
import { getTransactions } from './db/repos/transactions';
import { getAllBudgets } from './db/repos/budgets';
import { getAllSettings } from './db/repos/settings-repo';

export interface ExportRange {
  from?: number;
  to?: number;
}

export async function exportAsCSV(
  db: SQLiteDatabase,
  range?: ExportRange
): Promise<string> {
  const transactions = await getTransactions(db, {
    fromMs: range?.from,
    toMs: range?.to,
  });
  const accounts = await getAllAccounts(db);
  const categories = await getAllCategories(db);

  const accountMap = new Map(accounts.map(a => [a.id, a.name]));
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  const headers = ['DATE', 'CATEGORY', 'VAULT', 'KIND', 'AMOUNT', 'NOTE', 'BALANCE'];
  const rows: string[] = [headers.join(',')];

  let runningBalance = 0;
  const vaultBalances = new Map<string, number>();

  // Initialize vault balances
  for (const account of accounts) {
    vaultBalances.set(account.id, account.opening_balance_minor);
  }

  for (const tx of transactions) {
    const date = new Date(tx.occurred_at).toISOString().split('T')[0];
    const category = (tx.category_id ? categoryMap.get(tx.category_id) : undefined) || 'Uncategorized';
    const vault = accountMap.get(tx.account_id) || 'Unknown';
    const kind = tx.kind.toUpperCase();
    const amount = (tx.amount_minor / 100).toFixed(2);
    const note = (tx.note || '').replace(/,/g, ';').replace(/"/g, '""');

    // Update running balance
    if (tx.kind === 'inflow') {
      runningBalance += tx.amount_minor;
    } else if (tx.kind === 'outflow') {
      runningBalance -= tx.amount_minor;
    }

    const balance = (runningBalance / 100).toFixed(2);
    const row = [date, category, vault, kind, amount, note ? `"${note}"` : '', balance];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export async function exportAsJSON(
  db: SQLiteDatabase,
  range?: ExportRange
): Promise<string> {
  const transactions = await getTransactions(db, { fromMs: range?.from, toMs: range?.to });
  const accounts = await getAllAccounts(db);
  const categories = await getAllCategories(db);
  const budgets = await getAllBudgets(db);
  const settings = await getAllSettings(db);

  const exportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    accounts,
    categories,
    transactions,
    budgets,
    settings,
  };

  return JSON.stringify(exportData, null, 2);
}

export async function formatCurrencyForExport(minorUnits: number): Promise<string> {
  return (minorUnits / 100).toFixed(2);
}
