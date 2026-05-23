import type { Tier } from "@icd-mapper/shared";

export interface Env {
  // Bindings
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;

  // Vars
  ENVIRONMENT: string;
  WEB_ORIGIN: string;
  /** R2 prefix the scheduled ingest scans for the latest mappings CSV. */
  INGEST_R2_PREFIX?: string;

  // Secrets
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY?: string;
  PADDLE_API_KEY: string;
  PADDLE_WEBHOOK_SECRET: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  /** Bearer token that gates POST /api/admin/* routes. */
  ADMIN_TOKEN?: string;
}

export interface AuthContext {
  userId: string;        // internal user id
  clerkId: string;       // clerk subject
  email: string;
  tier: Tier;
  apiKeyId: string | null;
}

export type Variables = {
  auth: AuthContext;
};
