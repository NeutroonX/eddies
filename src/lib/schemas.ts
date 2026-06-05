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

// ── Analytics ─────────────────────────────────────────────────────────────────
export const CategorySpendSchema = z.object({
  category_id: z.string(),
  category_name: z.string(),
  total_minor: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
});
export type CategorySpend = z.infer<typeof CategorySpendSchema>;

export const InflowOutflowSchema = z.object({
  inflow: z.number().int().nonnegative(),
  outflow: z.number().int().nonnegative(),
  net: z.number().int(),
});
export type InflowOutflow = z.infer<typeof InflowOutflowSchema>;

export const DailyBurnSchema = z.object({
  avgDailyMinor: z.number().int().nonnegative(),
  projectedMonthEndMinor: z.number().int().nonnegative(),
  daysInPeriod: z.number().int().positive(),
});
export type DailyBurn = z.infer<typeof DailyBurnSchema>;

export const NetWorthPointSchema = z.object({
  date: z.number().int(),
  balance: z.number().int(),
});
export type NetWorthPoint = z.infer<typeof NetWorthPointSchema>;

export const CategoryTopSchema = z.object({
  category_id: z.string(),
  category_name: z.string(),
  total_minor: z.number().int().nonnegative(),
  transaction_count: z.number().int().nonnegative(),
});
export type CategoryTop = z.infer<typeof CategoryTopSchema>;

export const PeriodSummarySchema = z.object({
  total_inflow: z.number().int().nonnegative(),
  total_outflow: z.number().int().nonnegative(),
  net: z.number().int(),
  daily_burn: z.number().int().nonnegative(),
  days_in_period: z.number().int().positive(),
});
export type PeriodSummary = z.infer<typeof PeriodSummarySchema>;

export const CapProgressSchema = z.object({
  cap_id: z.string(),
  category_id: z.string(),
  category_name: z.string(),
  cap_amount_minor: z.number().int().positive(),
  spent_minor: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
  is_over: z.boolean(),
});
export type CapProgress = z.infer<typeof CapProgressSchema>;
