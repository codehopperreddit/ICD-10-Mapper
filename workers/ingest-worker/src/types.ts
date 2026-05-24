import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

/** Bindings for the standalone ICD-10 mappings ingest worker. */
export interface Env {
  // The SAME D1 database + R2 bucket the client app uses.
  DB: D1Database;
  STORAGE: R2Bucket;

  // R2 prefix scanned for the newest *.csv mappings file.
  INGEST_R2_PREFIX?: string;
  // Bearer token gating POST /ingest. Set via `wrangler secret put ADMIN_TOKEN`.
  ADMIN_TOKEN?: string;
}
