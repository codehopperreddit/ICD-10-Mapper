import type { SearchResponse } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { resolveAuth } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { logUsage } from "@/lib/server/usage-log";
import { searchIcd } from "@/lib/server/search";
import { json, apiError } from "@/lib/server/respond";


const SEARCH_CACHE_TTL = 60 * 60;

export async function GET(req: Request): Promise<Response> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in to use search.", 401);

  const rl = await checkRateLimit(env, auth);
  const rlHeaders = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.reset),
  };
  if (!rl.ok) {
    logUsage(env, auth, "/api/search", 429);
    return apiError(
      "rate_limited",
      `Daily quota of ${rl.limit} requests exceeded for tier '${auth.tier}'.`,
      429,
      rlHeaders
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? "5")));
  if (!q) {
    logUsage(env, auth, "/api/search", 400);
    return apiError("bad_request", "Query 'q' is required.", 400, rlHeaders);
  }
  if (q.length > 200) {
    logUsage(env, auth, "/api/search", 400);
    return apiError("bad_request", "Query too long (max 200 chars).", 400, rlHeaders);
  }

  const cacheKey = `search:${limit}:${q.toLowerCase()}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached) {
    logUsage(env, auth, "/api/search", 200);
    return json(
      { query: q, matches: cached as SearchResponse["matches"], cached: true },
      200,
      rlHeaders
    );
  }

  const matches = await searchIcd(env.DB, q, limit);
  await env.CACHE.put(cacheKey, JSON.stringify(matches), { expirationTtl: SEARCH_CACHE_TTL });
  logUsage(env, auth, "/api/search", 200);
  return json({ query: q, matches, cached: false }, 200, rlHeaders);
}
