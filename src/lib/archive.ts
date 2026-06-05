import type { SQLiteDatabase } from 'expo-sqlite';
import { Share } from 'react-native';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export type PendingMonth = {
  year: number;
  month: number; // 1-12
  label: string;
  tx_count: number;
  total_inflow: number;
  total_outflow: number;
};

export type MonthlyArchive = {
  id: string;
  year: number;
  month: number;
  label: string;
  total_inflow: number;
  total_outflow: number;
  tx_count: number;
  exported_csv: boolean;
  exported_pdf: boolean;
  archived_at: number | null;
};

// Returns months before current month that still have live (non-archived) transactions.
export async function getPendingMonths(db: SQLiteDatabase): Promise<PendingMonth[]> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const rows = await db.getAllAsync<{
    yr: number; mo: number; tx_count: number;
    total_inflow: number; total_outflow: number;
  }>(
    `SELECT
       CAST(strftime('%Y', occurred_at/1000, 'unixepoch') AS INTEGER) AS yr,
       CAST(strftime('%m', occurred_at/1000, 'unixepoch') AS INTEGER) AS mo,
       COUNT(*) AS tx_count,
       COALESCE(SUM(CASE WHEN kind='inflow'  THEN amount_minor ELSE 0 END),0) AS total_inflow,
       COALESCE(SUM(CASE WHEN kind='outflow' THEN amount_minor ELSE 0 END),0) AS total_outflow
     FROM transactions
     WHERE archived = 0 AND transfer_group_id IS NULL AND occurred_at < ?
     GROUP BY yr, mo
     ORDER BY yr ASC, mo ASC`,
    currentMonthStart
  );

  return rows.map((r) => ({
    year: r.yr,
    month: r.mo,
    label: `${MONTHS[r.mo - 1]} ${r.yr}`,
    tx_count: r.tx_count,
    total_inflow: r.total_inflow,
    total_outflow: r.total_outflow,
  }));
}

export async function getArchivedMonths(db: SQLiteDatabase): Promise<MonthlyArchive[]> {
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM monthly_archives ORDER BY year DESC, month DESC'
  );
  return rows.map((r) => ({
    ...r,
    exported_csv: r.exported_csv === 1,
    exported_pdf: r.exported_pdf === 1,
  }));
}

// Purges raw transactions for the month and writes the summary record.
export async function archiveMonth(db: SQLiteDatabase, year: number, month: number): Promise<void> {
  const pending = await getPendingMonths(db);
  const m = pending.find((p) => p.year === year && p.month === month);
  if (!m) return;

  const id = `arch_${year}_${String(month).padStart(2, '0')}`;
  const label = `${MONTHS[month - 1]} ${year}`;

  await db.runAsync(
    `INSERT INTO monthly_archives (id,year,month,label,total_inflow,total_outflow,tx_count,exported_csv,exported_pdf,archived_at)
     VALUES (?,?,?,?,?,?,?,0,0,?)
     ON CONFLICT(year,month) DO UPDATE SET
       total_inflow=excluded.total_inflow,
       total_outflow=excluded.total_outflow,
       tx_count=excluded.tx_count,
       archived_at=excluded.archived_at`,
    id, year, month, label, m.total_inflow, m.total_outflow, m.tx_count, Date.now()
  );

  // Mark transactions as archived (keeps them queryable for re-export, just hidden from live views).
  const start = new Date(year, month - 1, 1).getTime();
  const end   = new Date(year, month, 1).getTime();
  await db.runAsync(
    'UPDATE transactions SET archived = 1 WHERE occurred_at >= ? AND occurred_at < ? AND archived = 0',
    start, end
  );
}

export async function markExported(
  db: SQLiteDatabase,
  year: number,
  month: number,
  format: 'csv' | 'pdf'
): Promise<void> {
  const col = format === 'csv' ? 'exported_csv' : 'exported_pdf';
  await db.runAsync(
    `UPDATE monthly_archives SET ${col} = 1 WHERE year = ? AND month = ?`,
    year, month
  );
}

// Generates and shares a CSV for the given month.
export async function exportMonthCSV(
  db: SQLiteDatabase,
  year: number,
  month: number,
  currencySymbol: string
): Promise<void> {
  const start = new Date(year, month - 1, 1).getTime();
  const end   = new Date(year, month, 1).getTime();

  const rows = await db.getAllAsync<{
    occurred_at: number; kind: string; amount_minor: number;
    note: string | null; category_name: string; vault_name: string;
  }>(
    `SELECT t.occurred_at, t.kind, t.amount_minor, t.note,
            COALESCE(c.name,'Uncategorized') AS category_name,
            COALESCE(a.name,'—') AS vault_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts   a ON a.id = t.account_id
     WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.transfer_group_id IS NULL
     ORDER BY t.occurred_at ASC`,
    start, end
  );

  const header = 'Date,Time,Kind,Amount,Category,Vault,Note';
  const lines = rows.map((r) => {
    const d = new Date(r.occurred_at);
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const amount = (r.amount_minor / 100).toFixed(2);
    const note = (r.note ?? '').replace(/,/g, ';');
    return `${date},${time},${r.kind},${amount},${r.category_name},${r.vault_name},${note}`;
  });

  const csv = [header, ...lines].join('\n');
  const label = `${MONTHS[month-1]}_${year}`;

  await Share.share({
    title: `eddies_${label}.csv`,
    message: csv,
  });
}

// Generates and shares an HTML financial report (user can print to PDF from browser).
export async function exportMonthHTML(
  db: SQLiteDatabase,
  year: number,
  month: number,
  currencySymbol: string
): Promise<void> {
  const start = new Date(year, month - 1, 1).getTime();
  const end   = new Date(year, month, 1).getTime();
  const label = `${MONTHS[month - 1]} ${year}`;

  const rows = await db.getAllAsync<{
    occurred_at: number; kind: string; amount_minor: number;
    note: string | null; category_name: string; vault_name: string;
  }>(
    `SELECT t.occurred_at, t.kind, t.amount_minor, t.note,
            COALESCE(c.name,'Uncategorized') AS category_name,
            COALESCE(a.name,'—') AS vault_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts   a ON a.id = t.account_id
     WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.transfer_group_id IS NULL
     ORDER BY t.occurred_at ASC`,
    start, end
  );

  const totalIn  = rows.filter((r) => r.kind === 'inflow').reduce((s, r) => s + r.amount_minor, 0);
  const totalOut = rows.filter((r) => r.kind === 'outflow').reduce((s, r) => s + r.amount_minor, 0);
  const net      = totalIn - totalOut;

  const rowsHTML = rows.map((r) => {
    const d = new Date(r.occurred_at);
    const date = `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]}`;
    const amt = `${r.kind === 'outflow' ? '−' : '+'}${currencySymbol}${(r.amount_minor/100).toFixed(2)}`;
    const color = r.kind === 'outflow' ? '#E5484D' : '#FFFFFF';
    return `<tr>
      <td>${date}</td>
      <td>${r.category_name}</td>
      <td>${r.vault_name}</td>
      <td>${r.note ?? ''}</td>
      <td style="text-align:right;color:${color};font-weight:600">${amt}</td>
    </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>EDDIES — ${label}</title>
<style>
  body{font-family:monospace;background:#000;color:#fff;padding:24px;font-size:12px}
  h1{font-size:18px;letter-spacing:4px;margin-bottom:4px}
  .sub{color:#8A8F98;letter-spacing:2px;margin-bottom:24px}
  .summary{display:flex;gap:32px;margin-bottom:24px;padding:12px;border:1px solid #333}
  .stat label{color:#8A8F98;font-size:10px;letter-spacing:2px;display:block}
  .stat span{font-size:16px;font-weight:600}
  .out{color:#E5484D}.in{color:#fff}.net{color:${net>=0?'#fff':'#E5484D'}}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;color:#8A8F98;letter-spacing:1.5px;font-size:10px;padding:6px 4px;border-bottom:1px solid #222}
  td{padding:6px 4px;border-bottom:1px solid #111;font-size:11px}
  @media print{body{background:#fff;color:#000}.out{color:#cc0000}.in{color:#000}}
</style>
</head>
<body>
<h1>EDDIES</h1>
<div class="sub">MONTHLY STATEMENT // ${label.toUpperCase()}</div>
<div class="summary">
  <div class="stat"><label>INFLOW</label><span class="in">+${currencySymbol}${(totalIn/100).toFixed(2)}</span></div>
  <div class="stat"><label>OUTFLOW</label><span class="out">−${currencySymbol}${(totalOut/100).toFixed(2)}</span></div>
  <div class="stat"><label>NET</label><span class="net">${net>=0?'+':'−'}${currencySymbol}${(Math.abs(net)/100).toFixed(2)}</span></div>
  <div class="stat"><label>ENTRIES</label><span>${rows.length}</span></div>
</div>
<table>
<thead><tr><th>DATE</th><th>CATEGORY</th><th>VAULT</th><th>NOTE</th><th style="text-align:right">AMOUNT</th></tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
</body>
</html>`;

  await Share.share({
    title: `eddies_${MONTHS[month-1]}_${year}_report.html`,
    message: html,
  });
}
