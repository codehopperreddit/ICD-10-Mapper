import type { IcdMatch } from "@icd-mapper/shared";

/**
 * Sanitize free-text into a safe FTS5 MATCH expression.
 *
 * - Strip characters FTS5 treats as operators (",*,(,),:,-,+,^).
 * - Tokenize on whitespace.
 * - Quote each token and append `*` for prefix matching.
 * - Combine with OR so partial matches still hit.
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

/**
 * Convert FTS5 BM25 rank (lower = better, can be negative) into a confidence
 * score in [0, 1]. We normalize across the result set so the top match is 1.0.
 */
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

  // Join FTS virtual table back to icd10_codes via the rowid contract.
  // bm25() returns a rank where smaller is better; we negate so we can ORDER BY DESC
  // for clearer mental model below.
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

  // BM25 is negative-tending; the smallest (most negative) value wins.
  // Use absolute value so the relative magnitudes work for confidence.
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
