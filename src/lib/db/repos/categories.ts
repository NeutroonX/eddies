import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

import { CategorySchema, type Category, type NewCategory } from '@/lib/schemas';

function genId(): string {
  return `cat_${crypto.randomUUID().replace(/-/g, '')}`;
}

export async function getAllCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync(
    'SELECT * FROM categories WHERE archived = 0 ORDER BY sort ASC, name ASC'
  );
  return z.array(CategorySchema).parse(rows);
}

export async function createCategory(db: SQLiteDatabase, data: NewCategory): Promise<Category> {
  const category: Category = { id: genId(), ...data, archived: 0 };
  await db.runAsync(
    `INSERT INTO categories (id,name,kind,glyph,color,archived,sort)
     VALUES (?,?,?,?,?,?,?)`,
    category.id, category.name, category.kind, category.glyph,
    category.color, category.archived, category.sort
  );
  return category;
}

export async function updateCategory(
  db: SQLiteDatabase,
  id: string,
  data: Partial<NewCategory>
): Promise<void> {
  const ALLOWED_COLS: Array<keyof NewCategory> = ['name', 'kind', 'glyph', 'color', 'sort'];
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  for (const col of ALLOWED_COLS) {
    if (col in data) {
      updates.push(`${col} = ?`);
      values.push(data[col] as string | number | null);
    }
  }
  if (updates.length === 0) return;
  await db.runAsync(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
    ...values,
    id
  );
}

export async function archiveCategory(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', id);
}

// Returns an existing non-archived category matching name+kind (case-insensitive),
// or creates a new one. Prevents duplicate "Other" rows on repeated saves.
export async function findOrCreateCategory(
  db: SQLiteDatabase,
  data: NewCategory
): Promise<Category> {
  const row = await db.getFirstAsync(
    'SELECT * FROM categories WHERE lower(name) = lower(?) AND kind = ? AND archived = 0 LIMIT 1',
    data.name.trim(),
    data.kind
  );
  if (row) return CategorySchema.parse(row);
  return createCategory(db, data);
}
