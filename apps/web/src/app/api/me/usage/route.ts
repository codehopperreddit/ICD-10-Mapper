import { TIERS } from "@icd-mapper/shared";
import type { UsageStats } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { resolveAuth } from "@/lib/server/auth";
import { json, apiError } from "@/lib/server/respond";


export async function GET(req: Request): Promise<Response> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);

  const limit = TIERS[auth.tier].dailyLimit;
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = Number((await env.CACHE.get(`rl:${auth.userId}:${today}`)) ?? 0);

  const { results } = await env.DB.prepare(
    `SELECT date(timestamp) AS date, COUNT(*) AS count
     FROM usage_logs
     WHERE user_id = ?1 AND timestamp >= datetime('now', '-30 days')
     GROUP BY date(timestamp)
     ORDER BY date(timestamp) ASC`
  )
    .bind(auth.userId)
    .all<{ date: string; count: number }>();

  const stats: UsageStats = {
    tier: auth.tier,
    dailyLimit: limit,
    usedToday,
    byDay: results ?? [],
  };
  return json(stats);
}
