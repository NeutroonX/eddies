import type { StateCreator } from 'zustand';
import type { Store } from './index';

// null = loading | 'pending' = never decided | 'enabled' | 'disabled'
export type BiometricStatus = null | 'pending' | 'enabled' | 'disabled';

export type PreferencesSlice = {
  currency: string;
  firstDayOfWeek: number;
  hapticsEnabled: boolean;
  crashReportingEnabled: boolean;
  userName: string;
  // null = not yet checked; false = show onboarding; true = done
  onboardingComplete: boolean | null;
  // null = still loading from SQLite; false = no valid code; true = access granted
  inviteValidated: boolean | null;
  biometricStatus: BiometricStatus;
  appLocked: boolean;
  // Cloud backup — opt-in, default OFF (free-tier + privacy posture).
  autoBackupEnabled: boolean;
  autoBackupWifiOnly: boolean;
  setCurrency: (currency: string) => void;
  setFirstDayOfWeek: (day: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setCrashReportingEnabled: (enabled: boolean) => void;
  setUserName: (name: string) => void;
  setOnboardingComplete: (v: boolean) => void;
  setInviteValidated: (v: boolean) => void;
  setBiometricStatus: (v: BiometricStatus) => void;
  setAppLocked: (v: boolean) => void;
  setAutoBackupEnabled: (v: boolean) => void;
  setAutoBackupWifiOnly: (v: boolean) => void;
  setPreferences: (prefs: Partial<Omit<PreferencesSlice, 'setCurrency' | 'setFirstDayOfWeek' | 'setHapticsEnabled' | 'setCrashReportingEnabled' | 'setUserName' | 'setOnboardingComplete' | 'setInviteValidated' | 'setBiometricStatus' | 'setAppLocked' | 'setAutoBackupEnabled' | 'setAutoBackupWifiOnly' | 'setPreferences'>>) => void;
};

export const createPreferencesSlice: StateCreator<Store, [], [], PreferencesSlice> = (set) => ({
  currency: 'USD',
  firstDayOfWeek: 1,
  hapticsEnabled: true,
  crashReportingEnabled: true,
  userName: 'EDDIES USER',
  onboardingComplete: null,
  inviteValidated: null,
  biometricStatus: null,
  appLocked: false,
  autoBackupEnabled: false,
  autoBackupWifiOnly: true,
  setCurrency: (currency) => set({ currency }),
  setFirstDayOfWeek: (day) => set({ firstDayOfWeek: day }),
  setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  setCrashReportingEnabled: (enabled) => set({ crashReportingEnabled: enabled }),
  setUserName: (name) => set({ userName: name }),
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),
  setInviteValidated: (v) => set({ inviteValidated: v }),
  setBiometricStatus: (v) => set({ biometricStatus: v }),
  setAppLocked: (v) => set({ appLocked: v }),
  setAutoBackupEnabled: (v) => set({ autoBackupEnabled: v }),
  setAutoBackupWifiOnly: (v) => set({ autoBackupWifiOnly: v }),
  setPreferences: (prefs) => set(prefs),
});
