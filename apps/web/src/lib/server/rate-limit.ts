import { TIERS } from "@icd-mapper/shared";
import type { AuthContext } from "./auth";
import type { Env } from "./env";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * KV-backed daily rate limiter. Key: `rl:<userId>:<YYYY-MM-DD>`.
 * Increments on success; returns ok=false once the tier's daily limit is hit.
 */
export async function checkRateLimit(env: Env, auth: AuthContext): Promise<RateLimitResult> {
  const limit = TIERS[auth.tier].dailyLimit;
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${auth.userId}:${day}`;
  const current = Number((await env.CACHE.get(key)) ?? 0);
  const reset = endOfDayUtcSeconds();

  if (current >= limit) {
    return { ok: false, limit, remaining: 0, reset };
  }

  const next = current + 1;
  await env.CACHE.put(key, String(next), { expirationTtl: 60 * 60 * 26 });
  return { ok: true, limit, remaining: Math.max(0, limit - next), reset };
}

function endOfDayUtcSeconds(): number {
  const now = new Date();
  const eod = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.floor(eod / 1000);
}
