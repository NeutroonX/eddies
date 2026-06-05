import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type PreferencesSlice = {
  currency: string;
  firstDayOfWeek: number;
  hapticsEnabled: boolean;
  userName: string;
  setCurrency: (currency: string) => void;
  setFirstDayOfWeek: (day: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setUserName: (name: string) => void;
  setPreferences: (prefs: Partial<Omit<PreferencesSlice, 'setCurrency' | 'setFirstDayOfWeek' | 'setHapticsEnabled' | 'setUserName' | 'setPreferences'>>) => void;
};

export const createPreferencesSlice: StateCreator<Store, [], [], PreferencesSlice> = (set) => ({
  currency: 'USD',
  firstDayOfWeek: 1,
  hapticsEnabled: true,
  userName: 'EDDIES USER',
  setCurrency: (currency) => set({ currency }),
  setFirstDayOfWeek: (day) => set({ firstDayOfWeek: day }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setUserName: (name) => set({ userName: name }),
  setPreferences: (prefs) => set(prefs),
});
