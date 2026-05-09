import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://icd-mapper-api.workers.dev";

/**
 * Forwards same-origin requests from the dashboard to the Cloudflare Worker
 * with a fresh Clerk session token attached. This avoids ever exposing the
 * worker's URL to scrapers and avoids CORS/credentials handling on the client.
 */
async function handler(req: NextRequest, ctx: { params: { path: string[] } }) {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const path = ctx.params.path.join("/");
  const url = new URL(req.url);
  const target = `${API_URL}/${path}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.delete("host");
  headers.delete("cookie");

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    // @ts-expect-error - duplex required for streaming bodies on the edge runtime
    duplex: "half",
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export { handler as GET, handler as POST, handler as DELETE };
