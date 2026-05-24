import type { Tier } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import type { Env } from "@/lib/server/env";
import { hmacHex, safeEqual } from "@/lib/server/hmac";
import {
  findUserByPaddleCustomerId,
  setPaddleCustomerId,
  setUserTier,
} from "@/lib/server/users";
import { json, apiError } from "@/lib/server/respond";

export const runtime = "edge";

interface PaddleEvent {
  event_type: string;
  data: {
    id?: string;
    customer_id?: string;
    custom_data?: { user_id?: string; tier?: Tier };
    items?: Array<{ price?: { id?: string; product_id?: string } }>;
    status?: string;
  };
}

const PADDLE_PRICE_TIER_MAP: Record<string, Tier> = {};

export async function POST(req: Request): Promise<Response> {
  const env = getEnv();
  const sigHeader = req.headers.get("Paddle-Signature");
  const raw = await req.text();
  if (!sigHeader || !raw) return apiError("bad_request", "Missing signature or body", 400);

  const parts = Object.fromEntries(
    sigHeader.split(";").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return apiError("bad_request", "Malformed signature", 400);

  const expected = await hmacHex(env.PADDLE_WEBHOOK_SECRET ?? "", `${ts}:${raw}`);
  if (!safeEqual(expected, h1)) return apiError("invalid_signature", "Bad signature", 401);

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return apiError("bad_request", "Invalid JSON", 400);
  }

  await handlePaddleEvent(env, event);
  return json({ ok: true });
}

async function handlePaddleEvent(env: Env, event: PaddleEvent): Promise<void> {
  const customerId = event.data.customer_id;
  const explicitUserId = event.data.custom_data?.user_id;
  const explicitTier = event.data.custom_data?.tier;

  switch (event.event_type) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.activated": {
      const tier = resolveTier(event, explicitTier);
      const user = await locatePaddleUser(env, customerId, explicitUserId);
      if (!user) return;
      if (customerId && !user.paddle_customer_id) {
        await setPaddleCustomerId(env.DB, user.id, customerId);
      }
      await setUserTier(env.DB, user.id, tier);
      return;
    }
    case "subscription.canceled":
    case "subscription.paused": {
      const user = await locatePaddleUser(env, customerId, explicitUserId);
      if (user) await setUserTier(env.DB, user.id, "free");
      return;
    }
    default:
      return;
  }
}

function resolveTier(event: PaddleEvent, explicit: Tier | undefined): Tier {
  if (explicit) return explicit;
  const priceId = event.data.items?.[0]?.price?.id;
  if (priceId && PADDLE_PRICE_TIER_MAP[priceId]) return PADDLE_PRICE_TIER_MAP[priceId];
  return "pro";
}

async function locatePaddleUser(
  env: Env,
  customerId: string | undefined,
  explicitUserId: string | undefined
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
  if (customerId) return await findUserByPaddleCustomerId(env.DB, customerId);
  return null;
}
