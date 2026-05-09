import type { MiddlewareHandler } from "hono";
import { findApiKeyByPlaintext, touchApiKey } from "../lib/keys";
import { findUserByClerkId, upsertUserFromClerk } from "../lib/users";
import type { Env, Variables } from "../types";

/**
 * Auth resolution order:
 *   1. `Authorization: Bearer icdm_...`  → API key lookup in D1
 *   2. `Authorization: Bearer <jwt>`     → Clerk session token (verified via JWKS)
 *
 * On success, sets `c.var.auth` for downstream handlers.
 */
export const requireAuth = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      return c.json({ error: "unauthorized", message: "Missing bearer token" }, 401);
    }
    const token = header.slice(7).trim();
    if (!token) {
      return c.json({ error: "unauthorized", message: "Empty bearer token" }, 401);
    }

    if (token.startsWith("icdm_")) {
      const key = await findApiKeyByPlaintext(c.env.DB, token);
      if (!key) {
        return c.json({ error: "unauthorized", message: "Invalid API key" }, 401);
      }
      const user = await c.env.DB.prepare(
        "SELECT id, clerk_id, email, tier FROM users WHERE id = ?1"
      )
        .bind(key.user_id)
        .first<{ id: string; clerk_id: string; email: string; tier: string }>();
      if (!user) {
        return c.json({ error: "unauthorized", message: "Owner not found" }, 401);
      }
      // Don't await — record in background.
      c.executionCtx.waitUntil(touchApiKey(c.env.DB, key.id));
      c.set("auth", {
        userId: user.id,
        clerkId: user.clerk_id,
        email: user.email,
        tier: (user.tier as "free" | "pro" | "api") ?? "free",
        apiKeyId: key.id,
      });
      return next();
    }

    // Otherwise treat as a Clerk JWT.
    const claims = await verifyClerkJwt(token, c.env);
    if (!claims) {
      return c.json({ error: "unauthorized", message: "Invalid session token" }, 401);
    }

    const user =
      (await findUserByClerkId(c.env.DB, claims.sub)) ??
      (await upsertUserFromClerk(c.env.DB, claims.sub, claims.email ?? `${claims.sub}@unknown`));

    c.set("auth", {
      userId: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      tier: user.tier,
      apiKeyId: null,
    });
    return next();
  };
};

// ---------- Clerk JWT verification ------------------------------------------

interface ClerkClaims {
  sub: string;
  email?: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

interface CachedJwks {
  keys: JsonWebKey[];
  fetchedAt: number;
}

const JWKS_TTL_MS = 60 * 60 * 1000;
let cachedJwks: CachedJwks | null = null;

async function verifyClerkJwt(token: string, env: Env): Promise<ClerkClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header: { kid?: string; alg?: string };
  let payload: ClerkClaims & { azp?: string };
  try {
    header = JSON.parse(b64urlDecode(parts[0]!));
    payload = JSON.parse(b64urlDecode(parts[1]!));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;

  const jwk = await loadJwk(env, header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64urlToBytes(parts[2]!);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signedData);
  if (!ok) return null;

  return payload;
}

async function loadJwk(env: Env, kid: string): Promise<JsonWebKey | null> {
  const now = Date.now();
  if (cachedJwks && now - cachedJwks.fetchedAt < JWKS_TTL_MS) {
    const hit = (cachedJwks.keys as Array<JsonWebKey & { kid: string }>).find(
      (k) => k.kid === kid
    );
    if (hit) return hit;
  }
  const issuer = clerkIssuerFromSecret(env.CLERK_SECRET_KEY);
  if (!issuer) return null;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) return null;
  const body = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };
  cachedJwks = { keys: body.keys, fetchedAt: now };
  return body.keys.find((k) => k.kid === kid) ?? null;
}

/**
 * Clerk secret keys look like `sk_test_<base64>` or `sk_live_<base64>`. The
 * base64 portion encodes the issuer hostname (e.g. "actual-rabbit-12.clerk.accounts.dev").
 */
function clerkIssuerFromSecret(secret: string | undefined): string | null {
  if (!secret) return null;
  const parts = secret.split("_");
  if (parts.length < 3) return null;
  try {
    const hostname = atob(parts[2]!);
    return `https://${hostname.replace(/\$+$/, "")}`;
  } catch {
    return null;
  }
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

function b64urlToBytes(s: string): Uint8Array {
  const decoded = b64urlDecode(s);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}
