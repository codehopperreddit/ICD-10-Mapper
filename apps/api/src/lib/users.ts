import { nanoid } from "nanoid";
import type { Tier } from "@icd-mapper/shared";
import { tierFromString } from "@icd-mapper/shared";

export interface UserRow {
  id: string;
  clerk_id: string;
  email: string;
  tier: Tier;
  paddle_customer_id: string | null;
  razorpay_customer_id: string | null;
  created_at: string;
}

interface RawUserRow {
  id: string;
  clerk_id: string;
  email: string;
  tier: string;
  paddle_customer_id: string | null;
  razorpay_customer_id: string | null;
  created_at: string;
}

function normalize(row: RawUserRow): UserRow {
  return { ...row, tier: tierFromString(row.tier) };
}

export async function findUserByClerkId(
  db: D1Database,
  clerkId: string
): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE clerk_id = ?1")
    .bind(clerkId)
    .first<RawUserRow>();
  return row ? normalize(row) : null;
}

export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?1)")
    .bind(email)
    .first<RawUserRow>();
  return row ? normalize(row) : null;
}

export async function upsertUserFromClerk(
  db: D1Database,
  clerkId: string,
  email: string
): Promise<UserRow> {
  const existing = await findUserByClerkId(db, clerkId);
  if (existing) return existing;

  const id = nanoid(16);
  await db
    .prepare(
      `INSERT INTO users (id, clerk_id, email, tier)
       VALUES (?1, ?2, ?3, 'free')
       ON CONFLICT(clerk_id) DO UPDATE SET email = excluded.email`
    )
    .bind(id, clerkId, email)
    .run();
  // Re-read so we get the row regardless of insert vs. existing.
  const row = await findUserByClerkId(db, clerkId);
  if (!row) throw new Error("Failed to upsert user");
  return row;
}

export async function setUserTier(
  db: D1Database,
  userId: string,
  tier: Tier
): Promise<void> {
  await db.prepare("UPDATE users SET tier = ?1 WHERE id = ?2").bind(tier, userId).run();
}

export async function setPaddleCustomerId(
  db: D1Database,
  userId: string,
  paddleCustomerId: string
): Promise<void> {
  await db
    .prepare("UPDATE users SET paddle_customer_id = ?1 WHERE id = ?2")
    .bind(paddleCustomerId, userId)
    .run();
}

export async function setRazorpayCustomerId(
  db: D1Database,
  userId: string,
  razorpayCustomerId: string
): Promise<void> {
  await db
    .prepare("UPDATE users SET razorpay_customer_id = ?1 WHERE id = ?2")
    .bind(razorpayCustomerId, userId)
    .run();
}

export async function findUserByPaddleCustomerId(
  db: D1Database,
  paddleCustomerId: string
): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE paddle_customer_id = ?1")
    .bind(paddleCustomerId)
    .first<RawUserRow>();
  return row ? normalize(row) : null;
}

export async function findUserByRazorpayCustomerId(
  db: D1Database,
  razorpayCustomerId: string
): Promise<UserRow | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE razorpay_customer_id = ?1")
    .bind(razorpayCustomerId)
    .first<RawUserRow>();
  return row ? normalize(row) : null;
}
