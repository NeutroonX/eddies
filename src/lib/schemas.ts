import { z } from 'zod';

export const AccountTypeSchema = z.enum(['cash', 'bank', 'card', 'savings']);
export const TransactionKindSchema = z.enum(['outflow', 'inflow', 'transfer']);
export const BudgetPeriodSchema = z.enum(['weekly', 'monthly']);
export const CategoryKindSchema = z.enum(['expense', 'income']);

// ── Account ──────────────────────────────────────────────────────────────────
export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: z.string(),
  opening_balance_minor: z.number().int(),
  color: z.string(),
  archived: z.number().int(),
  created_at: z.number().int(),
});
export type Account = z.infer<typeof AccountSchema>;
export type NewAccount = Omit<Account, 'id' | 'archived' | 'created_at'>;

// ── Category ──────────────────────────────────────────────────────────────────
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: CategoryKindSchema,
  glyph: z.string(),
  color: z.string(),
  archived: z.number().int(),
  sort: z.number().int(),
});
export type Category = z.infer<typeof CategorySchema>;
export type NewCategory = Omit<Category, 'id' | 'archived'>;

// ── Transaction ───────────────────────────────────────────────────────────────
export const TransactionSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  category_id: z.string().nullable(),
  kind: TransactionKindSchema,
  amount_minor: z.number().int().positive(),
  note: z.string().nullable(),
  occurred_at: z.number().int(),
  created_at: z.number().int(),
  transfer_group_id: z.string().nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;
export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>;

// ── Budget ────────────────────────────────────────────────────────────────────
export const BudgetSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  period: BudgetPeriodSchema,
  amount_minor: z.number().int().positive(),
  start_date: z.number().int(),
});
export type Budget = z.infer<typeof BudgetSchema>;
export type NewBudget = Omit<Budget, 'id'>;

// ── Settings ──────────────────────────────────────────────────────────────────
export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type Setting = z.infer<typeof SettingSchema>;
