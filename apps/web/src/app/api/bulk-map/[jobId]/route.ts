import type { BulkJob, BulkJobResponse } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { resolveAuth } from "@/lib/server/auth";
import { signDownloadToken } from "@/lib/server/r2";
import { json, apiError } from "@/lib/server/respond";

export const runtime = "edge";

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
): Promise<Response> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);

  const job = await env.DB.prepare(
    `SELECT id, user_id, r2_input_key, r2_output_key, status, row_count, error, created_at, completed_at
     FROM bulk_jobs WHERE id = ?1 AND user_id = ?2`
  )
    .bind(params.jobId, auth.userId)
    .first<BulkJob>();

  if (!job) return apiError("not_found", "Job not found", 404);

  let downloadUrl: string | null = null;
  if (job.status === "completed" && job.r2_output_key) {
    const { token } = await signDownloadToken(env, auth.userId, job.id);
    downloadUrl = `${new URL(req.url).origin}/api/bulk-map/${job.id}/download?token=${token}`;
  }

  return json({ job, downloadUrl } satisfies BulkJobResponse);
}
