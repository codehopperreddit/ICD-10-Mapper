import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Dashboard pages require a session (redirect to sign-in). API routes under
// /api/* and the public /webhooks do their own auth checks and return JSON,
// so they're not force-protected here.
const isProtected = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
