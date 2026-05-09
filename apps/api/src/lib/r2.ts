import type { Env } from "../types";

/**
 * R2 in Workers doesn't expose AWS-style presigned URLs natively. We instead
 * route downloads through a signed Worker URL: include an HMAC over
 * `<userId>:<jobId>:<expiresAt>` so the holder can fetch without re-auth.
 */
export async function signDownloadToken(
  env: Env,
  userId: string,
  jobId: string,
  ttlSeconds = 60 * 15
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}:${jobId}:${expiresAt}`;
  const sig = await hmac(env.PADDLE_WEBHOOK_SECRET || env.CLERK_SECRET_KEY, payload);
  const token = btoa(`${payload}:${sig}`).replace(/=+$/, "");
  return { token, expiresAt };
}

export async function verifyDownloadToken(
  env: Env,
  token: string
): Promise<{ userId: string; jobId: string } | null> {
  let decoded: string;
  try {
    decoded = atob(padBase64(token));
  } catch {
    return null;
  }
  const parts = decoded.split(":");
  if (parts.length !== 4) return null;
  const [userId, jobId, expiresStr, sig] = parts as [string, string, string, string];
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
    return null;
  }
  const expected = await hmac(
    env.PADDLE_WEBHOOK_SECRET || env.CLERK_SECRET_KEY,
    `${userId}:${jobId}:${expires}`
  );
  if (!safeEqual(sig, expected)) return null;
  return { userId, jobId };
}

function padBase64(s: string): string {
  const pad = s.length % 4;
  return pad === 0 ? s : s + "=".repeat(4 - pad);
}

async function hmac(secret: string, message: string): Promise<string> {
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

export function inputKey(userId: string, jobId: string): string {
  return `bulk/${userId}/${jobId}/input.csv`;
}

export function outputKey(userId: string, jobId: string): string {
  return `bulk/${userId}/${jobId}/output.csv`;
}
