import { getEnv } from "@/lib/server/env";
import { resolveAuth } from "@/lib/server/auth";
import { json, apiError } from "@/lib/server/respond";

export const dynamic = "force-dynamic";


export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const env = getEnv();
  const { id } = await params;
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);
  if (auth.apiKeyId !== null) {
    return apiError("forbidden", "Use a session to manage keys.", 403);
  }

  const result = await env.DB.prepare(
    `UPDATE api_keys SET revoked_at = datetime('now')
     WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL`
  )
    .bind(id, auth.userId)
    .run();
  if (result.meta.changes === 0) {
    return apiError("not_found", "Key not found", 404);
  }
  return json({ ok: true });
}
