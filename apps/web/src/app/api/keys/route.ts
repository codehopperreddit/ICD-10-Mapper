import { nanoid } from "nanoid";
import { TIERS } from "@icd-mapper/shared";
import type { ApiKey, CreateApiKeyResponse } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import type { Env } from "@/lib/server/env";
import { resolveAuth } from "@/lib/server/auth";
import type { AuthContext } from "@/lib/server/auth";
import { generateApiKey, hashApiKey } from "@/lib/server/keys";
import { json, apiError } from "@/lib/server/respond";

export const dynamic = "force-dynamic";


/** Key management always requires a session (never an API key) + a paid tier. */
async function gate(req: Request): Promise<Response | { env: Env; auth: AuthContext }> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);
  if (auth.apiKeyId !== null) {
    return apiError("forbidden", "Use a session to manage keys.", 403);
  }
  if (!TIERS[auth.tier].allowApiKeys) {
    return apiError("tier_limit", "Upgrade to Pro or API tier to use API keys.", 403);
  }
  return { env, auth };
}

export async function GET(req: Request): Promise<Response> {
  const gated = await gate(req);
  if (gated instanceof Response) return gated;
  const { env, auth } = gated;

  const { results } = await env.DB.prepare(
    `SELECT id, name, prefix, created_at, last_used_at
     FROM api_keys
     WHERE user_id = ?1 AND revoked_at IS NULL
     ORDER BY created_at DESC`
  )
    .bind(auth.userId)
    .all<ApiKey>();
  return json({ keys: results ?? [] });
}

export async function POST(req: Request): Promise<Response> {
  const gated = await gate(req);
  if (gated instanceof Response) return gated;
  const { env, auth } = gated;

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "Untitled key").slice(0, 80).trim() || "Untitled key";

  const { plaintext, prefix } = generateApiKey();
  const hash = await hashApiKey(plaintext);
  const id = nanoid(16);

  await env.DB.prepare(
    `INSERT INTO api_keys (id, user_id, key_hash, prefix, name)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(id, auth.userId, hash, prefix, name)
    .run();

  const key: ApiKey = {
    id,
    name,
    prefix,
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  return json({ key, secret: plaintext } satisfies CreateApiKeyResponse, 201);
}
