import { TIERS } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { getSessionAuth } from "@/lib/server/auth";
import { CheckoutButtons } from "@/components/CheckoutButtons";

export const runtime = "edge";

export default async function BillingPage() {
  const env = getEnv();
  const auth = await getSessionAuth(env);
  if (!auth) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <div className="card">
        <p className="text-sm text-slate-500">Current plan</p>
        <p className="mt-1 text-xl font-semibold">{TIERS[auth.tier].label}</p>
        <p className="text-sm text-slate-500">{TIERS[auth.tier].price}</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Upgrade</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick the payment method that matches your country.
        </p>
        <CheckoutButtons userId={auth.userId} email={auth.email} />
      </div>
    </div>
  );
}
