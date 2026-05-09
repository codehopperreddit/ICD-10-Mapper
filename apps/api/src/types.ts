import type { Tier } from "@icd-mapper/shared";

export interface Env {
  // Bindings
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;

  // Vars
  ENVIRONMENT: string;
  WEB_ORIGIN: string;

  // Secrets
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY?: string;
  PADDLE_API_KEY: string;
  PADDLE_WEBHOOK_SECRET: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
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
