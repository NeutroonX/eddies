import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

import { useStore } from '@/store';
import { isFilterActive, type LedgerFilter } from '@/store/ui';

import { getTotalBalance } from '@/lib/analytics';
import { captureError } from '@/lib/telemetry';

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

// Aggregate over the *full* filtered set (not the rendered cap), so the header
// figures reflect every matching row, per §6.3 acceptance.
export type FilteredTotals = { net: number; out: number; in: number; count: number };

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

// Build a parameterized WHERE clause from the active filter. All user-supplied
// values go in as bound `?` params — never string-interpolated.
function buildWhere(f: LedgerFilter): { clause: string; params: (string | number)[] } {
  const conds: string[] = ['t.archived = 0'];
  const params: (string | number)[] = [];

  const text = f.text.trim().toLowerCase();
  if (text !== '') {
    // Match the note or the (joined) category name — the SMS-era "merchant" analog.
    // Escape LIKE metacharacters so a literal % or _ doesn't match everything.
    const escaped = text.replace(/[\\%_]/g, (c) => `\\${c}`);
    conds.push(
      "(LOWER(COALESCE(t.note, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(c.name, '')) LIKE ? ESCAPE '\\')"
    );
    const like = `%${escaped}%`;
    params.push(like, like);
  }
  if (f.vaultId !== null)    { conds.push('t.account_id = ?');  params.push(f.vaultId); }
  if (f.categoryId !== null) { conds.push('t.category_id = ?'); params.push(f.categoryId); }
  if (f.kind !== 'all')      { conds.push('t.kind = ?');        params.push(f.kind); }
  if (f.dateFrom !== null)   { conds.push('t.occurred_at >= ?'); params.push(f.dateFrom); }
  if (f.dateTo !== null)     { conds.push('t.occurred_at <= ?'); params.push(f.dateTo); }
  if (f.amountMin !== null)  { conds.push('t.amount_minor >= ?'); params.push(f.amountMin); }
  if (f.amountMax !== null)  { conds.push('t.amount_minor <= ?'); params.push(f.amountMax); }

  return { clause: conds.join(' AND '), params };
}

const ROW_LIMIT = 500;

export function useLedger() {
  const db = useSQLiteContext();
  const filter = useStore(s => s.ledgerFilter);
  const filterActive = isFilterActive(filter);

  const [sections, setSections] = useState<DaySection[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [hasMixedCurrencies, setHasMixedCurrencies] = useState(false);
  const [atRowLimit, setAtRowLimit] = useState(false);
  const [filteredTotals, setFilteredTotals] = useState<FilteredTotals | null>(null);
  const [loading, setLoading] = useState(true);

  // Read the latest filter through a ref so `reload` stays referentially stable
  // (deps: [db] only) — avoids re-subscribing focus/version effects per keystroke.
  // The ref is synced in an effect (never written during render).
  const filterRef = useRef(filter);
  // Monotonic request id: only the most-recent query is allowed to commit state,
  // so a slow earlier query can't clobber a fast later one.
  const loadIdRef = useRef(0);

  const reload = useCallback(() => {
    const f = filterRef.current;
    const active = isFilterActive(f);
    const { clause, params } = buildWhere(f);
    const id = ++loadIdRef.current;
    return Promise.all([
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
        WHERE ${clause}
        ORDER BY t.occurred_at DESC
        LIMIT ${ROW_LIMIT}
      `, params),
      getTotalBalance(db),
      db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(DISTINCT currency) AS cnt FROM accounts WHERE archived = 0'
      ),
      // Filtered aggregate — runs over the whole matching set, transfers excluded
      // from in/out/net but counted in `cnt` so the row count is honest. Skipped
      // entirely when no filter is active (the header uses its month aggregate).
      active
        ? db.getFirstAsync<{ outSum: number; inSum: number; cnt: number }>(`
            SELECT
              COALESCE(SUM(CASE WHEN t.kind = 'outflow' THEN t.amount_minor ELSE 0 END), 0) AS outSum,
              COALESCE(SUM(CASE WHEN t.kind = 'inflow'  THEN t.amount_minor ELSE 0 END), 0) AS inSum,
              COUNT(*) AS cnt
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE ${clause}
          `, params)
        : Promise.resolve(null),
    ]).then(([rows, balance, mixedRow, agg]) => {
      if (id !== loadIdRef.current) return;   // a newer query superseded this one
      // setState lives in the Promise chain (not synchronous in the effect).
      setSections(groupByDay(rows));
      setTotalBalance(balance);
      setHasMixedCurrencies((mixedRow?.cnt ?? 1) > 1);
      setAtRowLimit(rows.length === ROW_LIMIT);
      setFilteredTotals(
        agg ? { out: agg.outSum, in: agg.inSum, net: agg.inSum - agg.outSum, count: agg.cnt } : null
      );
      setLoading(false);
    }).catch(err => captureError(err, { feature: 'ledger' }));
  }, [db]);

  // Reload when the screen regains focus (covers entry saves via modal).
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Reload when any cross-screen mutation bumps dbVersion (e.g. vault archival).
  const dbVersion = useStore(s => s.dbVersion);
  useEffect(() => { reload(); }, [dbVersion, reload]);

  // Sync the ref and re-query when the active filter changes. Updating the ref
  // inside the effect (not during render) keeps `reload` stable yet current.
  useEffect(() => { filterRef.current = filter; reload(); }, [filter, reload]);

  return {
    sections, totalBalance, hasMixedCurrencies, atRowLimit,
    filteredTotals, filterActive, loading, reload,
  };
}
