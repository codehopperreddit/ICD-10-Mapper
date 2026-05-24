-- Schema for the CMS "ICD-10-CM Codes, ESRD, CMS-HCC and RxHCC Models"
-- mappings spreadsheet (e.g. "2025 Midyear_Final ICD-10-CM Mappings.csv").
--
-- A single ICD-10-CM code can legitimately appear in multiple rows of that
-- spreadsheet — one row per HCC categorization "variant" — so the mappings
-- live in their own table with a many-to-many relationship to icd10_codes.

-- Provenance on the canonical code row.
ALTER TABLE icd10_codes ADD COLUMN source_file TEXT;
ALTER TABLE icd10_codes ADD COLUMN imported_at TEXT;

-- One row per (code, HCC mapping variant). A code that maps to two different
-- HCC categories gets two rows here.
CREATE TABLE IF NOT EXISTS icd10_hcc_mappings (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  icd10_code_id        INTEGER NOT NULL REFERENCES icd10_codes(id) ON DELETE CASCADE,

  -- CMS-HCC / RxHCC numeric category (NULL when blank in the source).
  hcc_esrd_v21         INTEGER,
  hcc_esrd_v24         INTEGER,
  hcc_v22              INTEGER,
  hcc_v24              INTEGER,
  hcc_v28              INTEGER,
  rxhcc_v08            INTEGER,

  -- "Used for 2025 Payment Year" boolean flags (0/1, NULL when blank).
  hcc_esrd_v21_py2025  INTEGER,
  hcc_esrd_v24_py2025  INTEGER,
  hcc_v22_py2025       INTEGER,
  hcc_v24_py2025       INTEGER,
  hcc_v28_py2025       INTEGER,
  rxhcc_v08_py2025     INTEGER,

  source_file          TEXT,
  imported_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hcc_mappings_code_id ON icd10_hcc_mappings(icd10_code_id);

-- Run history for the scheduled ingest. The worker uses `etag` to skip
-- re-ingesting an unchanged file.
CREATE TABLE IF NOT EXISTS icd_imports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key        TEXT    NOT NULL,
  etag          TEXT,
  size_bytes    INTEGER,
  row_count     INTEGER,
  inserted      INTEGER NOT NULL DEFAULT 0,
  updated       INTEGER NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL CHECK (status IN ('running','completed','failed','skipped')),
  trigger       TEXT    NOT NULL CHECK (trigger IN ('cron','manual')),
  error         TEXT,
  started_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_icd_imports_etag    ON icd_imports(etag);
CREATE INDEX IF NOT EXISTS idx_icd_imports_status  ON icd_imports(status);
CREATE INDEX IF NOT EXISTS idx_icd_imports_started ON icd_imports(started_at);
