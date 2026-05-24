import { TIERS } from "@icd-mapper/shared";
import { getEnv } from "@/lib/server/env";
import { resolveAuth, isAdminEmail } from "@/lib/server/auth";
import { json, apiError } from "@/lib/server/respond";

export const runtime = "edge";

export async function GET(req: Request): Promise<Response> {
  const env = getEnv();
  const auth = await resolveAuth(req, env);
  if (!auth) return apiError("unauthorized", "Sign in required.", 401);

  return json({
    user: {
      id: auth.userId,
      email: auth.email,
      tier: auth.tier,
      isAdmin: isAdminEmail(env, auth.email),
    },
    tierConfig: TIERS[auth.tier],
  });
}
