import type { D1Database } from "@cloudflare/workers-types";
import { nanoid } from "nanoid";

const KEY_PREFIX = "icdm_";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashApiKey(plaintext: string): Promise<string> {
  return sha256(plaintext);
}

export function generateApiKey(): { plaintext: string; prefix: string } {
  const random = nanoid(32);
  const plaintext = `${KEY_PREFIX}${random}`;
  return { plaintext, prefix: plaintext.slice(0, 8) };
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function findApiKeyByPlaintext(
  db: D1Database,
  plaintext: string
): Promise<ApiKeyRow | null> {
  const hash = await hashApiKey(plaintext);
  const row = await db
    .prepare(
      `SELECT * FROM api_keys
       WHERE key_hash = ?1 AND revoked_at IS NULL`
    )
    .bind(hash)
    .first<ApiKeyRow>();
  return row ?? null;
}

export async function touchApiKey(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?1")
    .bind(id)
    .run();
}
