import { auth } from "@clerk/nextjs/server";
import { TIERS } from "@icd-mapper/shared";
import { api } from "@/lib/api";
import { CheckoutButtons } from "@/components/CheckoutButtons";

export const runtime = "edge";

export default async function BillingPage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) return null;

  const me = (await api.me(token)) as {
    user: { id: string; email: string; tier: keyof typeof TIERS };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <div className="card">
        <p className="text-sm text-slate-500">Current plan</p>
        <p className="mt-1 text-xl font-semibold">{TIERS[me.user.tier].label}</p>
        <p className="text-sm text-slate-500">{TIERS[me.user.tier].price}</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Upgrade</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick the payment method that matches your country.
        </p>
        <CheckoutButtons userId={me.user.id} email={me.user.email} />
      </div>
    </div>
  );
}
