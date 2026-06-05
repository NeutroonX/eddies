import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type ActivePeriod = 'week' | 'month' | 'custom';

export type UISlice = {
  activePeriod: ActivePeriod;
  lastVaultId: string | null;
  customRange: { from: number; to: number } | null;
  setActivePeriod: (period: ActivePeriod) => void;
  setLastVaultId: (id: string) => void;
  setCustomRange: (range: { from: number; to: number } | null) => void;
};

export const createUISlice: StateCreator<Store, [], [], UISlice> = (set) => ({
  activePeriod: 'month',
  lastVaultId: null,
  customRange: null,
  setActivePeriod: (period) => set({ activePeriod: period }),
  setLastVaultId: (id) => set({ lastVaultId: id }),
  setCustomRange: (range) => set({ customRange: range }),
});
