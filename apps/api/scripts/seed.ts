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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const RAW_PATH = resolve(ROOT, "data/raw/icd10cm-codes-2024.txt");
const TMP_DIR = resolve(__dirname, "../.seed");
const BATCH_SIZE = 500; // D1 limits statements per request; keep batches small.

// ---------- ICD-10 chapter map ------------------------------------------------
// Standard 22 chapters from ICD-10-CM. Used to derive `chapter` from code prefix.
interface Chapter {
  number: number;
  title: string;
  /** Inclusive range of leading 3-char code prefixes. */
  start: string;
  end: string;
}

const CHAPTERS: Chapter[] = [
  { number: 1,  title: "Certain infectious and parasitic diseases", start: "A00", end: "B99" },
  { number: 2,  title: "Neoplasms", start: "C00", end: "D49" },
  { number: 3,  title: "Diseases of the blood and blood-forming organs and certain disorders involving the immune mechanism", start: "D50", end: "D89" },
  { number: 4,  title: "Endocrine, nutritional and metabolic diseases", start: "E00", end: "E89" },
  { number: 5,  title: "Mental, Behavioral and Neurodevelopmental disorders", start: "F01", end: "F99" },
  { number: 6,  title: "Diseases of the nervous system", start: "G00", end: "G99" },
  { number: 7,  title: "Diseases of the eye and adnexa", start: "H00", end: "H59" },
  { number: 8,  title: "Diseases of the ear and mastoid process", start: "H60", end: "H95" },
  { number: 9,  title: "Diseases of the circulatory system", start: "I00", end: "I99" },
  { number: 10, title: "Diseases of the respiratory system", start: "J00", end: "J99" },
  { number: 11, title: "Diseases of the digestive system", start: "K00", end: "K95" },
  { number: 12, title: "Diseases of the skin and subcutaneous tissue", start: "L00", end: "L99" },
  { number: 13, title: "Diseases of the musculoskeletal system and connective tissue", start: "M00", end: "M99" },
  { number: 14, title: "Diseases of the genitourinary system", start: "N00", end: "N99" },
  { number: 15, title: "Pregnancy, childbirth and the puerperium", start: "O00", end: "O9A" },
  { number: 16, title: "Certain conditions originating in the perinatal period", start: "P00", end: "P96" },
  { number: 17, title: "Congenital malformations, deformations and chromosomal abnormalities", start: "Q00", end: "Q99" },
  { number: 18, title: "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified", start: "R00", end: "R99" },
  { number: 19, title: "Injury, poisoning and certain other consequences of external causes", start: "S00", end: "T88" },
  { number: 20, title: "External causes of morbidity", start: "V00", end: "Y99" },
  { number: 21, title: "Factors influencing health status and contact with health services", start: "Z00", end: "Z99" },
  { number: 22, title: "Codes for special purposes", start: "U00", end: "U85" },
];

function chapterFor(code: string): string | null {
  const prefix = code.slice(0, 3).toUpperCase();
  for (const ch of CHAPTERS) {
    if (prefix >= ch.start && prefix <= ch.end) {
      return `Ch ${ch.number}: ${ch.title}`;
    }
  }
  return null;
}

function categoryFor(code: string): string {
  // Standard ICD-10-CM convention: first three characters denote the category.
  return code.slice(0, 3).toUpperCase();
}

function formatCode(raw: string): string {
  // CMS flat file omits the decimal point. ICD-10-CM convention puts a "." after
  // the third character when the code is longer than 3 chars.
  const c = raw.trim().toUpperCase();
  if (c.length <= 3) return c;
  return `${c.slice(0, 3)}.${c.slice(3)}`;
}

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
