import type { StateCreator } from 'zustand';
import type { Store } from './index';

export type PreferencesSlice = {
  currency: string;
  firstDayOfWeek: number;
  hapticsEnabled: boolean;
  userName: string;
  // null = not yet checked; false = show onboarding; true = done
  onboardingComplete: boolean | null;
  setCurrency: (currency: string) => void;
  setFirstDayOfWeek: (day: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setUserName: (name: string) => void;
  setOnboardingComplete: (v: boolean) => void;
  setPreferences: (prefs: Partial<Omit<PreferencesSlice, 'setCurrency' | 'setFirstDayOfWeek' | 'setHapticsEnabled' | 'setUserName' | 'setOnboardingComplete' | 'setPreferences'>>) => void;
};

export const createPreferencesSlice: StateCreator<Store, [], [], PreferencesSlice> = (set) => ({
  currency: 'USD',
  firstDayOfWeek: 1,
  hapticsEnabled: true,
  userName: 'EDDIES USER',
  onboardingComplete: null,
  setCurrency: (currency) => set({ currency }),
  setFirstDayOfWeek: (day) => set({ firstDayOfWeek: day }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setUserName: (name) => set({ userName: name }),
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),
  setPreferences: (prefs) => set(prefs),
});
