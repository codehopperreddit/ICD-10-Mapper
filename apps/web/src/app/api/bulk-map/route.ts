import { nanoid } from "nanoid";
import { TIERS } from "@icd-mapper/shared";
import type { BulkJob, CreateBulkJobResponse } from "@icd-mapper/shared";
import { getEnv, getExecutionCtx } from "@/lib/server/env";
import type { Env } from "@/lib/server/env";
import { resolveAuth } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { logUsage } from "@/lib/server/usage-log";
import { parseCsv, toCsv } from "@/lib/server/csv";
import { searchIcd } from "@/lib/server/search";
import { inputKey, outputKey } from "@/lib/server/r2";
import { json, apiError } from "@/lib/server/respond";

export const runtime = "edge";

const DIAGNOSIS_COLUMN = "diagnosis_text";

export async function POST(req: Request): Promise<Response> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);

  const tierConfig = TIERS[auth.tier];
  const rl = await checkRateLimit(env, auth);
  if (!rl.ok) {
    logUsage(env, auth, "/api/bulk-map", 429);
    return apiError("rate_limited", `Daily quota of ${rl.limit} exceeded.`, 429);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("bad_request", "Expected multipart/form-data", 400);
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("bad_request", "Missing 'file' field", 400);
  if (file.size === 0) return apiError("bad_request", "Empty file", 400);
  if (file.size > 25 * 1024 * 1024) return apiError("bad_request", "File exceeds 25 MB limit", 413);

  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  if (!headers.includes(DIAGNOSIS_COLUMN)) {
    return apiError(
      "bad_request",
      `CSV must contain a '${DIAGNOSIS_COLUMN}' column. Got: ${headers.join(", ")}`,
      400
    );
  }
  if (rows.length === 0) return apiError("bad_request", "CSV has no data rows", 400);
  if (rows.length > tierConfig.maxBulkRows) {
    return apiError(
      "tier_limit",
      `Tier '${auth.tier}' allows max ${tierConfig.maxBulkRows} rows per upload.`,
      403
    );
  }

  const jobId = nanoid(16);
  const inKey = inputKey(auth.userId, jobId);

  await env.STORAGE.put(inKey, text, {
    httpMetadata: { contentType: "text/csv" },
    customMetadata: { userId: auth.userId, originalName: file.name },
  });

  await env.DB.prepare(
    `INSERT INTO bulk_jobs (id, user_id, r2_input_key, status, row_count)
     VALUES (?1, ?2, ?3, 'queued', ?4)`
  )
    .bind(jobId, auth.userId, inKey, rows.length)
    .run();

  getExecutionCtx().waitUntil(processBulkJob(env, auth.userId, jobId));
  logUsage(env, auth, "/api/bulk-map", 202);

  const job: BulkJob = {
    id: jobId,
    user_id: auth.userId,
    r2_input_key: inKey,
    r2_output_key: null,
    status: "queued",
    row_count: rows.length,
    error: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  return json(
    { job, uploadInstructions: `Poll GET /api/bulk-map/${jobId} for status.` } satisfies CreateBulkJobResponse,
    202
  );
}

async function processBulkJob(env: Env, userId: string, jobId: string): Promise<void> {
  await env.DB.prepare("UPDATE bulk_jobs SET status = 'processing' WHERE id = ?1")
    .bind(jobId)
    .run();

  try {
    const inKey = inputKey(userId, jobId);
    const obj = await env.STORAGE.get(inKey);
    if (!obj) throw new Error(`Input not found: ${inKey}`);
    const text = await obj.text();
    const { rows } = parseCsv(text);

    const outRows: Array<Record<string, string>> = [];
    for (const row of rows) {
      const input = (row[DIAGNOSIS_COLUMN] ?? "").trim();
      if (!input) {
        outRows.push({ ...row, icd10_code: "", icd10_description: "", confidence: "" });
        continue;
      }
      const matches = await searchIcd(env.DB, input, 1);
      const top = matches[0];
      outRows.push({
        ...row,
        icd10_code: top?.code ?? "",
        icd10_description: top?.description ?? "",
        confidence: top ? top.confidence.toFixed(4) : "",
      });
    }

    const outHeaders = unique([
      ...Object.keys(rows[0] ?? {}),
      "icd10_code",
      "icd10_description",
      "confidence",
    ]);
    const outCsv = toCsv(outHeaders, outRows);
    const outKey = outputKey(userId, jobId);
    await env.STORAGE.put(outKey, outCsv, { httpMetadata: { contentType: "text/csv" } });

    await env.DB.prepare(
      `UPDATE bulk_jobs
       SET status = 'completed', r2_output_key = ?1, completed_at = datetime('now')
       WHERE id = ?2`
    )
      .bind(outKey, jobId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `UPDATE bulk_jobs
       SET status = 'failed', error = ?1, completed_at = datetime('now')
       WHERE id = ?2`
    )
      .bind(message, jobId)
      .run();
  }
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
