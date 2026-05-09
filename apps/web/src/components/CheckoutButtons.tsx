"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(env: string): void };
      Initialize(opts: { token: string }): void;
      Checkout: {
        open(opts: {
          items: Array<{ priceId: string; quantity: number }>;
          customer?: { email: string };
          customData?: Record<string, unknown>;
        }): void;
      };
    };
    Razorpay?: new (opts: Record<string, unknown>) => { open(): void };
  }
}

interface Props {
  userId: string;
  email: string;
}

export function CheckoutButtons({ userId, email }: Props) {
  const [paddleReady, setPaddleReady] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);

  useEffect(() => {
    const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (paddleToken && !window.Paddle) {
      const s = document.createElement("script");
      s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      s.async = true;
      s.onload = () => {
        window.Paddle?.Environment.set("production");
        window.Paddle?.Initialize({ token: paddleToken });
        setPaddleReady(true);
      };
      document.head.appendChild(s);
    } else if (window.Paddle) {
      setPaddleReady(true);
    }

    if (!window.Razorpay) {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => setRazorpayReady(true);
      document.head.appendChild(s);
    } else {
      setRazorpayReady(true);
    }
  }, []);

  function openPaddle(tier: "pro" | "api") {
    const priceId =
      tier === "pro"
        ? process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO
        : process.env.NEXT_PUBLIC_PADDLE_PRICE_API;
    if (!priceId || !window.Paddle) return;
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { user_id: userId, tier },
    });
  }

  function openRazorpay(tier: "pro" | "api") {
    const planId =
      tier === "pro"
        ? process.env.NEXT_PUBLIC_RAZORPAY_PLAN_PRO
        : process.env.NEXT_PUBLIC_RAZORPAY_PLAN_API;
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!planId || !keyId || !window.Razorpay) return;
    new window.Razorpay({
      key: keyId,
      subscription_id: planId,
      name: "ICD Mapper",
      description: tier.toUpperCase(),
      prefill: { email },
      notes: { user_id: userId, tier, email },
      theme: { color: "#1d5cf2" },
    }).open();
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Card title="International (USD)" subtitle="Powered by Paddle (Merchant of Record)">
        <button
          className="btn-primary w-full"
          disabled={!paddleReady}
          onClick={() => openPaddle("pro")}
        >
          Upgrade to Pro — $49/mo
        </button>
        <button
          className="btn-secondary mt-2 w-full"
          disabled={!paddleReady}
          onClick={() => openPaddle("api")}
        >
          Upgrade to API — $99/mo
        </button>
      </Card>
      <Card title="India (INR)" subtitle="Powered by Razorpay (UPI / cards)">
        <button
          className="btn-primary w-full"
          disabled={!razorpayReady}
          onClick={() => openRazorpay("pro")}
        >
          Upgrade to Pro
        </button>
        <button
          className="btn-secondary mt-2 w-full"
          disabled={!razorpayReady}
          onClick={() => openRazorpay("api")}
        >
          Upgrade to API
        </button>
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
