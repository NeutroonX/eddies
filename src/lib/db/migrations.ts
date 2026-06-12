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

  // IMPORTANT: checks must be in ascending order — `current` is captured once
  // before any migration runs, so execution order matches source order.

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id                     TEXT    PRIMARY KEY NOT NULL,
        name                   TEXT    NOT NULL,
        type                   TEXT    NOT NULL DEFAULT 'cash',
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
      CREATE INDEX IF NOT EXISTS idx_tx_occurred_at ON transactions(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_tx_account_id  ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_tx_category_id ON transactions(category_id);
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

  if (current < 3) {
    const accRow = await db.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM accounts WHERE archived = 0'
    );
    if (!accRow || accRow.cnt === 0) {
      await db.runAsync(
        `INSERT OR IGNORE INTO accounts
           (id,name,type,currency,opening_balance_minor,color,archived,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        'acc_default', 'Cash', 'cash', 'USD', 0, '#F2F0EB', 0, Date.now()
      );
    }
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 3);
  }

  if (current < 4) {
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_tx_archived ON transactions(archived);
      CREATE TABLE IF NOT EXISTS monthly_archives (
        id            TEXT    PRIMARY KEY NOT NULL,
        year          INTEGER NOT NULL,
        month         INTEGER NOT NULL,
        label         TEXT    NOT NULL,
        total_inflow  INTEGER NOT NULL DEFAULT 0,
        total_outflow INTEGER NOT NULL DEFAULT 0,
        tx_count      INTEGER NOT NULL DEFAULT 0,
        exported_csv  INTEGER NOT NULL DEFAULT 0,
        exported_pdf  INTEGER NOT NULL DEFAULT 0,
        archived_at   INTEGER,
        UNIQUE(year, month)
      );
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 4);
  }

  if (current < 5) {
    // Recreate accounts without the hard-coded type CHECK constraint so users
    // can store free-form types (crypto, investment, etc.).
    // DROP IF EXISTS guards against a partial previous run.
    await db.execAsync(`
      DROP TABLE IF EXISTS accounts_v5;
      CREATE TABLE accounts_v5 (
        id                     TEXT    PRIMARY KEY NOT NULL,
        name                   TEXT    NOT NULL,
        type                   TEXT    NOT NULL DEFAULT 'cash',
        currency               TEXT    NOT NULL DEFAULT 'USD',
        opening_balance_minor  INTEGER NOT NULL DEFAULT 0,
        color                  TEXT    NOT NULL DEFAULT '#8A8F98',
        archived               INTEGER NOT NULL DEFAULT 0,
        created_at             INTEGER NOT NULL
      );
      INSERT INTO accounts_v5 SELECT * FROM accounts;
      DROP TABLE accounts;
      ALTER TABLE accounts_v5 RENAME TO accounts;
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 5);
  }

  if (current < 6) {
    // 1. Allow NULL account_id in transactions for "No Vault" entries.
    await db.execAsync(`
      DROP TABLE IF EXISTS transactions_v6;
      CREATE TABLE transactions_v6 (
        id                TEXT    PRIMARY KEY NOT NULL,
        account_id        TEXT    REFERENCES accounts(id), -- No longer NOT NULL
        category_id       TEXT    REFERENCES categories(id),
        kind              TEXT    NOT NULL CHECK(kind IN ('outflow','inflow','transfer')),
        amount_minor      INTEGER NOT NULL CHECK(amount_minor > 0),
        note              TEXT,
        occurred_at       INTEGER NOT NULL,
        created_at        INTEGER NOT NULL,
        transfer_group_id TEXT,
        archived          INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO transactions_v6 SELECT * FROM transactions;
      DROP TABLE transactions;
      ALTER TABLE transactions_v6 RENAME TO transactions;
      CREATE INDEX IF NOT EXISTS idx_tx_occurred_at ON transactions(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_tx_account_id  ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_tx_category_id ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_tx_archived    ON transactions(archived);
    `);

    // 2. Add columns for Bank, UPI, and Card details to accounts.
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN bank_account_number TEXT;
      ALTER TABLE accounts ADD COLUMN bank_ifsc           TEXT;
      ALTER TABLE accounts ADD COLUMN bank_branch         TEXT;
      ALTER TABLE accounts ADD COLUMN upi_id              TEXT;
      ALTER TABLE accounts ADD COLUMN upi_phone           TEXT;
      ALTER TABLE accounts ADD COLUMN card_network        TEXT;
      ALTER TABLE accounts ADD COLUMN card_last_four      TEXT;
      ALTER TABLE accounts ADD COLUMN card_expiry         TEXT;
    `);

    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 6);
  }

  if (current < 7) {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN bank_account_type TEXT;
      ALTER TABLE accounts ADD COLUMN card_full_number   TEXT;
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 7);
  }

  if (current < 8) {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN card_cvv TEXT;
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 8);
  }

  // v9 — Recurring & scheduled transactions (Beta v2, M5).
  // New recurring_rules table + provenance columns on transactions.
  if (current < 9) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_rules (
        id                TEXT    PRIMARY KEY NOT NULL,
        account_id        TEXT    REFERENCES accounts(id),
        category_id       TEXT    REFERENCES categories(id),
        kind              TEXT    NOT NULL CHECK(kind IN ('outflow','inflow','transfer')),
        amount_minor      INTEGER NOT NULL CHECK(amount_minor > 0),
        note              TEXT,
        freq              TEXT    NOT NULL CHECK(freq IN ('daily','weekly','monthly','yearly')),
        interval_n        INTEGER NOT NULL DEFAULT 1 CHECK(interval_n > 0),
        anchor_day        INTEGER,
        start_date        INTEGER NOT NULL,
        end_kind          TEXT    NOT NULL DEFAULT 'never' CHECK(end_kind IN ('never','on_date','after_n')),
        end_date          INTEGER,
        end_count         INTEGER,
        occurrences_made  INTEGER NOT NULL DEFAULT 0,
        mode              TEXT    NOT NULL DEFAULT 'confirm' CHECK(mode IN ('auto','confirm')),
        last_run_at       INTEGER,
        paused            INTEGER NOT NULL DEFAULT 0,
        archived          INTEGER NOT NULL DEFAULT 0,
        created_at        INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_rules(archived, paused);
    `);
    // Tag each transaction with its origin; v1 rows default to 'manual'.
    // ALTER … ADD COLUMN with NOT NULL DEFAULT safely backfills existing rows.
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
      ALTER TABLE transactions ADD COLUMN recurring_rule_id TEXT;
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 9);
  }

  // v10 — On-device SMS import (Beta v2, M7).
  // `pending_imports` is the shared review queue for parsed SMS *and* confirm-mode
  // recurring occurrences (§5.1/§5.3). `raw_excerpt` is on-device only and is
  // explicitly excluded from cloud-backup serialization.
  if (current < 10) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_imports (
        id                    TEXT    PRIMARY KEY NOT NULL,
        origin                TEXT    NOT NULL CHECK(origin IN ('sms','recurring')),
        amount_minor          INTEGER NOT NULL CHECK(amount_minor > 0),
        kind                  TEXT    NOT NULL CHECK(kind IN ('outflow','inflow','transfer')),
        suggested_account_id  TEXT    REFERENCES accounts(id),
        suggested_category_id TEXT    REFERENCES categories(id),
        merchant              TEXT,
        note                  TEXT,
        occurred_at           INTEGER NOT NULL,
        raw_excerpt           TEXT,
        dedup_hash            TEXT    NOT NULL,
        confidence            REAL    NOT NULL DEFAULT 0,
        status                TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','dismissed')),
        recurring_rule_id     TEXT    REFERENCES recurring_rules(id),
        created_at            INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_dedup  ON pending_imports(dedup_hash);
      CREATE INDEX IF NOT EXISTS        idx_pending_status ON pending_imports(status);
    `);
    await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', 10);
  }
}
