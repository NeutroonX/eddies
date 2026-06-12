import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { countPending } from '@/lib/db/repos/pending-imports';
import { useStore } from '@/store';

/** Live count of items awaiting review — drives the Ledger inbox badge. */
export function useInboxCount(): number {
  const db = useSQLiteContext();
  const dbVersion = useStore(s => s.dbVersion);
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    setCount(await countPending(db));
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // Bridges the external dbVersion store into React state via an async DB read.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [dbVersion, reload]);

  return count;
}
