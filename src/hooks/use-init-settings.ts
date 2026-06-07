import { useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useStore } from '@/store';
import { getAllSettings } from '@/lib/db/repos/settings-repo';
import { setTelemetryEnabled } from '@/lib/telemetry';

export function useInitSettings() {
  const db = useSQLiteContext();
  const { setCurrency, setFirstDayOfWeek, setHapticsEnabled, setCrashReportingEnabled, setOnboardingComplete, setInviteValidated, setBiometricStatus } = useStore();

  useEffect(() => {
    getAllSettings(db).then((settings) => {
      if (settings.currency) setCurrency(settings.currency);
      if (settings.first_day_of_week) setFirstDayOfWeek(parseInt(settings.first_day_of_week, 10));
      if (settings.haptics_enabled) setHapticsEnabled(settings.haptics_enabled === 'true');
      // Default true — only false when the user has explicitly opted out.
      const crashEnabled = settings.crash_reporting_enabled !== 'false';
      setCrashReportingEnabled(crashEnabled);
      setTelemetryEnabled(crashEnabled);
      setOnboardingComplete(settings.onboarding_complete === 'true');
      setInviteValidated(settings.invite_validated === 'true');

      if (settings.biometric_lock_enabled === 'true') {
        setBiometricStatus('enabled');
      } else if (settings.biometric_lock_enabled === 'false') {
        setBiometricStatus('disabled');
      } else {
        // Key absent — user has never been asked
        setBiometricStatus('pending');
      }
    }).catch((err) => {
      console.error(err);
      setOnboardingComplete(false);
      setInviteValidated(false);
      setBiometricStatus('disabled');
    });
  }, [db, setCurrency, setFirstDayOfWeek, setHapticsEnabled, setCrashReportingEnabled, setOnboardingComplete, setInviteValidated, setBiometricStatus]);
}
