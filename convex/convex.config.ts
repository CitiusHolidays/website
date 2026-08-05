import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp({
  env: {
    NODE_ENV: v.optional(v.string()),
    PAYMENT_MUTATION_SECRET: v.optional(v.string()),
    PAYMENT_RECONCILIATION_FIXTURES: v.optional(v.string()),
  },
});

app.use(betterAuth);

export default app;
