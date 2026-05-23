import { Hono } from "hono";
import { ingestLatest, findLatestCsv, DEFAULT_INGEST_PREFIX } from "../lib/ingest";
import type { Env, Variables } from "../types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const expected = c.env.ADMIN_TOKEN;
  if (!expected) {
    return c.json(
      { error: "not_configured", message: "ADMIN_TOKEN secret is not set" },
      503
    );
  }
  const header = c.req.header("Authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!safeEqual(provided, expected)) {
    return c.json({ error: "unauthorized", message: "Invalid admin token" }, 401);
  }
  return next();
});

// POST /api/admin/ingest?force=1 — kicks off an ingest synchronously.
// The cron path is identical; this is the manual escape hatch.
app.post("/ingest", async (c) => {
  const force = c.req.query("force") === "1" || c.req.query("force") === "true";
  try {
    const result = await ingestLatest(c.env, { trigger: "manual", force });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "ingest_failed", message }, 500);
  }
});

// GET /api/admin/ingest/latest — what the worker WOULD ingest next.
app.get("/ingest/latest", async (c) => {
  const prefix = c.env.INGEST_R2_PREFIX ?? DEFAULT_INGEST_PREFIX;
  const head = await findLatestCsv(c.env, prefix);
  if (!head) {
    return c.json({ prefix, found: false }, 404);
  }
  return c.json({
    prefix,
    found: true,
    key: head.key,
    etag: head.etag,
    size: head.size,
    uploaded: head.uploaded.toISOString(),
  });
});

// GET /api/admin/imports?limit=20 — recent run history.
app.get("/imports", async (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20")));
  const { results } = await c.env.DB.prepare(
    `SELECT id, r2_key, etag, size_bytes, row_count, inserted, updated,
            status, trigger, error, started_at, completed_at
     FROM icd_imports
     ORDER BY id DESC
     LIMIT ?1`
  )
    .bind(limit)
    .all();
  return c.json({ imports: results ?? [] });
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default app;
