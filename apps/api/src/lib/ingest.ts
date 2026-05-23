import { categoryFor, chapterFor, formatCode, isIcdCode } from "@icd-mapper/shared";
import type { Env } from "../types";

/**
 * Ingest of the yearly CMS "ICD-10-CM Codes, ESRD, CMS-HCC and RxHCC Models"
 * mappings spreadsheet (saved as CSV) into D1.
 *
 * The file lives in R2 under STORAGE/data/raw/*.csv. The scheduled handler
 * picks the most-recently-uploaded CSV under that prefix, checks the etag
 * against the last completed import (skip when unchanged), then upserts every
 * row into `icd10_codes` and records the run in `icd_imports`.
 */

export const DEFAULT_INGEST_PREFIX = "data/raw/";

// ---------- CSV format ------------------------------------------------------
// 14 columns. The header row spans multiple physical lines (each column label
// is wrapped in quotes with embedded \n), so we tokenize the whole file
// respecting quotes rather than splitting on \n.
const EXPECTED_COLS = 14;
const METADATA_LINES = 3; // "ICD-10-CM Codes...", "Includes FY2024/2025", ""
const HEADER_LINES = 1;

interface ParsedRow {
  code: string;
  description: string;
  hccEsrdV21: number | null;
  hccEsrdV24: number | null;
  hccV22: number | null;
  hccV24: number | null;
  hccV28: number | null;
  rxhccV08: number | null;
  hccEsrdV21Py2025: number | null;
  hccEsrdV24Py2025: number | null;
  hccV22Py2025: number | null;
  hccV24Py2025: number | null;
  hccV28Py2025: number | null;
  rxhccV08Py2025: number | null;
}

export interface IngestResult {
  importId: number;
  r2Key: string;
  etag: string | null;
  rowsParsed: number;
  rowsWritten: number;
  status: "completed" | "skipped";
  reason?: string;
  durationMs: number;
}

export class IngestError extends Error {
  constructor(message: string, public readonly importId?: number) {
    super(message);
    this.name = "IngestError";
  }
}

// ---------------------------------------------------------------------------

/**
 * Find the most recently uploaded CSV under `prefix` in the STORAGE bucket.
 * Returns null when no CSV is present.
 */
export async function findLatestCsv(
  env: Env,
  prefix = DEFAULT_INGEST_PREFIX
): Promise<R2Object | null> {
  // R2 list paginates at 1000; data/raw/ has a handful of files so one page is
  // plenty. If that ever changes, paginate with `cursor`.
  const list = await env.STORAGE.list({ prefix });
  const csvs = list.objects.filter((o) => o.key.toLowerCase().endsWith(".csv"));
  if (csvs.length === 0) return null;
  csvs.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());
  return csvs[0]!;
}

/**
 * Main entry point used by both the cron handler and the manual admin route.
 *
 * - Skips when the latest file's etag matches the last completed import.
 * - Records a row in `icd_imports` for observability (status: running →
 *   completed | failed | skipped).
 */
export async function ingestLatest(
  env: Env,
  opts: { trigger: "cron" | "manual"; prefix?: string; force?: boolean }
): Promise<IngestResult> {
  const started = Date.now();
  const prefix = opts.prefix ?? env.INGEST_R2_PREFIX ?? DEFAULT_INGEST_PREFIX;

  const head = await findLatestCsv(env, prefix);
  if (!head) {
    throw new IngestError(`No CSV found under R2 prefix '${prefix}'`);
  }

  // Skip if we've already ingested this exact file (etag match).
  if (!opts.force) {
    const last = await env.DB.prepare(
      `SELECT etag FROM icd_imports
       WHERE status = 'completed' AND r2_key = ?1
       ORDER BY id DESC LIMIT 1`
    )
      .bind(head.key)
      .first<{ etag: string | null }>();
    if (last?.etag && head.etag && last.etag === head.etag) {
      const skipped = await env.DB.prepare(
        `INSERT INTO icd_imports (r2_key, etag, size_bytes, status, trigger, completed_at)
         VALUES (?1, ?2, ?3, 'skipped', ?4, datetime('now'))
         RETURNING id`
      )
        .bind(head.key, head.etag, head.size, opts.trigger)
        .first<{ id: number }>();
      return {
        importId: skipped!.id,
        r2Key: head.key,
        etag: head.etag,
        rowsParsed: 0,
        rowsWritten: 0,
        status: "skipped",
        reason: "etag_unchanged",
        durationMs: Date.now() - started,
      };
    }
  }

  // Open a 'running' record. We'll patch it on success/failure.
  const running = await env.DB.prepare(
    `INSERT INTO icd_imports (r2_key, etag, size_bytes, status, trigger)
     VALUES (?1, ?2, ?3, 'running', ?4)
     RETURNING id`
  )
    .bind(head.key, head.etag ?? null, head.size, opts.trigger)
    .first<{ id: number }>();
  const importId = running!.id;

  try {
    const obj = await env.STORAGE.get(head.key);
    if (!obj) throw new IngestError(`R2 object disappeared: ${head.key}`, importId);
    const text = await obj.text();
    const rows = parseMappingsCsv(text);
    if (rows.length === 0) {
      throw new IngestError("No data rows parsed from CSV", importId);
    }

    const { inserted, updated } = await writeRows(env, rows, head.key);

    await env.DB.prepare(
      `UPDATE icd_imports
       SET status='completed', row_count=?1, inserted=?2, updated=?3, completed_at=datetime('now')
       WHERE id=?4`
    )
      .bind(rows.length, inserted, updated, importId)
      .run();

    return {
      importId,
      r2Key: head.key,
      etag: head.etag ?? null,
      rowsParsed: rows.length,
      rowsWritten: inserted + updated,
      status: "completed",
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `UPDATE icd_imports
       SET status='failed', error=?1, completed_at=datetime('now')
       WHERE id=?2`
    )
      .bind(message.slice(0, 1000), importId)
      .run()
      .catch(() => {});
    if (err instanceof IngestError) throw err;
    throw new IngestError(message, importId);
  }
}

// ---------- writer ---------------------------------------------------------

const BATCH_SIZE = 100;

/**
 * Writes the parsed rows into D1 in two phases:
 *
 *   1. Upsert one row per *unique* code into `icd10_codes` (preserves the FTS5
 *      index via existing triggers). `inserted`/`updated` reported here.
 *   2. Wipe and re-insert `icd10_hcc_mappings` rows for those codes — a single
 *      code can carry multiple HCC categorization variants, so we do not try
 *      to merge or deduplicate. The CSV is authoritative for this table.
 */
async function writeRows(
  env: Env,
  rows: ParsedRow[],
  sourceFile: string
): Promise<{ inserted: number; updated: number }> {
  // ---- Phase 1: dedupe by code and upsert canonical rows ------------------
  const byCode = new Map<string, ParsedRow>();
  for (const r of rows) {
    // Keep the first occurrence's description — they're identical for all
    // duplicate-code rows in the CMS file. Subsequent rows differ only in
    // their HCC variant columns.
    if (!byCode.has(r.code)) byCode.set(r.code, r);
  }
  const uniqueCodes = [...byCode.keys()];

  // Pre-fetch which codes already exist so we can report inserted vs updated.
  const existing = new Set<string>();
  for (let i = 0; i < uniqueCodes.length; i += 500) {
    const chunk = uniqueCodes.slice(i, i + 500);
    const placeholders = chunk.map((_, j) => `?${j + 1}`).join(",");
    const res = await env.DB.prepare(
      `SELECT code FROM icd10_codes WHERE code IN (${placeholders})`
    )
      .bind(...chunk)
      .all<{ code: string }>();
    for (const r of res.results ?? []) existing.add(r.code);
  }

  const upsertCode = env.DB.prepare(
    `INSERT INTO icd10_codes (code, description, category, chapter, source_file, imported_at)
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
     ON CONFLICT(code) DO UPDATE SET
       description = excluded.description,
       category    = excluded.category,
       chapter     = excluded.chapter,
       source_file = excluded.source_file,
       imported_at = excluded.imported_at`
  );

  for (let i = 0; i < uniqueCodes.length; i += BATCH_SIZE) {
    const chunk = uniqueCodes.slice(i, i + BATCH_SIZE);
    const batch = chunk.map((code) => {
      const r = byCode.get(code)!;
      const undotted = code.replace(".", "");
      return upsertCode.bind(
        code,
        r.description,
        categoryFor(undotted),
        chapterFor(undotted),
        sourceFile
      );
    });
    await env.DB.batch(batch);
  }

  // ---- Phase 2: rebuild HCC mapping rows for these codes ------------------
  // Pull id ↔ code for the codes we touched so we can FK the mapping rows.
  const codeToId = new Map<string, number>();
  for (let i = 0; i < uniqueCodes.length; i += 500) {
    const chunk = uniqueCodes.slice(i, i + 500);
    const placeholders = chunk.map((_, j) => `?${j + 1}`).join(",");
    const res = await env.DB.prepare(
      `SELECT id, code FROM icd10_codes WHERE code IN (${placeholders})`
    )
      .bind(...chunk)
      .all<{ id: number; code: string }>();
    for (const r of res.results ?? []) codeToId.set(r.code, r.id);
  }

  // Delete prior mapping rows for these codes. One DELETE…IN per chunk keeps
  // the round-trip count low.
  const allIds = uniqueCodes
    .map((code) => codeToId.get(code))
    .filter((id): id is number => typeof id === "number");
  for (let i = 0; i < allIds.length; i += 500) {
    const chunk = allIds.slice(i, i + 500);
    const placeholders = chunk.map((_, j) => `?${j + 1}`).join(",");
    await env.DB.prepare(
      `DELETE FROM icd10_hcc_mappings WHERE icd10_code_id IN (${placeholders})`
    )
      .bind(...chunk)
      .run();
  }

  // Insert one mapping row per CSV row (including duplicates by code).
  const insertMapping = env.DB.prepare(
    `INSERT INTO icd10_hcc_mappings (
       icd10_code_id,
       hcc_esrd_v21, hcc_esrd_v24, hcc_v22, hcc_v24, hcc_v28, rxhcc_v08,
       hcc_esrd_v21_py2025, hcc_esrd_v24_py2025, hcc_v22_py2025,
       hcc_v24_py2025, hcc_v28_py2025, rxhcc_v08_py2025,
       source_file
     ) VALUES (
       ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
     )`
  );

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch: D1PreparedStatement[] = [];
    for (const r of rows.slice(i, i + BATCH_SIZE)) {
      const codeId = codeToId.get(r.code);
      if (codeId === undefined) continue;
      batch.push(
        insertMapping.bind(
          codeId,
          r.hccEsrdV21,
          r.hccEsrdV24,
          r.hccV22,
          r.hccV24,
          r.hccV28,
          r.rxhccV08,
          r.hccEsrdV21Py2025,
          r.hccEsrdV24Py2025,
          r.hccV22Py2025,
          r.hccV24Py2025,
          r.hccV28Py2025,
          r.rxhccV08Py2025,
          sourceFile
        )
      );
    }
    if (batch.length > 0) await env.DB.batch(batch);
  }

  let inserted = 0;
  let updated = 0;
  for (const code of uniqueCodes) {
    if (existing.has(code)) updated++;
    else inserted++;
  }
  return { inserted, updated };
}

// ---------- parser ----------------------------------------------------------

/**
 * Tokenize the CSV into "logical lines" — handling quoted regions that
 * contain literal newlines (the header row has six of them per column).
 */
function splitLogicalLines(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      out.push(current);
      current = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      current += ch;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseInt10(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function parseYesNo(s: string): number | null {
  const v = s.trim().toLowerCase();
  if (v === "yes") return 1;
  if (v === "no") return 0;
  return null;
}

export function parseMappingsCsv(text: string): ParsedRow[] {
  const lines = splitLogicalLines(text);
  const dataStart = METADATA_LINES + HEADER_LINES;
  const rows: ParsedRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const cols = parseLine(line);
    if (cols.length < EXPECTED_COLS) continue;

    const rawCode = (cols[0] ?? "").trim();
    if (!isIcdCode(rawCode)) continue; // skips footer rows like "Output: ...", "Source: ..."

    rows.push({
      code: formatCode(rawCode),
      description: (cols[1] ?? "").trim(),
      hccEsrdV21: parseInt10(cols[2] ?? ""),
      hccEsrdV24: parseInt10(cols[3] ?? ""),
      hccV22: parseInt10(cols[4] ?? ""),
      hccV24: parseInt10(cols[5] ?? ""),
      hccV28: parseInt10(cols[6] ?? ""),
      rxhccV08: parseInt10(cols[7] ?? ""),
      hccEsrdV21Py2025: parseYesNo(cols[8] ?? ""),
      hccEsrdV24Py2025: parseYesNo(cols[9] ?? ""),
      hccV22Py2025: parseYesNo(cols[10] ?? ""),
      hccV24Py2025: parseYesNo(cols[11] ?? ""),
      hccV28Py2025: parseYesNo(cols[12] ?? ""),
      rxhccV08Py2025: parseYesNo(cols[13] ?? ""),
    });
  }
  return rows;
}
