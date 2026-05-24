-- ICD-10-CM core lookup table seeded from CMS 2024 flat file.
CREATE TABLE IF NOT EXISTS icd10_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  description TEXT    NOT NULL,
  category    TEXT,
  chapter     TEXT
);

CREATE INDEX IF NOT EXISTS idx_icd10_codes_code     ON icd10_codes(code);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_category ON icd10_codes(category);

-- FTS5 virtual table over the description column.
-- "external content" pattern keeps the FTS index in sync with icd10_codes
-- without duplicating the data.
CREATE VIRTUAL TABLE IF NOT EXISTS icd10_fts USING fts5(
  description,
  content='icd10_codes',
  content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2'
);

-- Triggers to keep the FTS index synchronized with the source table.
CREATE TRIGGER IF NOT EXISTS icd10_codes_ai AFTER INSERT ON icd10_codes BEGIN
  INSERT INTO icd10_fts(rowid, description) VALUES (new.id, new.description);
END;

CREATE TRIGGER IF NOT EXISTS icd10_codes_ad AFTER DELETE ON icd10_codes BEGIN
  INSERT INTO icd10_fts(icd10_fts, rowid, description) VALUES ('delete', old.id, old.description);
END;

CREATE TRIGGER IF NOT EXISTS icd10_codes_au AFTER UPDATE ON icd10_codes BEGIN
  INSERT INTO icd10_fts(icd10_fts, rowid, description) VALUES ('delete', old.id, old.description);
  INSERT INTO icd10_fts(rowid, description) VALUES (new.id, new.description);
END;

-- Application tables -------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,            -- nanoid
  clerk_id   TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL,
  tier       TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','api')),
  paddle_customer_id   TEXT,
  razorpay_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,        -- SHA-256 hex of plaintext key
  prefix       TEXT NOT NULL,               -- first 8 chars for UI display
  name         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash    ON api_keys(key_hash);

CREATE TABLE IF NOT EXISTS usage_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint   TEXT NOT NULL,
  status     INTEGER NOT NULL,
  timestamp  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_ts  ON usage_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_input_key  TEXT NOT NULL,
  r2_output_key TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','completed','failed')),
  row_count     INTEGER,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_user_id ON bulk_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status  ON bulk_jobs(status);
