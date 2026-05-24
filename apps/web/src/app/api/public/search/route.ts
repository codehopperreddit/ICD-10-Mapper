import type { SearchResponse } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { searchIcd } from "@/lib/server/search";
import { json, apiError } from "@/lib/server/respond";


const PUBLIC_DAILY_LIMIT = 20;
const SEARCH_CACHE_TTL = 60 * 60;

/**
 * Unauthenticated demo search for the landing page. Rate-limited per IP.
 * Same-origin, so no CORS handling needed.
 */
export async function GET(req: Request): Promise<Response> {
  const env = getEnv();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? "5")));
  if (!q) return apiError("bad_request", "Query 'q' is required.", 400);
  if (q.length > 200) return apiError("bad_request", "Query too long (max 200 chars).", 400);

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `public_rl:${ip}:${day}`;
  const current = Number((await env.CACHE.get(rlKey)) ?? 0);

  if (current >= PUBLIC_DAILY_LIMIT) {
    return apiError(
      "rate_limited",
      `Public demo limit of ${PUBLIC_DAILY_LIMIT} lookups per day reached. Sign up for higher limits.`,
      429,
      { "X-RateLimit-Limit": String(PUBLIC_DAILY_LIMIT), "X-RateLimit-Remaining": "0" }
    );
  }

  await env.CACHE.put(rlKey, String(current + 1), { expirationTtl: 60 * 60 * 26 });
  const headers = {
    "X-RateLimit-Limit": String(PUBLIC_DAILY_LIMIT),
    "X-RateLimit-Remaining": String(Math.max(0, PUBLIC_DAILY_LIMIT - current - 1)),
  };

  const cacheKey = `search:${limit}:${q.toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) {
    return json(
      { query: q, matches: cached as SearchResponse["matches"], cached: true },
      200,
      headers
    );
  }

  const matches = await searchIcd(env.DB, q, limit);
  await env.CACHE.put(cacheKey, JSON.stringify(matches), { expirationTtl: SEARCH_CACHE_TTL });
  return json({ query: q, matches, cached: false }, 200, headers);
}
