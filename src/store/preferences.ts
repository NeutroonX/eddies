import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type PreferencesSlice = {
  currency: string;
  firstDayOfWeek: number;
  hapticsEnabled: boolean;
  setCurrency: (currency: string) => void;
  setFirstDayOfWeek: (day: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setPreferences: (prefs: Partial<Omit<PreferencesSlice, 'setCurrency' | 'setFirstDayOfWeek' | 'setHapticsEnabled' | 'setPreferences'>>) => void;
};

export const createPreferencesSlice: StateCreator<Store, [], [], PreferencesSlice> = (set) => ({
  currency: 'USD',
  firstDayOfWeek: 1,
  hapticsEnabled: true,
  setCurrency: (currency) => set({ currency }),
  setFirstDayOfWeek: (day) => set({ firstDayOfWeek: day }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setPreferences: (prefs) => set(prefs),
});
