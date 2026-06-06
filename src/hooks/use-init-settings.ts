import { useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useStore } from '@/store';
import { getAllSettings } from '@/lib/db/repos/settings-repo';

export function useInitSettings() {
  const db = useSQLiteContext();
  const { setCurrency, setFirstDayOfWeek, setHapticsEnabled, setOnboardingComplete } = useStore();

  useEffect(() => {
    getAllSettings(db).then((settings) => {
      if (settings.currency) setCurrency(settings.currency);
      if (settings.first_day_of_week) setFirstDayOfWeek(parseInt(settings.first_day_of_week, 10));
      if (settings.haptics_enabled) setHapticsEnabled(settings.haptics_enabled === 'true');
      setOnboardingComplete(settings.onboarding_complete === 'true');
    }).catch(console.error);
  }, [db, setCurrency, setFirstDayOfWeek, setHapticsEnabled, setOnboardingComplete]);
}
