import type { AuthContext } from "./auth";
import type { Env } from "./env";
import { getExecutionCtx } from "./env";

/** Fire-and-forget usage log so we don't add request latency. */
export function logUsage(
  env: Env,
  auth: AuthContext,
  endpoint: string,
  status: number
): void {
  const write = env.DB.prepare(
    `INSERT INTO usage_logs (user_id, api_key_id, endpoint, status)
     VALUES (?1, ?2, ?3, ?4)`
  )
    .bind(auth.userId, auth.apiKeyId, endpoint, status)
    .run()
    .then(() => undefined)
    .catch(() => undefined);
  try {
    getExecutionCtx().waitUntil(write);
  } catch {
    void write;
  }
}
