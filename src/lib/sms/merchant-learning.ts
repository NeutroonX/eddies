/**
 * Lightweight learning for SMS import suggestions, persisted in the `settings`
 * key/value table (this project has no MMKV). Two maps:
 *   - merchant (lowercased) → category_id
 *   - account_tail (last 3-4 digits) → account_id
 *
 * Accepting an edited import teaches these maps so future scans auto-fill with
 * higher confidence. Tail→account also falls back to matching the user's stored
 * account card/number tails directly.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/lib/db/repos/settings-repo';

const MERCHANT_MAP_KEY = 'sms_merchant_map';
const TAIL_MAP_KEY = 'sms_tail_map';

type StringMap = Record<string, string>;

async function readMap(db: SQLiteDatabase, key: string): Promise<StringMap> {
  const raw = await getSetting(db, key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StringMap) : {};
  } catch {
    return {};
  }
}

async function writeMapEntry(
  db: SQLiteDatabase,
  key: string,
  field: string,
  value: string
): Promise<void> {
  const map = await readMap(db, key);
  map[field] = value;
  await setSetting(db, key, JSON.stringify(map));
}

const norm = (s: string) => s.trim().toLowerCase();

/** Remember that this merchant maps to this category (from an accepted import). */
export async function learnMerchantCategory(
  db: SQLiteDatabase,
  merchant: string,
  categoryId: string
): Promise<void> {
  if (!merchant.trim()) return;
  await writeMapEntry(db, MERCHANT_MAP_KEY, norm(merchant), categoryId);
}

export async function suggestCategory(
  db: SQLiteDatabase,
  merchant: string | null
): Promise<string | null> {
  if (!merchant) return null;
  const map = await readMap(db, MERCHANT_MAP_KEY);
  return map[norm(merchant)] ?? null;
}

/** Remember that this account tail maps to this account (from an accepted import). */
export async function learnTailAccount(
  db: SQLiteDatabase,
  tail: string,
  accountId: string
): Promise<void> {
  if (!tail.trim()) return;
  await writeMapEntry(db, TAIL_MAP_KEY, tail.trim(), accountId);
}

/**
 * Suggest an account for a parsed tail: first a learned mapping, then a direct
 * match against the user's stored card/bank-number tails.
 */
export async function suggestAccount(
  db: SQLiteDatabase,
  tail: string | null
): Promise<string | null> {
  if (!tail) return null;
  const map = await readMap(db, TAIL_MAP_KEY);
  if (map[tail]) return map[tail];

  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM accounts
       WHERE archived = 0
         AND (card_last_four = ?
              OR (bank_account_number IS NOT NULL AND substr(bank_account_number, -length(?)) = ?))
       LIMIT 1`,
    tail, tail, tail
  );
  return row?.id ?? null;
}
