import type { ScheduledController, ExecutionContext } from "@cloudflare/workers-types";
import { ingestLatest, findLatestCsv, DEFAULT_INGEST_PREFIX } from "./ingest";
import type { Env } from "./types";

/**
 * Standalone worker that loads the latest CMS ICD-10-CM mappings CSV from R2
 * into the shared D1 tables. Runs on a cron schedule (see wrangler.toml) and
 * can be triggered manually via an admin-token-gated HTTP endpoint.
 *
 * Routes:
 *   GET  /            → liveness + the file that would be ingested next
 *   GET  /imports     → recent run history            (admin token)
 *   POST /ingest      → run the R2 → D1 load now       (admin token; ?force=1)
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const prefix = env.INGEST_R2_PREFIX ?? DEFAULT_INGEST_PREFIX;
      const head = await findLatestCsv(env, prefix);
      return json({
        ok: true,
        service: "icd-mapper-ingest",
        prefix,
        latest: head
          ? { key: head.key, etag: head.etag, size: head.size, uploaded: head.uploaded.toISOString() }
          : null,
      });
    }

    if (!isAdmin(req, env)) {
      return json({ error: "unauthorized", message: "Invalid or missing admin token" }, 401);
    }

    if (req.method === "GET" && url.pathname === "/imports") {
      const { results } = await env.DB.prepare(
        `SELECT id, r2_key, etag, size_bytes, row_count, inserted, updated,
                status, trigger, error, started_at, completed_at
         FROM icd_imports ORDER BY id DESC LIMIT 20`
      ).all();
      return json({ imports: results ?? [] });
    }

    if (req.method === "POST" && url.pathname === "/ingest") {
      const force = url.searchParams.get("force");
      try {
        const result = await ingestLatest(env, {
          trigger: "manual",
          force: force === "1" || force === "true",
        });
        return json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: "ingest_failed", message }, 500);
      }
    }

    return json({ error: "not_found", message: "Route not found" }, 404);
  },

  // Cron trigger (wrangler.toml [triggers]). Etag-skips when unchanged.
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(
      ingestLatest(env, { trigger: "cron" })
        .then((r) =>
          console.log(
            `[ingest:cron] ${r.status} key=${r.r2Key} parsed=${r.rowsParsed} written=${r.rowsWritten} took=${r.durationMs}ms`
          )
        )
        .catch((err) =>
          console.error(`[ingest:cron] failed: ${err instanceof Error ? err.message : err}`)
        )
    );
  },
};

function isAdmin(req: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return provided.length > 0 && safeEqual(provided, env.ADMIN_TOKEN);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
