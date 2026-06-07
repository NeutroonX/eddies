import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { BudgetSchema, type Budget, type NewBudget } from '@/lib/schemas';

function genId(): string {
  return `bgt_${crypto.randomUUID().replace(/-/g, '')}`;
}

export async function getAllBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync('SELECT * FROM budgets ORDER BY start_date DESC');
  return z.array(BudgetSchema).parse(rows);
}

export async function createBudget(db: SQLiteDatabase, data: NewBudget): Promise<Budget> {
  const budget: Budget = { id: genId(), ...data };
  await db.runAsync(
    'INSERT INTO budgets (id,category_id,period,amount_minor,start_date) VALUES (?,?,?,?,?)',
    budget.id, budget.category_id, budget.period, budget.amount_minor, budget.start_date
  );
  return budget;
}

export async function updateBudget(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Omit<Budget, 'id'>>
): Promise<void> {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.category_id !== undefined) {
    updates.push('category_id = ?');
    values.push(data.category_id);
  }
  if (data.period !== undefined) {
    updates.push('period = ?');
    values.push(data.period);
  }
  if (data.amount_minor !== undefined) {
    updates.push('amount_minor = ?');
    values.push(data.amount_minor);
  }
  if (data.start_date !== undefined) {
    updates.push('start_date = ?');
    values.push(data.start_date);
  }

  if (updates.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`, ...values);
}

export async function deleteBudget(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}
