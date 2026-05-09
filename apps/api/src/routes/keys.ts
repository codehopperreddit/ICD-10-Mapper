import { Hono } from "hono";
import { nanoid } from "nanoid";
import { TIERS } from "@icd-mapper/shared";
import type { ApiKey, CreateApiKeyResponse } from "@icd-mapper/shared";
import { generateApiKey, hashApiKey } from "../lib/keys";
import { requireAuth } from "../middleware/auth";
import type { Env, Variables } from "../types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All key operations require a Clerk session (not an API key). This prevents
// a leaked key from issuing more keys.
app.use("*", requireAuth(), async (c, next) => {
  const auth = c.get("auth");
  if (auth.apiKeyId !== null) {
    return c.json({ error: "forbidden", message: "Use a session to manage keys" }, 403);
  }
  if (!TIERS[auth.tier].allowApiKeys) {
    return c.json(
      { error: "tier_limit", message: "Upgrade to Pro or API tier to use API keys." },
      403
    );
  }
  return next();
});

app.get("/", async (c) => {
  const auth = c.get("auth");
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, prefix, created_at, last_used_at
     FROM api_keys
     WHERE user_id = ?1 AND revoked_at IS NULL
     ORDER BY created_at DESC`
  )
    .bind(auth.userId)
    .all<ApiKey>();
  return c.json({ keys: results ?? [] });
});

app.post("/", async (c) => {
  const auth = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "Untitled key").slice(0, 80).trim() || "Untitled key";

  const { plaintext, prefix } = generateApiKey();
  const hash = await hashApiKey(plaintext);
  const id = nanoid(16);

  await c.env.DB.prepare(
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
  return c.json<CreateApiKeyResponse>({ key, secret: plaintext }, 201);
});

app.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    `UPDATE api_keys SET revoked_at = datetime('now')
     WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL`
  )
    .bind(id, auth.userId)
    .run();
  if (result.meta.changes === 0) {
    return c.json({ error: "not_found", message: "Key not found" }, 404);
  }
  return c.json({ ok: true });
});

export default app;
