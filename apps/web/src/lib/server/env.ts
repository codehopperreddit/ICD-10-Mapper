import { getRequestContext } from "@cloudflare/next-on-pages";
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
  ExecutionContext,
} from "@cloudflare/workers-types";

/**
 * Cloudflare bindings + secrets available to the Pages Functions (route
 * handlers). Bindings are declared in apps/web/wrangler.toml; secrets are set
 * via the Cloudflare Pages dashboard or `wrangler pages secret put`.
 */
export interface Env {
  // Bindings
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;

  // Vars
  INGEST_R2_PREFIX?: string;
  /** Comma-separated list of emails allowed to hit admin-only routes. */
  ADMIN_EMAILS?: string;

  // Secrets
  CLERK_SECRET_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  RAZORPAY_KEY_SECRET?: string;
}

/** Access Cloudflare bindings from within a route handler / server component. */
export function getEnv(): Env {
  return getRequestContext().env as unknown as Env;
}

/** Cloudflare ExecutionContext — use `ctx.waitUntil(...)` for background work. */
export function getExecutionCtx(): ExecutionContext {
  return getRequestContext().ctx as unknown as ExecutionContext;
}
