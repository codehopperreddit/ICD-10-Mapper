import { Hono } from "hono";
import type { SearchResponse } from "@icd-mapper/shared";
import { searchIcd } from "../lib/search";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { logUsage } from "../middleware/usage-log";
import type { Env, Variables } from "../types";

const SEARCH_CACHE_TTL = 60 * 60; // 1 hour

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requireAuth(), rateLimit(), logUsage("/api/search"));

app.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(c.req.query("limit") ?? "5")));
  if (!q) {
    return c.json({ error: "bad_request", message: "Query 'q' is required." }, 400);
  }
  if (q.length > 200) {
    return c.json({ error: "bad_request", message: "Query too long (max 200 chars)." }, 400);
  }

  const cacheKey = `search:${limit}:${q.toLowerCase()}`;
  const cached = await c.env.CACHE.get(cacheKey, "json");
  if (cached) {
    return c.json<SearchResponse>({
      query: q,
      matches: cached as SearchResponse["matches"],
      cached: true,
    });
  }

  const matches = await searchIcd(c.env.DB, q, limit);
  c.executionCtx.waitUntil(
    c.env.CACHE.put(cacheKey, JSON.stringify(matches), { expirationTtl: SEARCH_CACHE_TTL })
  );

  return c.json<SearchResponse>({ query: q, matches, cached: false });
});

export default app;
