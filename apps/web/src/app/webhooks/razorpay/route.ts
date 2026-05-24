import type { Tier } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import type { Env } from "@/lib/server/env";
import { hmacHex, safeEqual } from "@/lib/server/hmac";
import {
  findUserByEmail,
  findUserByRazorpayCustomerId,
  setRazorpayCustomerId,
  setUserTier,
} from "@/lib/server/users";
import { json, apiError } from "@/lib/server/respond";


interface RazorpayEvent {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        customer_id?: string;
        status: string;
        notes?: { user_id?: string; tier?: Tier; email?: string };
      };
    };
  };
}

const RAZORPAY_PLAN_TIER_MAP: Record<string, Tier> = {};

export async function POST(req: Request): Promise<Response> {
  const env = getEnv();
  const sig = req.headers.get("X-Razorpay-Signature");
  const raw = await req.text();
  if (!sig || !raw) return apiError("bad_request", "Missing signature or body", 400);

  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET ?? "", raw);
  if (!safeEqual(expected, sig)) return apiError("invalid_signature", "Bad signature", 401);

  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return apiError("bad_request", "Invalid JSON", 400);
  }

  await handleRazorpayEvent(env, event);
  return json({ ok: true });
}

async function handleRazorpayEvent(env: Env, event: RazorpayEvent): Promise<void> {
  const sub = event.payload.subscription?.entity;
  if (!sub) return;
  const explicit = sub.notes ?? {};
  const tier = explicit.tier ?? RAZORPAY_PLAN_TIER_MAP[sub.plan_id] ?? "pro";

  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
    case "subscription.updated": {
      const user = await locateRazorpayUser(env, sub.customer_id, explicit.user_id, explicit.email);
      if (!user) return;
      if (sub.customer_id && !user.razorpay_customer_id) {
        await setRazorpayCustomerId(env.DB, user.id, sub.customer_id);
      }
      await setUserTier(env.DB, user.id, tier);
      return;
    }
    case "subscription.cancelled":
    case "subscription.halted":
    case "subscription.completed": {
      const user = await locateRazorpayUser(env, sub.customer_id, explicit.user_id, explicit.email);
      if (user) await setUserTier(env.DB, user.id, "free");
      return;
    }
    default:
      return;
  }
}

async function locateRazorpayUser(
  env: Env,
  customerId: string | undefined,
  explicitUserId: string | undefined,
  email: string | undefined
) {
  if (explicitUserId) {
    const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?1")
      .bind(explicitUserId)
      .first<{
        id: string;
        clerk_id: string;
        email: string;
        tier: string;
        paddle_customer_id: string | null;
        razorpay_customer_id: string | null;
        created_at: string;
      }>();
    if (row) return { ...row, tier: row.tier as Tier };
  }
  if (customerId) {
    const found = await findUserByRazorpayCustomerId(env.DB, customerId);
    if (found) return found;
  }
  if (email) return await findUserByEmail(env.DB, email);
  return null;
}
