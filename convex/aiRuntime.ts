import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { aiRateLimitResultValidator, aiTelemetryIdResultValidator } from "./publicReturnContracts";

const featureValidator = v.union(v.literal("concierge"), v.literal("journeyPlanner"));
const terminalStateValidator = v.union(
  v.literal("completed"),
  v.literal("failed"),
  v.literal("interrupted")
);

const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const TELEMETRY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;

function assertRuntimeSecret(secret: string) {
  const expected = process.env.AI_RUNTIME_SECRET;
  if (!(expected && secret === expected)) {
    throw new Error("Invalid AI runtime secret");
  }
}

function currentTime(ctx: unknown) {
  const injectedNow = (ctx as { now?: () => number }).now;
  return injectedNow ? injectedNow() : Date.now();
}

export const consumeRateLimit = mutation({
  args: {
    feature: featureValidator,
    keyHash: v.string(),
    limit: v.number(),
    secret: v.string(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    assertRuntimeSecret(args.secret);
    if (!/^[a-f0-9]{64}$/.test(args.keyHash)) {
      throw new Error("Invalid privacy-safe rate-limit key");
    }
    if (!(Number.isInteger(args.limit) && args.limit > 0 && args.limit <= 100)) {
      throw new Error("Invalid AI rate limit");
    }
    if (
      !(Number.isInteger(args.windowMs) && args.windowMs >= 1000 && args.windowMs <= 86_400_000)
    ) {
      throw new Error("Invalid AI rate-limit window");
    }

    const now = currentTime(ctx);
    const existing = await ctx.db
      .query("aiRateLimits")
      .withIndex("by_feature_key", (query) =>
        query.eq("feature", args.feature).eq("keyHash", args.keyHash)
      )
      .unique();

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + args.windowMs;
      const values = {
        count: 1,
        expiresAt: resetAt + RATE_LIMIT_RETENTION_MS,
        feature: args.feature,
        keyHash: args.keyHash,
        resetAt,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, values);
      } else {
        await ctx.db.insert("aiRateLimits", values);
      }
      return { allowed: true, remaining: args.limit - 1, retryAfterSec: 0 };
    }

    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    if (existing.count >= args.limit) {
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    const count = existing.count + 1;
    await ctx.db.patch(existing._id, { count, updatedAt: now });
    return { allowed: true, remaining: args.limit - count, retryAfterSec: 0 };
  },
  returns: aiRateLimitResultValidator,
});

export const recordTelemetry = mutation({
  args: {
    fallback: v.boolean(),
    feature: featureValidator,
    finishReason: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    latencyMs: v.number(),
    model: v.string(),
    outputTokens: v.optional(v.number()),
    secret: v.string(),
    terminalState: terminalStateValidator,
  },
  handler: async (ctx, args) => {
    assertRuntimeSecret(args.secret);
    const now = currentTime(ctx);
    const { secret: _secret, ...event } = args;
    return await ctx.db.insert("aiTelemetry", {
      ...event,
      createdAt: now,
      retentionUntil: now + TELEMETRY_RETENTION_MS,
    });
  },
  returns: aiTelemetryIdResultValidator,
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = currentTime(ctx);
    const [rateLimits, telemetry] = await Promise.all([
      ctx.db
        .query("aiRateLimits")
        .withIndex("by_expiresAt", (query) => query.lt("expiresAt", now))
        .take(CLEANUP_BATCH_SIZE),
      ctx.db
        .query("aiTelemetry")
        .withIndex("by_retentionUntil", (query) => query.lt("retentionUntil", now))
        .take(CLEANUP_BATCH_SIZE),
    ]);

    await Promise.all([...rateLimits, ...telemetry].map((row) => ctx.db.delete(row._id)));
    if (rateLimits.length === CLEANUP_BATCH_SIZE || telemetry.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.aiRuntime.cleanupExpired, {});
    }
    return { deleted: rateLimits.length + telemetry.length };
  },
});
