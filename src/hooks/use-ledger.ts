import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

import { getTotalBalance } from '@/lib/analytics';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export type LedgerRow = {
  id: string;
  account_id: string;
  category_id: string | null;
  kind: 'outflow' | 'inflow' | 'transfer';
  amount_minor: number;
  note: string | null;
  occurred_at: number;
  created_at: number;
  transfer_group_id: string | null;
  category_name: string;
  category_color: string;
  category_glyph: string;
  vault_name: string;
};

export type DaySection = {
  title: string;
  dayMs: number;
  data: LedgerRow[];
};

function formatDayTitle(ms: number): string {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

function groupByDay(rows: LedgerRow[]): DaySection[] {
  const map = new Map<string, DaySection>();
  for (const row of rows) {
    const d = new Date(row.occurred_at);
    const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const key = String(dayMs);
    if (!map.has(key)) {
      map.set(key, { title: formatDayTitle(dayMs), dayMs, data: [] });
    }
    map.get(key)!.data.push(row);
  }
  return Array.from(map.values());
}

const ROW_LIMIT = 500;

export function useLedger() {
  const db = useSQLiteContext();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [hasMixedCurrencies, setHasMixedCurrencies] = useState(false);
  const [atRowLimit, setAtRowLimit] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [rows, balance, mixedRow] = await Promise.all([
      db.getAllAsync<LedgerRow>(`
        SELECT
          t.id, t.account_id, t.category_id, t.kind, t.amount_minor,
          t.note, t.occurred_at, t.created_at, t.transfer_group_id,
          COALESCE(c.name,  'Uncategorized') AS category_name,
          COALESCE(c.color, '#8A8F98')       AS category_color,
          COALESCE(c.glyph, 'questionmark')  AS category_glyph,
          COALESCE(a.name,  '—')             AS vault_name
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN accounts   a ON a.id = t.account_id
        WHERE t.archived = 0
        ORDER BY t.occurred_at DESC
        LIMIT ${ROW_LIMIT}
      `),
      getTotalBalance(db),
      db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(DISTINCT currency) AS cnt FROM accounts WHERE archived = 0'
      ),
    ]);
    setSections(groupByDay(rows));
    setTotalBalance(balance);
    setHasMixedCurrencies((mixedRow?.cnt ?? 1) > 1);
    setAtRowLimit(rows.length === ROW_LIMIT);
    setLoading(false);
  }, [db]);

  // Reload whenever this screen regains focus — catches entry saves and deletes.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return { sections, totalBalance, hasMixedCurrencies, atRowLimit, loading, reload };
}
