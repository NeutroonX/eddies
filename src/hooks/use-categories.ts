import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getAllCategories, createCategory, archiveCategory } from '@/lib/db/repos/categories';
import type { Category, NewCategory } from '@/lib/schemas';

export function useCategories() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await getAllCategories(db);
    setCategories(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (data: NewCategory): Promise<Category> => {
    const cat = await createCategory(db, data);
    await reload();
    return cat;
  }, [db, reload]);

  const archive = useCallback(async (id: string) => {
    await archiveCategory(db, id);
    await reload();
  }, [db, reload]);

  return { categories, loading, reload, create, archive };
}
