import type { D1Database } from "@cloudflare/workers-types";
import type { IcdMatch } from "@icd-mapper/shared";

/**
 * Sanitize free-text into a safe FTS5 MATCH expression.
 */
export function buildFtsQuery(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/["*():\-+^]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const tokens = cleaned.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;

  return tokens.map((t) => `"${t}"*`).join(" OR ");
}

function rankToConfidence(rank: number, bestRank: number): number {
  if (bestRank === 0) return 1;
  const ratio = bestRank / rank;
  return Math.max(0, Math.min(1, ratio));
}

interface FtsRow {
  id: number;
  code: string;
  description: string;
  category: string | null;
  chapter: string | null;
  rank: number;
}

export async function searchIcd(
  db: D1Database,
  query: string,
  limit = 5
): Promise<IcdMatch[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const stmt = db
    .prepare(
      `SELECT c.id, c.code, c.description, c.category, c.chapter, bm25(icd10_fts) AS rank
       FROM icd10_fts
       JOIN icd10_codes c ON c.id = icd10_fts.rowid
       WHERE icd10_fts MATCH ?1
       ORDER BY rank
       LIMIT ?2`
    )
    .bind(ftsQuery, limit);

  const { results } = await stmt.all<FtsRow>();
  if (!results || results.length === 0) return [];

  const ranks = results.map((r) => Math.abs(r.rank));
  const bestRank = Math.min(...ranks);

  return results.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    category: r.category,
    chapter: r.chapter,
    confidence: Number(rankToConfidence(Math.abs(r.rank), bestRank).toFixed(4)),
  }));
}
