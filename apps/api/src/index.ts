import { Hono } from "hono";
import { cors } from "hono/cors";
import searchRoute from "./routes/search";
import publicRoute from "./routes/public";
import bulkRoute from "./routes/bulk";
import keysRoute from "./routes/keys";
import meRoute from "./routes/me";
import webhooksRoute from "./routes/webhooks";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  // The /api/public/* routes register their own permissive CORS handler
  // because they are meant to be called from any origin.
  if (c.req.path.startsWith("/api/public/")) return next();

  const origin = c.env.WEB_ORIGIN ?? "*";
  const corsHandler = cors({
    origin: (req) => {
      if (req === origin) return req;
      if (req.startsWith("http://localhost")) return req;
      return null;
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 86400,
  });
  return corsHandler(c, next);
});

app.get("/", (c) =>
  c.json({
    name: "icd-mapper-api",
    env: c.env.ENVIRONMENT,
    docs: "https://github.com/codehopperreddit/icd-10-mapper",
  })
);

app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route("/api/public", publicRoute);
app.route("/api/search", searchRoute);
app.route("/api/bulk-map", bulkRoute);
app.route("/api/keys", keysRoute);
app.route("/api/me", meRoute);
app.route("/webhooks", webhooksRoute);

app.notFound((c) => c.json({ error: "not_found", message: "Route not found" }, 404));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: "internal_error", message: "Something went wrong" },
    500
  );
});

export default app;
