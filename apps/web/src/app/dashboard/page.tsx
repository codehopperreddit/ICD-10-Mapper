import { TIERS } from "@icd-mapper/shared";
import type { UsageStats } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { getSessionAuth } from "@/lib/server/auth";
import { UsageChart } from "@/components/UsageChart";

export const dynamic = "force-dynamic";


export default async function DashboardPage() {
  const env = getEnv();
  const auth = await getSessionAuth(env);
  if (!auth) return null;

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

  const usage: UsageStats = {
    tier: auth.tier,
    dailyLimit: limit,
    usedToday,
    byDay: results ?? [],
  };
  const tierConfig = TIERS[auth.tier];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome back</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Plan" value={tierConfig.label} />
        <Stat label="Today's usage" value={`${usage.usedToday} / ${usage.dailyLimit}`} />
        <Stat
          label="Remaining"
          value={String(Math.max(0, usage.dailyLimit - usage.usedToday))}
        />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Last 30 days</h2>
        <UsageChart data={usage.byDay} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
