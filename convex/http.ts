import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import { assertProvidedE2eSecret } from "./crm/lib/e2eAuth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const e2eSeed = httpAction(async (ctx, request) => {
  const secret = request.headers.get("x-e2e-seed-secret") ?? undefined;
  try {
    assertProvidedE2eSecret(secret);
    const result = await ctx.runAction(internal.crm.e2eSeedActions.run, {});
    return Response.json(result);
  } catch {
    return Response.json({ error: "E2E seed is not authorized" }, { status: 401 });
  }
});

http.route({
  handler: e2eSeed,
  method: "POST",
  path: "/e2e/seed",
});

export default http;
