import { Hono } from "hono";
import { nanoid } from "nanoid";
import { TIERS } from "@icd-mapper/shared";
import type { BulkJob, BulkJobResponse, CreateBulkJobResponse } from "@icd-mapper/shared";
import { parseCsv, toCsv } from "../lib/csv";
import { searchIcd } from "../lib/search";
import { inputKey, outputKey, signDownloadToken, verifyDownloadToken } from "../lib/r2";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { logUsage } from "../middleware/usage-log";
import type { Env, Variables } from "../types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const DIAGNOSIS_COLUMN = "diagnosis_text";

// ---------- POST /api/bulk-map ---------------------------------------------
// Accepts multipart/form-data with a single "file" field (CSV).

app.post("/", requireAuth(), rateLimit(), logUsage("/api/bulk-map"), async (c) => {
  const auth = c.get("auth");
  const tierConfig = TIERS[auth.tier];

  const form = await c.req.formData().catch(() => null);
  if (!form) {
    return c.json({ error: "bad_request", message: "Expected multipart/form-data" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "bad_request", message: "Missing 'file' field" }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: "bad_request", message: "Empty file" }, 400);
  }
  if (file.size > 25 * 1024 * 1024) {
    return c.json({ error: "bad_request", message: "File exceeds 25 MB limit" }, 413);
  }

  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  if (!headers.includes(DIAGNOSIS_COLUMN)) {
    return c.json(
      {
        error: "bad_request",
        message: `CSV must contain a '${DIAGNOSIS_COLUMN}' column. Got: ${headers.join(", ")}`,
      },
      400
    );
  }
  if (rows.length === 0) {
    return c.json({ error: "bad_request", message: "CSV has no data rows" }, 400);
  }
  if (rows.length > tierConfig.maxBulkRows) {
    return c.json(
      {
        error: "tier_limit",
        message: `Tier '${auth.tier}' allows max ${tierConfig.maxBulkRows} rows per upload.`,
      },
      403
    );
  }

  const jobId = nanoid(16);
  const inKey = inputKey(auth.userId, jobId);

  await c.env.STORAGE.put(inKey, text, {
    httpMetadata: { contentType: "text/csv" },
    customMetadata: { userId: auth.userId, originalName: file.name },
  });

  await c.env.DB.prepare(
    `INSERT INTO bulk_jobs (id, user_id, r2_input_key, status, row_count)
     VALUES (?1, ?2, ?3, 'queued', ?4)`
  )
    .bind(jobId, auth.userId, inKey, rows.length)
    .run();

  // Process inline via waitUntil. For very large jobs we'd ideally use a Queue
  // consumer, but D1 + waitUntil handles tens of thousands of rows fine.
  c.executionCtx.waitUntil(processBulkJob(c.env, auth.userId, jobId));

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
  return c.json<CreateBulkJobResponse>(
    {
      job,
      uploadInstructions: `Poll GET /api/bulk-map/${jobId} for status.`,
    },
    202
  );
});

// ---------- GET /api/bulk-map/:jobId ----------------------------------------

app.get("/:jobId", requireAuth(), logUsage("/api/bulk-map/:id"), async (c) => {
  const auth = c.get("auth");
  const jobId = c.req.param("jobId");

  const job = await c.env.DB.prepare(
    `SELECT id, user_id, r2_input_key, r2_output_key, status, row_count, error, created_at, completed_at
     FROM bulk_jobs WHERE id = ?1 AND user_id = ?2`
  )
    .bind(jobId, auth.userId)
    .first<BulkJob>();

  if (!job) {
    return c.json({ error: "not_found", message: "Job not found" }, 404);
  }

  let downloadUrl: string | null = null;
  if (job.status === "completed" && job.r2_output_key) {
    const { token } = await signDownloadToken(c.env, auth.userId, job.id);
    downloadUrl = `${new URL(c.req.url).origin}/api/bulk-map/${job.id}/download?token=${token}`;
  }

  return c.json<BulkJobResponse>({ job, downloadUrl });
});

// ---------- GET /api/bulk-map/:jobId/download ?token=... --------------------
// No auth middleware here — the signed token is the auth.

app.get("/:jobId/download", async (c) => {
  const jobId = c.req.param("jobId");
  const token = c.req.query("token") ?? "";
  const verified = await verifyDownloadToken(c.env, token);
  if (!verified || verified.jobId !== jobId) {
    return c.json({ error: "forbidden", message: "Invalid or expired token" }, 403);
  }
  const job = await c.env.DB.prepare(
    "SELECT r2_output_key FROM bulk_jobs WHERE id = ?1 AND user_id = ?2"
  )
    .bind(jobId, verified.userId)
    .first<{ r2_output_key: string | null }>();
  if (!job?.r2_output_key) {
    return c.json({ error: "not_found", message: "Output not ready" }, 404);
  }
  const obj = await c.env.STORAGE.get(job.r2_output_key);
  if (!obj) {
    return c.json({ error: "not_found", message: "Output expired" }, 404);
  }
  return new Response(obj.body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="icd-mapper-${jobId}.csv"`,
    },
  });
});

// ---------- worker -----------------------------------------------------------

export async function processBulkJob(env: Env, userId: string, jobId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE bulk_jobs SET status = 'processing' WHERE id = ?1"
  )
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
    await env.STORAGE.put(outKey, outCsv, {
      httpMetadata: { contentType: "text/csv" },
    });

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

export default app;
