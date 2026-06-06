import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getAllAccounts, createAccount, archiveAccount } from '@/lib/db/repos/accounts';
import { useStore } from '@/store';
import type { Account, NewAccount } from '@/lib/schemas';

export function useAccounts() {
  const db = useSQLiteContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await getAllAccounts(db);
    setAccounts(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => { reload(); }, [reload]);

  const dbVersion = useStore(s => s.dbVersion);
  useEffect(() => { reload(); }, [dbVersion, reload]);

  const create = useCallback(async (data: NewAccount): Promise<Account> => {
    const acc = await createAccount(db, data);
    await reload();
    return acc;
  }, [db, reload]);

  const archive = useCallback(async (id: string) => {
    await archiveAccount(db, id);
    await reload();
  }, [db, reload]);

  return { accounts, loading, reload, create, archive };
}
