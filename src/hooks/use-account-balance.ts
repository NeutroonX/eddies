import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getAccountBalance } from '@/lib/db/repos/accounts';
import { captureError } from '@/lib/telemetry';

export function useAccountBalance(accountId: string | null) {
  const db = useSQLiteContext();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(!accountId);

  const reload = useCallback(() => {
    if (!accountId) {
      setBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    getAccountBalance(db, accountId)
      .then(bal => { setBalance(bal); setLoading(false); })
      .catch(err => { setLoading(false); captureError(err, { feature: 'account_balance' }); });
  }, [db, accountId]);

  // reload synchronously resets state when accountId is absent / starts loading,
  // which is the intended external-sync; the DB result lands via the Promise.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  return { balance, loading, reload };
}
