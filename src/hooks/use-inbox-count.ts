import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { countPending } from '@/lib/db/repos/pending-imports';
import { captureError } from '@/lib/telemetry';
import { useStore } from '@/store';

/** Live count of items awaiting review — drives the Ledger inbox badge. */
export function useInboxCount(): number {
  const db = useSQLiteContext();
  const dbVersion = useStore(s => s.dbVersion);
  const [count, setCount] = useState(0);

  const reload = useCallback(() => {
    countPending(db)
      .then(setCount)
      .catch(err => captureError(err, { feature: 'inbox_count' }));
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // reload bridges the external dbVersion store into React state; setCount runs
  // inside the async DB read's .then, not synchronously in the effect body.
  useEffect(() => { reload(); }, [dbVersion, reload]);

  return count;
}
