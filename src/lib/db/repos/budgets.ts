import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { BudgetSchema, type Budget, type NewBudget } from '@/lib/schemas';

function genId(): string {
  return `bgt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getAllBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync('SELECT * FROM budgets ORDER BY start_date DESC');
  return z.array(BudgetSchema).parse(rows);
}

export async function getBudgetByCategoryAndPeriod(
  db: SQLiteDatabase,
  categoryId: string,
  period: 'weekly' | 'monthly'
): Promise<Budget | null> {
  const row = await db.getFirstAsync(
    'SELECT * FROM budgets WHERE category_id = ? AND period = ? ORDER BY start_date DESC LIMIT 1',
    categoryId,
    period
  );
  return row ? BudgetSchema.parse(row) : null;
}

export async function createBudget(db: SQLiteDatabase, data: NewBudget): Promise<Budget> {
  const budget: Budget = { id: genId(), ...data };
  await db.runAsync(
    'INSERT INTO budgets (id,category_id,period,amount_minor,start_date) VALUES (?,?,?,?,?)',
    budget.id, budget.category_id, budget.period, budget.amount_minor, budget.start_date
  );
  return budget;
}

export async function deleteBudget(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}
