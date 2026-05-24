import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import type { Tier } from "@icd-mapper/shared";
import type { Env } from "./env";
import { getExecutionCtx } from "./env";
import { findApiKeyByPlaintext, touchApiKey } from "./keys";
import { findUserByClerkId, upsertUserFromClerk } from "./users";

export interface AuthContext {
  userId: string;
  clerkId: string;
  email: string;
  tier: Tier;
  apiKeyId: string | null;
}

/**
 * Resolve the caller from either:
 *   1. `Authorization: Bearer icdm_...` → API key lookup in D1, or
 *   2. the Clerk session cookie (same-origin dashboard requests).
 * Returns null when neither is present/valid.
 */
export async function resolveAuth(req: Request, env: Env): Promise<AuthContext | null> {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer icdm_")) {
    const token = header.slice(7).trim();
    const key = await findApiKeyByPlaintext(env.DB, token);
    if (!key) return null;
    const user = await env.DB.prepare(
      "SELECT id, clerk_id, email, tier FROM users WHERE id = ?1"
    )
      .bind(key.user_id)
      .first<{ id: string; clerk_id: string; email: string; tier: string }>();
    if (!user) return null;
    try {
      getExecutionCtx().waitUntil(touchApiKey(env.DB, key.id));
    } catch {
      /* no execution ctx (e.g. local) — skip */
    }
    return {
      userId: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      tier: (user.tier as Tier) ?? "free",
      apiKeyId: key.id,
    };
  }

  return getSessionAuth(env);
}

/**
 * Resolve the caller from the Clerk session only (no API key). Usable from
 * server components, where there is no Request to read an Authorization header.
 */
export async function getSessionAuth(env: Env): Promise<AuthContext | null> {
  const { userId: clerkId } = await clerkAuth();
  if (!clerkId) return null;

  const existing = await findUserByClerkId(env.DB, clerkId);
  if (existing) {
    return {
      userId: existing.id,
      clerkId: existing.clerk_id,
      email: existing.email,
      tier: existing.tier,
      apiKeyId: null,
    };
  }

  // First time we've seen this Clerk user — fetch their email and create a row.
  const cu = await currentUser();
  const email =
    cu?.emailAddresses?.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ??
    cu?.emailAddresses?.[0]?.emailAddress ??
    `${clerkId}@unknown`;
  const created = await upsertUserFromClerk(env.DB, clerkId, email);
  return {
    userId: created.id,
    clerkId: created.clerk_id,
    email: created.email,
    tier: created.tier,
    apiKeyId: null,
  };
}

/** True when `email` is listed in the ADMIN_EMAILS env var (comma-separated). */
export function isAdminEmail(env: Env, email: string): boolean {
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
