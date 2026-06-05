// All aggregations are pure SQL / TS — deterministic, no estimates labeled as facts.
import type { SQLiteDatabase } from 'expo-sqlite';

export type PeriodSummary = {
  total_inflow: number;
  total_outflow: number;
  net: number;
  daily_burn: number;
  days_in_period: number;
};

export type CategorySpend = {
  category_id: string;
  category_name: string;
  total_minor: number;
  percentage: number;
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
