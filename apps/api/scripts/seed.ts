#!/usr/bin/env -S node --experimental-strip-types
/**
 * Seed D1 with the CMS ICD-10-CM 2024 flat file.
 *
 * The flat file format (icd10cm-codes-2024.txt) is fixed-width:
 *   columns 1-7   : ICD-10-CM code (no decimal)
 *   columns 9-... : full description
 *
 * Download (manually, since the URL changes year to year):
 *   https://www.cms.gov/medicare/coding-billing/icd-10-codes
 * Drop the unzipped flat file at: data/raw/icd10cm-codes-2024.txt
 *
 * Usage:
 *   pnpm db:seed                 # seeds production via wrangler
 *   pnpm db:seed --local         # seeds local D1
 *   pnpm db:seed --env staging   # seeds staging
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { categoryFor, chapterFor, formatCode } from "@icd-mapper/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const RAW_PATH = resolve(ROOT, "data/raw/icd10cm-codes-2024.txt");
const TMP_DIR = resolve(__dirname, "../.seed");
const BATCH_SIZE = 500; // D1 limits statements per request; keep batches small.

interface Row {
  code: string;
  description: string;
  category: string;
  chapter: string | null;
}

function parseFlatFile(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // Two formats appear in the wild:
    //   "A000    Cholera due to Vibrio cholerae 01, biovar cholerae"
    //   "A00.0\tCholera due to Vibrio cholerae 01, biovar cholerae"
    // Split on the first run of whitespace to be safe.
    const match = line.match(/^(\S+)\s+(.+)$/);
    if (!match) continue;
    const rawCode = match[1]!.replace(".", "");
    const description = match[2]!.trim();
    const code = formatCode(rawCode);
    rows.push({
      code,
      description,
      category: categoryFor(rawCode),
      chapter: chapterFor(rawCode),
    });
  }
  return rows;
}

function escape(s: string): string {
  return s.replace(/'/g, "''");
}

function buildBatchSQL(rows: Row[]): string {
  const values = rows
    .map(
      (r) =>
        `('${escape(r.code)}','${escape(r.description)}','${escape(r.category)}',${
          r.chapter ? `'${escape(r.chapter)}'` : "NULL"
        })`
    )
    .join(",\n");
  return `INSERT OR IGNORE INTO icd10_codes (code, description, category, chapter) VALUES\n${values};`;
}

function passthrough(args: string[]) {
  // Forward CLI args (e.g. --local, --env staging) to wrangler.
  return args.filter((a) => a !== "--").join(" ");
}

function main() {
  const args = process.argv.slice(2);

  if (!existsSync(RAW_PATH)) {
    console.error(`Missing flat file: ${RAW_PATH}`);
    console.error("Download from https://www.cms.gov/medicare/coding-billing/icd-10-codes");
    console.error("and place at data/raw/icd10cm-codes-2024.txt");
    process.exit(1);
  }

  console.log(`Reading ${RAW_PATH}…`);
  const text = readFileSync(RAW_PATH, "utf8");
  const rows = parseFlatFile(text);
  console.log(`Parsed ${rows.length} ICD-10-CM rows.`);

  mkdirSync(TMP_DIR, { recursive: true });
  const sqlPath = resolve(TMP_DIR, "seed.sql");

  const chunks: string[] = [];
  chunks.push("PRAGMA defer_foreign_keys = TRUE;");
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    chunks.push(buildBatchSQL(rows.slice(i, i + BATCH_SIZE)));
  }
  // After bulk insert, rebuild the FTS index so triggers don't have to fire
  // for every row insert (much faster on D1).
  chunks.push("INSERT INTO icd10_fts(icd10_fts) VALUES ('rebuild');");

  writeFileSync(sqlPath, chunks.join("\n\n"));
  console.log(`Wrote ${sqlPath} (${(chunks.join("\n").length / 1024).toFixed(1)} KB)`);

  const wranglerArgs = [
    "d1",
    "execute",
    "icd-mapper",
    "--file",
    sqlPath,
    ...args,
  ];
  console.log(`Running: wrangler ${wranglerArgs.join(" ")}`);
  const res = spawnSync("wrangler", wranglerArgs, { stdio: "inherit" });
  if (res.status !== 0) {
    console.error("Seed failed.");
    process.exit(res.status ?? 1);
  }
  console.log("Seed complete.");
  console.log(passthrough(args));
}

main();
