import { getEnv } from "@/lib/server/env";
import type { Env } from "@/lib/server/env";
import { resolveAuth, isAdminEmail } from "@/lib/server/auth";
import type { AuthContext } from "@/lib/server/auth";
import { ingestLatest, findLatestCsv, DEFAULT_INGEST_PREFIX } from "@/lib/server/ingest";
import { json, apiError } from "@/lib/server/respond";


/** Only an admin Clerk session may touch ingestion. API keys are rejected. */
async function requireAdmin(req: Request): Promise<Response | { env: Env; auth: AuthContext }> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);
  if (auth.apiKeyId !== null) {
    return apiError("forbidden", "Use an admin session, not an API key.", 403);
  }
  if (!isAdminEmail(env, auth.email)) {
    return apiError("forbidden", "Admin access required.", 403);
  }
  return { env, auth };
}

// GET /api/admin/ingest — what would be ingested next + recent run history.
export async function GET(req: Request): Promise<Response> {
  const gated = await requireAdmin(req);
  if (gated instanceof Response) return gated;
  const { env } = gated;

  const prefix = env.INGEST_R2_PREFIX ?? DEFAULT_INGEST_PREFIX;
  const head = await findLatestCsv(env, prefix);
  const { results } = await env.DB.prepare(
    `SELECT id, r2_key, etag, size_bytes, row_count, inserted, updated,
            status, trigger, error, started_at, completed_at
     FROM icd_imports
     ORDER BY id DESC
     LIMIT 20`
  ).all();

  return json({
    latest: head
      ? { key: head.key, etag: head.etag, size: head.size, uploaded: head.uploaded.toISOString() }
      : null,
    prefix,
    imports: results ?? [],
  });
}

// POST /api/admin/ingest?force=1 — run the R2 → D1 load now.
export async function POST(req: Request): Promise<Response> {
  const gated = await requireAdmin(req);
  if (gated instanceof Response) return gated;
  const { env } = gated;

  const force = new URL(req.url).searchParams.get("force");
  try {
    const result = await ingestLatest(env, {
      trigger: "manual",
      force: force === "1" || force === "true",
    });
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("ingest_failed", message, 500);
  }
}
