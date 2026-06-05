// All aggregations are pure SQL / TS — deterministic, no estimates labeled as facts.
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  CategorySpendSchema,
  InflowOutflowSchema,
  DailyBurnSchema,
  NetWorthPointSchema,
  CategoryTopSchema,
  PeriodSummarySchema,
  CapProgressSchema,
  type PeriodSummary,
  type CategorySpend,
  type InflowOutflow,
  type DailyBurn,
  type NetWorthPoint,
  type CategoryTop,
  type CapProgress,
} from './schemas';

export type {
  PeriodSummary,
  CategorySpend,
  InflowOutflow,
  DailyBurn,
  NetWorthPoint,
  CategoryTop,
  CapProgress,
};

export async function getVaultBalance(db: SQLiteDatabase, accountId: string): Promise<number> {
  const row = await db.getFirstAsync<{
    opening: number;
    inflow: number;
    outflow: number;
  }>(
    `SELECT
       a.opening_balance_minor AS opening,
       COALESCE(SUM(CASE WHEN t.kind='inflow'  THEN t.amount_minor ELSE 0 END),0) AS inflow,
       COALESCE(SUM(CASE WHEN t.kind='outflow' THEN t.amount_minor ELSE 0 END),0) AS outflow
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.transfer_group_id IS NULL
     WHERE a.id = ?
     GROUP BY a.id`,
    accountId
  );
  if (!row) return 0;
  return row.opening + row.inflow - row.outflow;
}

export async function getTotalBalance(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT
       COALESCE(SUM(a.opening_balance_minor),0) +
       COALESCE(SUM(CASE WHEN t.kind='inflow'  THEN t.amount_minor ELSE 0 END),0) -
       COALESCE(SUM(CASE WHEN t.kind='outflow' THEN t.amount_minor ELSE 0 END),0) AS total
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.transfer_group_id IS NULL
     WHERE a.archived = 0`
  );
  return row?.total ?? 0;
}

export async function getPeriodSummary(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number
): Promise<PeriodSummary> {
  const row = await db.getFirstAsync<{ inflow: number; outflow: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind='inflow'  THEN amount_minor ELSE 0 END),0) AS inflow,
       COALESCE(SUM(CASE WHEN kind='outflow' THEN amount_minor ELSE 0 END),0) AS outflow
     FROM transactions
     WHERE occurred_at >= ? AND occurred_at < ? AND transfer_group_id IS NULL`,
    fromMs,
    toMs
  );

  const inflow = row?.inflow ?? 0;
  const outflow = row?.outflow ?? 0;
  const MS_PER_DAY = 86_400_000;
  const days = Math.max(1, Math.ceil((toMs - fromMs) / MS_PER_DAY));

  return {
    total_inflow: inflow,
    total_outflow: outflow,
    net: inflow - outflow,
    daily_burn: Math.round(outflow / days),
    days_in_period: days,
  };
}

export async function getCategorySpend(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number
): Promise<CategorySpend[]> {
  const rows = await db.getAllAsync<{
    category_id: string;
    category_name: string;
    total_minor: number;
  }>(
    `SELECT
       c.id   AS category_id,
       c.name AS category_name,
       SUM(t.amount_minor) AS total_minor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.kind = 'outflow'
       AND t.occurred_at >= ? AND t.occurred_at < ?
       AND t.transfer_group_id IS NULL
     GROUP BY c.id
     ORDER BY total_minor DESC`,
    fromMs,
    toMs
  );

  const grandTotal = rows.reduce((s, r) => s + r.total_minor, 0);
  return rows.map((r) => ({
    ...r,
    percentage: grandTotal > 0 ? (r.total_minor / grandTotal) * 100 : 0,
  }));
}

export async function getInflowVsOutflow(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number
): Promise<InflowOutflow> {
  const row = await db.getFirstAsync<{ inflow: number; outflow: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind='inflow'  THEN amount_minor ELSE 0 END),0) AS inflow,
       COALESCE(SUM(CASE WHEN kind='outflow' THEN amount_minor ELSE 0 END),0) AS outflow
     FROM transactions
     WHERE occurred_at >= ? AND occurred_at < ? AND transfer_group_id IS NULL`,
    fromMs,
    toMs
  );

  const inflow = row?.inflow ?? 0;
  const outflow = row?.outflow ?? 0;
  return {
    inflow,
    outflow,
    net: inflow - outflow,
  };
}

export async function getDailyBurn(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number
): Promise<DailyBurn> {
  const row = await db.getFirstAsync<{ outflow: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind='outflow' THEN amount_minor ELSE 0 END),0) AS outflow
     FROM transactions
     WHERE occurred_at >= ? AND occurred_at < ? AND transfer_group_id IS NULL`,
    fromMs,
    toMs
  );

  const outflow = row?.outflow ?? 0;
  const MS_PER_DAY = 86_400_000;
  const daysInPeriod = Math.max(1, Math.ceil((toMs - fromMs) / MS_PER_DAY));
  const avgDailyMinor = Math.round(outflow / daysInPeriod);

  // Arithmetic projection: assume month is 30 days, multiply by remaining days
  const daysRemainingInMonth = Math.max(0, 30 - daysInPeriod);
  const projectedMonthEndMinor = outflow + avgDailyMinor * daysRemainingInMonth;

  return {
    avgDailyMinor,
    projectedMonthEndMinor,
    daysInPeriod,
  };
}

export async function getNetWorthSeries(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number
): Promise<NetWorthPoint[]> {
  // Get all unique dates with transactions in the period, then calculate running balance
  const rows = await db.getAllAsync<{ occurred_at: number; balance: number }>(
    `WITH daily_balance AS (
       SELECT
         DATE(occurred_at / 1000, 'unixepoch') AS day,
         MIN(occurred_at) AS first_occurred_at,
         SUM(CASE WHEN kind='inflow'  THEN amount_minor ELSE 0 END) -
         SUM(CASE WHEN kind='outflow' THEN amount_minor ELSE 0 END) AS daily_change
       FROM transactions
       WHERE transfer_group_id IS NULL
       GROUP BY day
     ),
     running_totals AS (
       SELECT
         first_occurred_at AS occurred_at,
         SUM(daily_change) OVER (ORDER BY day) AS running_balance
       FROM daily_balance
       WHERE first_occurred_at >= ? AND first_occurred_at < ?
       ORDER BY day
     )
     SELECT occurred_at, running_balance AS balance FROM running_totals`,
    fromMs,
    toMs
  );

  return rows.map((r) => ({
    date: r.occurred_at,
    balance: r.balance,
  }));
}

export async function getCategoryTops(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number,
  limit: number = 5
): Promise<CategoryTop[]> {
  const rows = await db.getAllAsync<{
    category_id: string;
    category_name: string;
    total_minor: number;
    transaction_count: number;
  }>(
    `SELECT
       c.id AS category_id,
       c.name AS category_name,
       SUM(t.amount_minor) AS total_minor,
       COUNT(t.id) AS transaction_count
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.kind = 'outflow'
       AND t.occurred_at >= ? AND t.occurred_at < ?
       AND t.transfer_group_id IS NULL
     GROUP BY c.id
     ORDER BY total_minor DESC
     LIMIT ?`,
    fromMs,
    toMs,
    limit
  );

  return rows;
}

export async function getCapProgress(
  db: SQLiteDatabase,
  capId: string,
  fromMs: number,
  toMs: number
): Promise<CapProgress | null> {
  const row = await db.getFirstAsync<{
    cap_id: string;
    category_id: string;
    category_name: string;
    cap_amount_minor: number;
    spent_minor: number;
  }>(
    `SELECT
       b.id AS cap_id,
       b.category_id,
       c.name AS category_name,
       b.amount_minor AS cap_amount_minor,
       COALESCE(SUM(t.amount_minor), 0) AS spent_minor
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.category_id = b.category_id
       AND t.kind = 'outflow'
       AND t.occurred_at >= ? AND t.occurred_at < ?
       AND t.transfer_group_id IS NULL
     WHERE b.id = ?
     GROUP BY b.id`,
    fromMs,
    toMs,
    capId
  );

  if (!row) return null;

  const percentage = row.cap_amount_minor > 0 ? (row.spent_minor / row.cap_amount_minor) * 100 : 0;
  return {
    cap_id: row.cap_id,
    category_id: row.category_id,
    category_name: row.category_name,
    cap_amount_minor: row.cap_amount_minor,
    spent_minor: row.spent_minor,
    percentage,
    is_over: row.spent_minor > row.cap_amount_minor,
  };
}

export async function getCapStats(
  db: SQLiteDatabase,
  period: 'weekly' | 'monthly',
  fromMs: number,
  toMs: number
): Promise<CapProgress[]> {
  const rows = await db.getAllAsync<{
    cap_id: string;
    category_id: string;
    category_name: string;
    cap_amount_minor: number;
    spent_minor: number;
  }>(
    `SELECT
       b.id AS cap_id,
       b.category_id,
       c.name AS category_name,
       b.amount_minor AS cap_amount_minor,
       COALESCE(SUM(t.amount_minor), 0) AS spent_minor
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN transactions t ON t.category_id = b.category_id
       AND t.kind = 'outflow'
       AND t.occurred_at >= ? AND t.occurred_at < ?
       AND t.transfer_group_id IS NULL
     WHERE b.period = ?
     GROUP BY b.id
     ORDER BY b.amount_minor DESC`,
    fromMs,
    toMs,
    period
  );

  return rows.map((r) => {
    const percentage = r.cap_amount_minor > 0 ? (r.spent_minor / r.cap_amount_minor) * 100 : 0;
    return {
      cap_id: r.cap_id,
      category_id: r.category_id,
      category_name: r.category_name,
      cap_amount_minor: r.cap_amount_minor,
      spent_minor: r.spent_minor,
      percentage,
      is_over: r.spent_minor > r.cap_amount_minor,
    };
  });
}

// Dev-only invariant: Intel figures must reconcile with Ledger to the cent.
// Call this in __DEV__ builds after loading analytics data to catch drift early.
export async function assertIntelReconcilesLedger(
  db: SQLiteDatabase,
  fromMs: number,
  toMs: number
): Promise<void> {
  if (!__DEV__) return;

  // Sum transactions directly (the "ledger source of truth")
  const ledger = await db.getFirstAsync<{ inflow: number; outflow: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind='inflow'  THEN amount_minor ELSE 0 END),0) AS inflow,
       COALESCE(SUM(CASE WHEN kind='outflow' THEN amount_minor ELSE 0 END),0) AS outflow
     FROM transactions
     WHERE occurred_at >= ? AND occurred_at < ? AND transfer_group_id IS NULL`,
    fromMs,
    toMs
  );

  // getInflowVsOutflow runs the same query — they must match
  const intel = await getInflowVsOutflow(db, fromMs, toMs);

  const ledgerInflow = ledger?.inflow ?? 0;
  const ledgerOutflow = ledger?.outflow ?? 0;

  if (intel.inflow !== ledgerInflow) {
    console.error(
      `[EDDIES INVARIANT] Intel inflow ${intel.inflow} ≠ Ledger inflow ${ledgerInflow}`
    );
  }
  if (intel.outflow !== ledgerOutflow) {
    console.error(
      `[EDDIES INVARIANT] Intel outflow ${intel.outflow} ≠ Ledger outflow ${ledgerOutflow}`
    );
  }

  // Category spend must sum to total outflow
  const categorySpend = await getCategorySpend(db, fromMs, toMs);
  const categoryTotal = categorySpend.reduce((s, c) => s + c.total_minor, 0);

  // Note: some outflow entries may have no category — categoryTotal ≤ total outflow is valid
  if (categoryTotal > intel.outflow) {
    console.error(
      `[EDDIES INVARIANT] Category spend total ${categoryTotal} > total outflow ${intel.outflow}`
    );
  }
}
