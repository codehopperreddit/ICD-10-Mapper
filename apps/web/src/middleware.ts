import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Run Clerk ONLY on routes that actually use the session: the dashboard and the
// authenticated API. Public routes (/, /docs, /sign-in, /sign-up,
// /api/public/*, /webhooks/*) never invoke Clerk, so the marketing site and the
// public demo work even if CLERK_SECRET_KEY isn't set.
const isProtected = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/dashboard(.*)",
    "/api/search",
    "/api/me(.*)",
    "/api/keys(.*)",
    "/api/bulk-map(.*)",
  ],
};
