import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SearchResponse } from "@icd-mapper/shared";
import { searchIcd } from "../lib/search";
import type { Env, Variables } from "../types";

const PUBLIC_DAILY_LIMIT = 20;
const SEARCH_CACHE_TTL = 60 * 60;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: false,
    maxAge: 86400,
  })
);

app.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const limit = Math.min(10, Math.max(1, Number(c.req.query("limit") ?? "5")));
  if (!q) {
    return c.json({ error: "bad_request", message: "Query 'q' is required." }, 400);
  }
  if (q.length > 200) {
    return c.json({ error: "bad_request", message: "Query too long (max 200 chars)." }, 400);
  }

  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `public_rl:${ip}:${day}`;
  const current = Number((await c.env.CACHE.get(rlKey)) ?? 0);

  if (current >= PUBLIC_DAILY_LIMIT) {
    c.header("X-RateLimit-Limit", String(PUBLIC_DAILY_LIMIT));
    c.header("X-RateLimit-Remaining", "0");
    return c.json(
      {
        error: "rate_limited",
        message: `Public demo limit of ${PUBLIC_DAILY_LIMIT} lookups per day reached. Sign up for higher limits.`,
      },
      429
    );
  }

  const cacheKey = `search:${limit}:${q.toLowerCase()}`;
  const cached = await c.env.CACHE.get(cacheKey, "json");

  c.executionCtx.waitUntil(
    c.env.CACHE.put(rlKey, String(current + 1), {
      expirationTtl: 60 * 60 * 26,
    })
  );

  c.header("X-RateLimit-Limit", String(PUBLIC_DAILY_LIMIT));
  c.header("X-RateLimit-Remaining", String(Math.max(0, PUBLIC_DAILY_LIMIT - current - 1)));

  if (cached) {
    return c.json<SearchResponse>({
      query: q,
      matches: cached as SearchResponse["matches"],
      cached: true,
    });
  }

  const matches = await searchIcd(c.env.DB, q, limit);
  c.executionCtx.waitUntil(
    c.env.CACHE.put(cacheKey, JSON.stringify(matches), {
      expirationTtl: SEARCH_CACHE_TTL,
    })
  );

  return c.json<SearchResponse>({ query: q, matches, cached: false });
});

export default app;
