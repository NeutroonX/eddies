import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

import { getActiveRules } from '@/lib/db/repos/recurring';
import { occurrencesBetween } from '@/lib/recurring/schedule';
import { useStore } from '@/store';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type UpcomingForecast = {
  /** Number of auto-post occurrences due in the next 7 days. */
  count: number;
  /** Net minor units: inflow positive, outflow negative. */
  netMinor: number;
};

/**
 * Forecasts auto-post recurring occurrences in the next 7 days for the Ledger
 * "Upcoming" chip. Only `auto` rules count — confirm rules need user action and
 * shouldn't imply guaranteed cash flow.
 */
export function useUpcoming(): UpcomingForecast {
  const db = useSQLiteContext();
  const dbVersion = useStore(s => s.dbVersion);
  const [forecast, setForecast] = useState<UpcomingForecast>({ count: 0, netMinor: 0 });

  const reload = useCallback(async () => {
    const now = Date.now();
    const horizon = now + SEVEN_DAYS_MS;
    const rules = await getActiveRules(db);
    let count = 0;
    let netMinor = 0;
    for (const rule of rules) {
      if (rule.mode !== 'auto') continue;
      const due = occurrencesBetween(rule, now, horizon);
      if (due.length === 0) continue;
      count += due.length;
      const signed = rule.kind === 'inflow' ? rule.amount_minor : -rule.amount_minor;
      netMinor += signed * due.length;
    }
    setForecast({ count, netMinor });
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => { reload(); }, [dbVersion, reload]);

  return forecast;
}
