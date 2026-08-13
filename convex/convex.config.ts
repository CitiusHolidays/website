import aggregate from "@convex-dev/aggregate/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();

app.use(betterAuth);
app.use(rateLimiter);
app.use(aggregate, { name: "sacredBharatLeaderboardRanks" });

export default app;
