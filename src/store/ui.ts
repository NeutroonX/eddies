import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type ActivePeriod = 'week' | 'month' | 'custom';

export type ToastEntry = { message: string; type: 'ok' | 'err' };

export type ArchivePrompt = { year: number; month: number };

export type LedgerKindFilter = 'all' | 'outflow' | 'inflow' | 'transfer';

// Session-only ledger search/filter (§6.3). Never persisted — clears on relaunch.
export type LedgerFilter = {
  text: string;                 // matches note (case-insensitive substring)
  vaultId: string | null;       // accounts.id
  categoryId: string | null;    // categories.id
  kind: LedgerKindFilter;
  dateFrom: number | null;      // epoch ms, inclusive (start-of-day)
  dateTo: number | null;        // epoch ms, inclusive (end-of-day)
  amountMin: number | null;     // minor units, inclusive
  amountMax: number | null;     // minor units, inclusive
};

export const EMPTY_LEDGER_FILTER: LedgerFilter = {
  text: '', vaultId: null, categoryId: null, kind: 'all',
  dateFrom: null, dateTo: null, amountMin: null, amountMax: null,
};

// True when at least one constraint is set — drives the filtered-totals view.
export function isFilterActive(f: LedgerFilter): boolean {
  return (
    f.text.trim() !== '' || f.vaultId !== null || f.categoryId !== null ||
    f.kind !== 'all' || f.dateFrom !== null || f.dateTo !== null ||
    f.amountMin !== null || f.amountMax !== null
  );
}

// Count of distinct active constraints — shown as a badge on the filter button.
export function activeFilterCount(f: LedgerFilter): number {
  let n = 0;
  if (f.text.trim() !== '') n++;
  if (f.vaultId !== null) n++;
  if (f.categoryId !== null) n++;
  if (f.kind !== 'all') n++;
  if (f.dateFrom !== null || f.dateTo !== null) n++;
  if (f.amountMin !== null || f.amountMax !== null) n++;
  return n;
}

export type UISlice = {
  activePeriod: ActivePeriod;
  lastVaultId: string | null;
  customRange: { from: number; to: number } | null;
  toast: ToastEntry | null;
  toastTimerId: ReturnType<typeof setTimeout> | null;
  archivePrompt: ArchivePrompt | null;
  dbVersion: number;
  ledgerFilter: LedgerFilter;
  setActivePeriod: (period: ActivePeriod) => void;
  setLastVaultId: (id: string) => void;
  setCustomRange: (range: { from: number; to: number } | null) => void;
  showToast: (message: string, type?: 'ok' | 'err') => void;
  hideToast: () => void;
  setArchivePrompt: (prompt: ArchivePrompt | null) => void;
  bumpDbVersion: () => void;
  patchLedgerFilter: (patch: Partial<LedgerFilter>) => void;
  resetLedgerFilter: () => void;
};

export const createUISlice: StateCreator<Store, [], [], UISlice> = (set, get) => ({
  activePeriod: 'month',
  lastVaultId: null,
  customRange: null,
  toast: null,
  toastTimerId: null,
  archivePrompt: null,
  dbVersion: 0,
  ledgerFilter: EMPTY_LEDGER_FILTER,
  setActivePeriod: (period) => set({ activePeriod: period }),
  setLastVaultId: (id) => set({ lastVaultId: id }),
  setCustomRange: (range) => set({ customRange: range }),
  bumpDbVersion: () => set({ dbVersion: get().dbVersion + 1 }),
  showToast: (message, type = 'ok') => {
    const { toastTimerId } = get();
    if (toastTimerId) clearTimeout(toastTimerId);
    const id = setTimeout(() => {
      set({ toast: null, toastTimerId: null });
    }, 2500);
    set({ toast: { message, type }, toastTimerId: id });
  },
  hideToast: () => {
    const { toastTimerId } = get();
    if (toastTimerId) clearTimeout(toastTimerId);
    set({ toast: null, toastTimerId: null });
  },
  setArchivePrompt: (prompt) => set({ archivePrompt: prompt }),
  patchLedgerFilter: (patch) => set({ ledgerFilter: { ...get().ledgerFilter, ...patch } }),
  resetLedgerFilter: () => set({ ledgerFilter: EMPTY_LEDGER_FILTER }),
});
