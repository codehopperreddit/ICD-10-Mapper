import type { MiddlewareHandler } from "hono";
import type { Env, Variables } from "../types";

/** Async-fire-and-forget usage log so we don't add request latency. */
export const logUsage = (endpoint: string): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    await next();
    const auth = c.get("auth");
    if (!auth) return;
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        `INSERT INTO usage_logs (user_id, api_key_id, endpoint, status)
         VALUES (?1, ?2, ?3, ?4)`
      )
        .bind(auth.userId, auth.apiKeyId, endpoint, c.res.status)
        .run()
        .catch(() => {})
    );
  };
};
