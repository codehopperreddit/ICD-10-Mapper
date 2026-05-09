import type { MiddlewareHandler } from "hono";
import { TIERS } from "@icd-mapper/shared";
import type { Env, Variables } from "../types";

/**
 * KV-backed daily rate limiter.
 *
 * Key shape: `rl:<userId>:<YYYY-MM-DD>` → counter as string.
 * KV's expirationTtl auto-purges yesterday's keys, so we don't need a sweeper.
 */
export const rateLimit = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "unauthorized", message: "Auth required" }, 401);
    }

    const limit = TIERS[auth.tier].dailyLimit;
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const kvKey = `rl:${auth.userId}:${day}`;

    const current = Number((await c.env.CACHE.get(kvKey)) ?? 0);
    if (current >= limit) {
      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", endOfDayUtcSeconds().toString());
      return c.json(
        {
          error: "rate_limited",
          message: `Daily quota of ${limit} requests exceeded for tier '${auth.tier}'.`,
        },
        429
      );
    }

    const next_ = current + 1;
    // Best-effort write — we don't await KV inside the request critical path
    // beyond what's needed; KV is eventually consistent so a small overage is acceptable.
    c.executionCtx.waitUntil(
      c.env.CACHE.put(kvKey, String(next_), {
        expirationTtl: 60 * 60 * 26, // ~26 hours; covers timezone slop.
      })
    );

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - next_)));
    c.header("X-RateLimit-Reset", endOfDayUtcSeconds().toString());
    return next();
  };
};

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
