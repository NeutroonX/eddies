// All aggregations are pure SQL / TS — deterministic, no estimates labeled as facts.
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  type CategorySpend,
  type InflowOutflow,
  type DailyBurn,
  type CapProgress,
} from './schemas';

export type {
  CategorySpend,
  InflowOutflow,
  DailyBurn,
  CapProgress,
};

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
  return { inflow, outflow, net: inflow - outflow };
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

  // Project to end of the actual month the period starts in.
  const periodStart = new Date(fromMs);
  const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(0, daysInMonth - daysInPeriod);
  const projectedMonthEndMinor = outflow + avgDailyMinor * daysRemainingInMonth;

  return { avgDailyMinor, projectedMonthEndMinor, daysInPeriod };
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
