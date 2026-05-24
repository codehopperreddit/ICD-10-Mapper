import { getEnv } from "@/lib/server/env";
import { verifyDownloadToken } from "@/lib/server/r2";
import { apiError } from "@/lib/server/respond";

export const dynamic = "force-dynamic";


// No session auth here — the signed token IS the authorization.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const env = getEnv();
  const { jobId } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const verified = await verifyDownloadToken(env, token);
  if (!verified || verified.jobId !== jobId) {
    return apiError("forbidden", "Invalid or expired token", 403);
  }

  const job = await env.DB.prepare(
    "SELECT r2_output_key FROM bulk_jobs WHERE id = ?1 AND user_id = ?2"
  )
    .bind(jobId, verified.userId)
    .first<{ r2_output_key: string | null }>();
  if (!job?.r2_output_key) return apiError("not_found", "Output not ready", 404);

  const obj = await env.STORAGE.get(job.r2_output_key);
  if (!obj) return apiError("not_found", "Output expired", 404);

  return new Response(obj.body as unknown as ReadableStream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="icd-mapper-${jobId}.csv"`,
    },
  });
}
