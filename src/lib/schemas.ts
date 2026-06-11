import { z } from 'zod';

export const AccountTypeSchema = z.string().min(1);
export const TransactionKindSchema = z.enum(['outflow', 'inflow', 'transfer']);
export const BudgetPeriodSchema = z.enum(['weekly', 'monthly']);
export const CategoryKindSchema = z.enum(['expense', 'income']);
export const TransactionSourceSchema = z.enum(['manual', 'recurring', 'sms']);
export const RecurringFreqSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export const RecurringEndKindSchema = z.enum(['never', 'on_date', 'after_n']);
export const RecurringModeSchema = z.enum(['auto', 'confirm']);

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
  bank_account_number: z.string().nullable().optional(),
  bank_account_type: z.string().nullable().optional(),
  bank_ifsc: z.string().nullable().optional(),
  bank_branch: z.string().nullable().optional(),
  upi_id: z.string().nullable().optional(),
  upi_phone: z.string().nullable().optional(),
  card_network: z.string().nullable().optional(),
  card_last_four: z.string().nullable().optional(),
  card_full_number: z.string().nullable().optional(),
  card_cvv: z.string().nullable().optional(),
  card_expiry: z.string().nullable().optional(),
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
  account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  kind: TransactionKindSchema,
  amount_minor: z.number().int().positive(),
  note: z.string().nullable(),
  occurred_at: z.number().int(),
  created_at: z.number().int(),
  transfer_group_id: z.string().nullable(),
  // v9: provenance. `source` defaults so v1 rows + manual inserts stay valid.
  source: TransactionSourceSchema.default('manual'),
  recurring_rule_id: z.string().nullable().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;
// source / recurring_rule_id are optional on insert (default 'manual', null link).
export type NewTransaction = Omit<
  Transaction,
  'id' | 'created_at' | 'source' | 'recurring_rule_id'
> & {
  source?: TransactionSource;
  recurring_rule_id?: string | null;
};

// ── Recurring rule ──────────────────────────────────────────────────────────
export const RecurringRuleSchema = z.object({
  id: z.string(),
  account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  // Recurring rules never materialize transfers (single-sided transfers corrupt
  // balances), so reject 'transfer' at the read/write boundary as defence-in-depth.
  kind: z.enum(['outflow', 'inflow']),
  amount_minor: z.number().int().positive(),
  note: z.string().nullable(),
  freq: RecurringFreqSchema,
  interval_n: z.number().int().positive(),
  anchor_day: z.number().int().nullable(),
  start_date: z.number().int(),
  end_kind: RecurringEndKindSchema,
  end_date: z.number().int().nullable(),
  end_count: z.number().int().nullable(),
  occurrences_made: z.number().int(),
  mode: RecurringModeSchema,
  last_run_at: z.number().int().nullable(),
  // SQLite stores booleans as 0/1.
  paused: z.number().int(),
  archived: z.number().int(),
  created_at: z.number().int(),
});
export type RecurringRule = z.infer<typeof RecurringRuleSchema>;
export type NewRecurringRule = Omit<
  RecurringRule,
  'id' | 'occurrences_made' | 'last_run_at' | 'paused' | 'archived' | 'created_at'
>;

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

// ── Analytics ─────────────────────────────────────────────────────────────────
export type CategorySpend = {
  category_id: string;
  category_name: string;
  total_minor: number;
  percentage: number;
};

export type InflowOutflow = {
  inflow: number;
  outflow: number;
  net: number;
};

export type DailyBurn = {
  avgDailyMinor: number;
  projectedMonthEndMinor: number;
  daysInPeriod: number;
};

export type CapProgress = {
  cap_id: string;
  category_id: string;
  category_name: string;
  cap_amount_minor: number;
  spent_minor: number;
  percentage: number;
  is_over: boolean;
};
