export type Tier = "free" | "pro" | "api";

export interface TierConfig {
  /** Daily request limit applied via KV. */
  dailyLimit: number;
  /** Max rows allowed per bulk CSV upload. */
  maxBulkRows: number;
  /** Whether the API key endpoints are accessible. */
  allowApiKeys: boolean;
  /** Display label for marketing UI. */
  label: string;
  /** Display price for marketing UI. */
  price: string;
}

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    dailyLimit: 50,
    maxBulkRows: 100,
    allowApiKeys: false,
    label: "Free",
    price: "$0",
  },
  pro: {
    dailyLimit: 5_000,
    maxBulkRows: 10_000,
    allowApiKeys: true,
    label: "Pro",
    price: "$49/mo",
  },
  api: {
    dailyLimit: 10_000,
    maxBulkRows: 100_000,
    allowApiKeys: true,
    label: "API",
    price: "$99/mo",
  },
};

export function tierFromString(value: string | null | undefined): Tier {
  if (value === "pro" || value === "api") return value;
  return "free";
}
