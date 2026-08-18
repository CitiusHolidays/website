import aggregate from "@convex-dev/aggregate/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp({
  env: {
    E2E_PROVISIONING_TARGET: v.optional(v.string()),
    E2E_SEED_SECRET: v.optional(v.string()),
    E2E_TARGET_ID: v.optional(v.string()),
    VERCEL_ENV: v.optional(v.string()),
  },
});

app.use(betterAuth);
app.use(rateLimiter);
app.use(aggregate, { name: "sacredBharatLeaderboardRanks" });

export default app;
