import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getAccountBalance } from '@/lib/db/repos/accounts';

export function useAccountBalance(accountId: string | null) {
  const db = useSQLiteContext();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(!accountId);

  const reload = useCallback(async () => {
    if (!accountId) {
      setBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const bal = await getAccountBalance(db, accountId);
    setBalance(bal);
    setLoading(false);
  }, [db, accountId]);

  useEffect(() => { reload(); }, [reload]);

  return { balance, loading, reload };
}
