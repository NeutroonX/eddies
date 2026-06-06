import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type ActivePeriod = 'week' | 'month' | 'custom';

export type ToastEntry = { message: string; type: 'ok' | 'err' };

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export type ArchivePrompt = { year: number; month: number };

export type UISlice = {
  activePeriod: ActivePeriod;
  lastVaultId: string | null;
  customRange: { from: number; to: number } | null;
  toast: ToastEntry | null;
  archivePrompt: ArchivePrompt | null;
  dbVersion: number;
  setActivePeriod: (period: ActivePeriod) => void;
  setLastVaultId: (id: string) => void;
  setCustomRange: (range: { from: number; to: number } | null) => void;
  showToast: (message: string, type?: 'ok' | 'err') => void;
  hideToast: () => void;
  setArchivePrompt: (prompt: ArchivePrompt | null) => void;
  bumpDbVersion: () => void;
};

export const createUISlice: StateCreator<Store, [], [], UISlice> = (set, get) => ({
  activePeriod: 'month',
  lastVaultId: null,
  customRange: null,
  toast: null,
  archivePrompt: null,
  dbVersion: 0,
  setActivePeriod: (period) => set({ activePeriod: period }),
  setLastVaultId: (id) => set({ lastVaultId: id }),
  setCustomRange: (range) => set({ customRange: range }),
  bumpDbVersion: () => set({ dbVersion: get().dbVersion + 1 }),
  showToast: (message, type = 'ok') => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { message, type } });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 2500);
  },
  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    set({ toast: null });
  },
  setArchivePrompt: (prompt) => set({ archivePrompt: prompt }),
});
