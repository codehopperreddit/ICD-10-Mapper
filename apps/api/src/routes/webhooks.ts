import { Hono } from "hono";
import {
  findUserByEmail,
  findUserByPaddleCustomerId,
  findUserByRazorpayCustomerId,
  setPaddleCustomerId,
  setRazorpayCustomerId,
  setUserTier,
} from "../lib/users";
import type { Tier } from "@icd-mapper/shared";
import type { Env, Variables } from "../types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------- Paddle ----------------------------------------------------------
//
// Paddle Billing v2 ships an HMAC-SHA256 signature in the `Paddle-Signature`
// header. Format: `ts=<unix>;h1=<sig>`. The signed payload is `<ts>:<body>`.
//
// Reference: https://developer.paddle.com/webhooks/signature-verification

app.post("/paddle", async (c) => {
  const sigHeader = c.req.header("Paddle-Signature");
  const raw = await c.req.text();
  if (!sigHeader || !raw) {
    return c.json({ error: "bad_request" }, 400);
  }
  const parts = Object.fromEntries(
    sigHeader.split(";").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) {
    return c.json({ error: "bad_request" }, 400);
  }
  const expected = await hmacHex(c.env.PADDLE_WEBHOOK_SECRET, `${ts}:${raw}`);
  if (!safeEqual(expected, h1)) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: "bad_request", message: "Invalid JSON" }, 400);
  }

  await handlePaddleEvent(c.env, event);
  return c.json({ ok: true });
});

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

const PADDLE_PRICE_TIER_MAP: Record<string, Tier> = {
  // Wire actual price IDs from your Paddle dashboard:
  // pri_xxx_pro: 'pro',
  // pri_xxx_api: 'api',
};

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
  if (priceId && PADDLE_PRICE_TIER_MAP[priceId]) {
    return PADDLE_PRICE_TIER_MAP[priceId];
  }
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
  if (customerId) {
    return await findUserByPaddleCustomerId(env.DB, customerId);
  }
  return null;
}

// ---------- Razorpay --------------------------------------------------------
//
// Razorpay sends a `X-Razorpay-Signature` header which is the HMAC-SHA256 of
// the raw body using the webhook secret.
// Reference: https://razorpay.com/docs/webhooks/validate-test/

app.post("/razorpay", async (c) => {
  const sig = c.req.header("X-Razorpay-Signature");
  const raw = await c.req.text();
  if (!sig || !raw) return c.json({ error: "bad_request" }, 400);
  const expected = await hmacHex(c.env.RAZORPAY_KEY_SECRET, raw);
  if (!safeEqual(expected, sig)) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: "bad_request", message: "Invalid JSON" }, 400);
  }

  await handleRazorpayEvent(c.env, event);
  return c.json({ ok: true });
});

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

const RAZORPAY_PLAN_TIER_MAP: Record<string, Tier> = {
  // plan_xxx_pro: 'pro',
  // plan_xxx_api: 'api',
};

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
  if (email) {
    return await findUserByEmail(env.DB, email);
  }
  return null;
}

// ---------- helpers ---------------------------------------------------------

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export default app;
