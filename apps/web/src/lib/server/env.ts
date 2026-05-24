import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
  ExecutionContext,
} from "@cloudflare/workers-types";

/**
 * Cloudflare bindings + secrets available to the Worker (Next.js route handlers
 * and server components, via OpenNext). Bindings are declared in the root
 * wrangler.jsonc; secrets are set via the Cloudflare dashboard or
 * `wrangler secret put`.
 */
export interface Env {
  // Bindings
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;

  // Vars
  /** Comma-separated list of emails allowed to hit admin-only routes. */
  ADMIN_EMAILS?: string;

  // Secrets
  CLERK_SECRET_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  RAZORPAY_KEY_SECRET?: string;
}

/** Access Cloudflare bindings from within a route handler / server component. */
export function getEnv(): Env {
  return getCloudflareContext().env as unknown as Env;
}

/** Cloudflare ExecutionContext — use `ctx.waitUntil(...)` for background work. */
export function getExecutionCtx(): ExecutionContext {
  return getCloudflareContext().ctx as unknown as ExecutionContext;
}

