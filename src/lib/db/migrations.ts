import type { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM _migrations'
  );
  const current = row?.version ?? 0;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id                     TEXT    PRIMARY KEY NOT NULL,
        name                   TEXT    NOT NULL,
        type                   TEXT    NOT NULL CHECK(type IN ('cash','bank','card','savings')),
        currency               TEXT    NOT NULL DEFAULT 'USD',
        opening_balance_minor  INTEGER NOT NULL DEFAULT 0,
        color                  TEXT    NOT NULL DEFAULT '#8A8F98',
        archived               INTEGER NOT NULL DEFAULT 0,
        created_at             INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id       TEXT    PRIMARY KEY NOT NULL,
        name     TEXT    NOT NULL,
        kind     TEXT    NOT NULL CHECK(kind IN ('expense','income')),
        glyph    TEXT    NOT NULL,
        color    TEXT    NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        sort     INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id                TEXT    PRIMARY KEY NOT NULL,
        account_id        TEXT    NOT NULL REFERENCES accounts(id),
        category_id       TEXT    REFERENCES categories(id),
        kind              TEXT    NOT NULL CHECK(kind IN ('outflow','inflow','transfer')),
        amount_minor      INTEGER NOT NULL CHECK(amount_minor > 0),
        note              TEXT,
        occurred_at       INTEGER NOT NULL,
        created_at        INTEGER NOT NULL,
        transfer_group_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tx_occurred_at  ON transactions(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_tx_account_id   ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_tx_category_id  ON transactions(category_id);
      CREATE TABLE IF NOT EXISTS budgets (
        id           TEXT    PRIMARY KEY NOT NULL,
        category_id  TEXT    NOT NULL REFERENCES categories(id),
        period       TEXT    NOT NULL CHECK(period IN ('weekly','monthly')),
        amount_minor INTEGER NOT NULL,
        start_date   INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 1);
  }

  if (current < 2) {
    // Seed default categories and user-facing settings on first run.
    await db.execAsync(`
      INSERT OR IGNORE INTO categories (id,name,kind,glyph,color,sort) VALUES
        ('cat_food',      'Food',      'expense', 'fork.knife',         '#E5484D', 1),
        ('cat_transport', 'Transport', 'expense', 'car.fill',           '#8A8F98', 2),
        ('cat_rent',      'Rent',      'expense', 'house.fill',         '#8A8F98', 3),
        ('cat_utilities', 'Utilities', 'expense', 'bolt.fill',          '#8A8F98', 4),
        ('cat_fun',       'Fun',       'expense', 'gamecontroller.fill','#8A8F98', 5),
        ('cat_health',    'Health',    'expense', 'heart.fill',         '#8A8F98', 6),
        ('cat_income',    'Income',    'income',  'banknote.fill',      '#F2F0EB', 7);
      INSERT OR IGNORE INTO settings (key,value) VALUES
        ('currency',          'USD'),
        ('first_day_of_week', '1'),
        ('haptics_enabled',   'true');
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 2);
  }
}
