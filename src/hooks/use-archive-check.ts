import { useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { AppState } from 'react-native';

import { getPendingMonths } from '@/lib/archive';
import { useStore } from '@/store';

// Checks for past months with live data on mount and when app resumes.
// Sets the oldest pending month into the store so the archive modal can be shown.
export function useArchiveCheck() {
  const db = useSQLiteContext();
  const setArchivePrompt = useStore((s) => s.setArchivePrompt);

  const check = useCallback(async () => {
    try {
      const pending = await getPendingMonths(db);
      if (pending.length > 0) {
        setArchivePrompt({ year: pending[0].year, month: pending[0].month });
      }
    } catch {
      // non-critical
    }
  }, [db, setArchivePrompt]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);
}
