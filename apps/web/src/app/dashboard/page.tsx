import { auth } from "@clerk/nextjs/server";
import { TIERS } from "@icd-mapper/shared";
import type { UsageStats } from "@icd-mapper/shared";
import { api } from "@/lib/api";
import { UsageChart } from "@/components/UsageChart";

export const runtime = "edge";

export default async function DashboardPage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) return null;

  const me = (await api.me(token)) as {
    user: { id: string; email: string; tier: keyof typeof TIERS };
  };
  const usage = (await api.usage(token)) as UsageStats;
  const tierConfig = TIERS[me.user.tier];

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
