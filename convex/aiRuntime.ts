import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
import { consumeComponentAiRateLimit } from "./lib/aiRateLimit";
import { isRuntimeFunction } from "./lib/runtimeValues";
import { aiRateLimitResultValidator, aiTelemetryIdResultValidator } from "./publicReturnContracts";

const featureValidator = v.union(v.literal("concierge"), v.literal("journeyPlanner"));
const terminalStateValidator = v.union(
  v.literal("completed"),
  v.literal("failed"),
  v.literal("interrupted")
);
const finishReasonValidator = v.union(
  v.literal("stop"),
  v.literal("length"),
  v.literal("content-filter"),
  v.literal("tool-calls"),
  v.literal("error"),
  v.literal("other")
);
const groundingCategoryValidator = v.union(v.literal("canonical_tool"), v.literal("unknown"));
const latencyCategoryValidator = v.union(
  v.literal("under_2_seconds"),
  v.literal("2_to_8_seconds"),
  v.literal("over_8_seconds"),
  v.literal("unknown")
);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const TELEMETRY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 200;
const MODEL_LINE_BREAK_PATTERN = /[\r\n]/u;

interface AiRuntimeContext {
  now?: () => number;
  runMutation?: MutationCtx["runMutation"];
  runQuery?: MutationCtx["runQuery"];
}

function supportsComponentRateLimit(ctx: AiRuntimeContext) {
  return isRuntimeFunction(ctx.runMutation) && isRuntimeFunction(ctx.runQuery);
}

function assertRuntimeSecret(secret: string) {
  const expected = process.env.AI_RUNTIME_SECRET;
  if (!(expected && secret === expected)) {
    throw new Error("Invalid AI runtime secret");
  }
}

function currentTime(ctx: AiRuntimeContext) {
  const injectedNow = ctx.now;
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
    if (!HASH_PATTERN.test(args.keyHash)) {
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
    if (supportsComponentRateLimit(ctx)) {
      return await consumeComponentAiRateLimit(ctx, args, now);
    }

    // Direct unit handlers retain the legacy in-memory DB seam. Real Convex
    // mutation contexts always take the component path above; keeping this
    // characterized seam also preserves an immediate source rollback while
    // legacy rows remain during the staged pilot.
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
        await ctx.db.patch("aiRateLimits", existing._id, values);
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
    await ctx.db.patch("aiRateLimits", existing._id, { count, updatedAt: now });
    return { allowed: true, remaining: args.limit - count, retryAfterSec: 0 };
  },
  returns: aiRateLimitResultValidator,
});

export const recordTelemetry = mutation({
  args: {
    fallback: v.boolean(),
    feature: featureValidator,
    finishReason: v.optional(finishReasonValidator),
    groundingCategory: v.optional(groundingCategoryValidator),
    inputTokens: v.optional(v.number()),
    latencyCategory: v.optional(latencyCategoryValidator),
    latencyMs: v.number(),
    model: v.string(),
    outputTokens: v.optional(v.number()),
    secret: v.string(),
    terminalState: terminalStateValidator,
  },
  handler: async (ctx, args) => {
    assertRuntimeSecret(args.secret);
    if (
      !(Number.isSafeInteger(args.latencyMs) && args.latencyMs >= 0 && args.latencyMs <= 300_000)
    ) {
      throw new Error("Invalid AI telemetry latency");
    }
    if (
      ![args.inputTokens, args.outputTokens].every(
        (value) =>
          value === undefined || (Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000)
      )
    ) {
      throw new Error("Invalid AI telemetry token count");
    }
    if (
      !(
        args.model.length > 0 &&
        args.model.length <= 200 &&
        !MODEL_LINE_BREAK_PATTERN.test(args.model)
      )
    ) {
      throw new Error("Invalid AI telemetry model");
    }
    const now = currentTime(ctx);
    const { secret: _secret, ...event } = args;
    return await ctx.db.insert("aiTelemetry", {
      ...event,
      createdAt: now,
      groundingCategory: event.groundingCategory ?? "unknown",
      latencyCategory: event.latencyCategory ?? "unknown",
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

    await Promise.all([
      ...rateLimits.map((row) => ctx.db.delete("aiRateLimits", row._id)),
      ...telemetry.map((row) => ctx.db.delete("aiTelemetry", row._id)),
    ]);
    if (rateLimits.length === CLEANUP_BATCH_SIZE || telemetry.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.aiRuntime.cleanupExpired, {});
    }
    return { deleted: rateLimits.length + telemetry.length };
  },
  returns: v.object({ deleted: v.number() }),
});
