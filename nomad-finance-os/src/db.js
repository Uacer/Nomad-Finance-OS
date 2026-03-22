const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { DEFAULT_EXPENSE_CATEGORIES } = require("./constants");

function createDb(filename = ":memory:") {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  const schemaPath = path.join(__dirname, "schema.sql");
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  runMigrations(db);
  return db;
}

function runMigrations(db) {
  ensureColumn(db, "users", "email", "TEXT");
  ensureColumn(db, "accounts", "opening_balance", "NUMERIC NOT NULL DEFAULT 0");
  ensureColumn(db, "user_settings", "ui_language", "TEXT NOT NULL DEFAULT 'en'");
  ensureColumn(db, "user_settings", "currency_display_mode", "TEXT NOT NULL DEFAULT 'code'");
  ensureColumn(db, "budgets", "budget_currency", "TEXT");
  ensureColumn(db, "yearly_budgets", "budget_currency", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS crypto_token_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      price NUMERIC NOT NULL,
      price_currency TEXT NOT NULL DEFAULT 'USD',
      source TEXT NOT NULL DEFAULT 'manual',
      as_of TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crypto_token_prices_user_id ON crypto_token_prices(user_id)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS crypto_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, account_id, symbol),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crypto_positions_user_id ON crypto_positions(user_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crypto_positions_account_id ON crypto_positions(account_id)
  `);
  ensureColumn(db, "crypto_token_prices", "price_currency", "TEXT NOT NULL DEFAULT 'USD'");
  ensureColumn(db, "crypto_token_prices", "source", "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn(db, "crypto_token_prices", "as_of", "TEXT");
  ensureColumn(db, "crypto_token_prices", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  ensureColumn(db, "crypto_positions", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase
    ON users(email COLLATE NOCASE)
    WHERE email IS NOT NULL
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_email_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email_normalized TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      requested_ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_email_codes_user ON auth_email_codes(user_id, created_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_email_codes_lookup
    ON auth_email_codes(email_normalized, code_hash, created_at DESC)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_magic_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email_normalized TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      requested_ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_magic_links_hash ON auth_magic_links(token_hash)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_magic_links_user ON auth_magic_links(user_id, created_at DESC)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_hash ON auth_sessions(session_hash)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_api_tokens_hash ON auth_api_tokens(token_hash)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_api_tokens_user ON auth_api_tokens(user_id, created_at DESC)
  `);
  ensureColumn(db, "auth_magic_links", "email_normalized", "TEXT");
  ensureColumn(db, "auth_magic_links", "revoked", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "auth_magic_links", "requested_ip", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_email_codes", "code_hash", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_email_codes", "expires_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  ensureColumn(db, "auth_email_codes", "used_at", "TEXT");
  ensureColumn(db, "auth_email_codes", "email_normalized", "TEXT");
  ensureColumn(db, "auth_email_codes", "revoked", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "auth_email_codes", "requested_ip", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_email_codes", "user_agent", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_sessions", "revoked", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "auth_sessions", "last_seen_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  ensureColumn(db, "auth_api_tokens", "name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_api_tokens", "token_prefix", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_api_tokens", "token_hash", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "auth_api_tokens", "scopes_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "auth_api_tokens", "revoked", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "auth_api_tokens", "last_used_at", "TEXT");
  ensureColumn(db, "auth_api_tokens", "revoked_at", "TEXT");
  if (hasColumn(db, "auth_magic_links", "email")) {
    db.exec(`
      UPDATE auth_magic_links
      SET email_normalized = lower(email)
      WHERE email_normalized IS NULL OR trim(email_normalized) = ''
    `);
  }
  if (hasColumn(db, "auth_magic_links", "request_ip")) {
    db.exec(`
      UPDATE auth_magic_links
      SET requested_ip = request_ip
      WHERE requested_ip IS NULL OR trim(requested_ip) = ''
    `);
  }
  if (hasColumn(db, "auth_magic_links", "invalidated_at")) {
    db.exec(`
      UPDATE auth_magic_links
      SET revoked = 1
      WHERE revoked = 0 AND invalidated_at IS NOT NULL
    `);
  }
  if (hasColumn(db, "auth_sessions", "revoked_at")) {
    db.exec(`
      UPDATE auth_sessions
      SET revoked = 1
      WHERE revoked = 0 AND revoked_at IS NOT NULL
    `);
  }
  db.exec(`
    UPDATE auth_sessions
    SET last_seen_at = created_at
    WHERE last_seen_at IS NULL OR trim(last_seen_at) = ''
  `);

  // Legacy budgets had no currency column. Default historical assumption is USD
  // because the product bootstraps users with USD as initial base currency.
  db.exec(`
    UPDATE budgets
    SET budget_currency = 'USD'
    WHERE budget_currency IS NULL OR trim(budget_currency) = ''
  `);
  db.exec(`
    UPDATE yearly_budgets
    SET budget_currency = 'USD'
    WHERE budget_currency IS NULL OR trim(budget_currency) = ''
  `);
  db.exec(`
    UPDATE crypto_token_prices
    SET price_currency = 'USD'
    WHERE price_currency IS NULL OR trim(price_currency) = ''
  `);
  db.exec(`
    UPDATE crypto_token_prices
    SET source = 'manual'
    WHERE source IS NULL OR trim(source) = ''
  `);
  db.exec(`
    UPDATE crypto_token_prices
    SET updated_at = created_at
    WHERE updated_at IS NULL OR trim(updated_at) = ''
  `);
  db.exec(`
    UPDATE crypto_positions
    SET updated_at = created_at
    WHERE updated_at IS NULL OR trim(updated_at) = ''
  `);
}

function ensureColumn(db, table, column, ddl) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = rows.some((row) => row.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function hasColumn(db, table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((row) => row.name === column);
}

function ensureUserAndSeedDefaults(db, userId) {
  db.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").run(userId);
  db.prepare(
    `
      INSERT OR IGNORE INTO user_settings (user_id, base_currency, timezone, ui_language, currency_display_mode)
      VALUES (?, 'USD', 'UTC', 'en', 'code')
    `
  ).run(userId);

  const seedCategories = db.transaction(() => {
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM expense_category_l1 WHERE user_id = ?")
      .get(userId).count;
    if (count === 0) {
      const insertL1 = db.prepare(
        "INSERT INTO expense_category_l1 (user_id, name, is_default, active) VALUES (?, ?, 1, 1)"
      );
      const insertL2 = db.prepare(
        "INSERT INTO expense_category_l2 (user_id, l1_id, name, is_default, active) VALUES (?, ?, ?, 1, 1)"
      );
      for (const [l1Name, l2List] of Object.entries(DEFAULT_EXPENSE_CATEGORIES)) {
        const result = insertL1.run(userId, l1Name);
        const l1Id = Number(result.lastInsertRowid);
        for (const l2Name of l2List) {
          insertL2.run(userId, l1Id, l2Name);
        }
      }
    }
  });
  seedCategories();

}

function findOrCreateUserByEmail(db, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    throw new Error("Email is required.");
  }
  const existing = db
    .prepare("SELECT id, email, created_at FROM users WHERE lower(email) = lower(?)")
    .get(normalized);
  if (existing) {
    ensureUserAndSeedDefaults(db, existing.id);
    return existing;
  }
  const inserted = db.prepare("INSERT INTO users (email) VALUES (?)").run(normalized);
  const user = db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(Number(inserted.lastInsertRowid));
  ensureUserAndSeedDefaults(db, user.id);
  return user;
}

function getUserById(db, userId) {
  return db.prepare("SELECT id, email, created_at FROM users WHERE id = ?").get(userId) || null;
}

function normalizeMonth(month) {
  if (!month) return new Date().toISOString().slice(0, 7);
  return month.slice(0, 7);
}

module.exports = {
  createDb,
  ensureUserAndSeedDefaults,
  findOrCreateUserByEmail,
  getUserById,
  normalizeMonth
};
