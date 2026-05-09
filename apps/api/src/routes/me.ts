import { Hono } from "hono";
import { TIERS } from "@icd-mapper/shared";
import type { UsageStats } from "@icd-mapper/shared";
import { requireAuth } from "../middleware/auth";
import type { Env, Variables } from "../types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requireAuth());

app.get("/", (c) => {
  const auth = c.get("auth");
  return c.json({
    user: {
      id: auth.userId,
      email: auth.email,
      tier: auth.tier,
    },
    tierConfig: TIERS[auth.tier],
  });
});

app.get("/usage", async (c) => {
  const auth = c.get("auth");
  const limit = TIERS[auth.tier].dailyLimit;
  const today = new Date().toISOString().slice(0, 10);

  const usedTodayRow = await c.env.CACHE.get(`rl:${auth.userId}:${today}`);
  const usedToday = Number(usedTodayRow ?? 0);

  // Last 30 days from usage_logs.
  const { results } = await c.env.DB.prepare(
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
  return c.json(stats);
});

export default app;
