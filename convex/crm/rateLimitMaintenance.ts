import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  PORTAL_FILE_DOWNLOAD_LIMIT,
  PORTAL_FILE_DOWNLOAD_WINDOW_MS,
  POST_TOUR_MEDIA_READ_LIMIT,
} from "./lib/portalFileDownloadPolicy";

const CLEANUP_BATCH_SIZE = 100;
const portalFileRateLimitResultValidator = v.object({
  allowed: v.boolean(),
  remaining: v.number(),
  retryAfterSeconds: v.union(v.number(), v.null()),
});

async function consumeDownloadWindow(ctx: MutationCtx, identityKey: string, limit: number) {
  const authUserId = identityKey.trim();
  if (!authUserId) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 1 };
  }

  const now = Date.now();
  const existing = await ctx.db
    .query("portalFileDownloadRateLimits")
    .withIndex("by_authUserId", (query) => query.eq("authUserId", authUserId))
    .unique();

  if (!existing || now >= existing.expiresAt) {
    const values = {
      authUserId,
      count: 1,
      expiresAt: now + PORTAL_FILE_DOWNLOAD_WINDOW_MS,
      startedAt: now,
    };
    if (existing) {
      await ctx.db.patch("portalFileDownloadRateLimits", existing._id, values);
    } else {
      await ctx.db.insert("portalFileDownloadRateLimits", values);
    }
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: null,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }

  const nextCount = existing.count + 1;
  await ctx.db.patch("portalFileDownloadRateLimits", existing._id, { count: nextCount });
  return {
    allowed: true,
    remaining: limit - nextCount,
    retryAfterSeconds: null,
  };
}

export const consumePortalFileDownload = internalMutation({
  args: { authUserId: v.string() },
  handler: (ctx, args) => consumeDownloadWindow(ctx, args.authUserId, PORTAL_FILE_DOWNLOAD_LIMIT),
  returns: portalFileRateLimitResultValidator,
});

export const consumePostTourMediaRead = internalMutation({
  args: { authUserId: v.string() },
  handler: (ctx, args) => {
    const actor = args.authUserId.trim();
    return consumeDownloadWindow(
      ctx,
      actor ? `post-tour-thumbnail:${actor}` : "",
      POST_TOUR_MEDIA_READ_LIMIT
    );
  },
  returns: portalFileRateLimitResultValidator,
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [inboundRows, portalFileRows] = await Promise.all([
      ctx.db
        .query("inboundIntentRateLimits")
        .withIndex("by_expiresAt", (query) => query.lt("expiresAt", now))
        .take(CLEANUP_BATCH_SIZE),
      ctx.db
        .query("portalFileDownloadRateLimits")
        .withIndex("by_expiresAt", (query) => query.lt("expiresAt", now))
        .take(CLEANUP_BATCH_SIZE),
    ]);

    await Promise.all([
      ...inboundRows.map((row) => ctx.db.delete("inboundIntentRateLimits", row._id)),
      ...portalFileRows.map((row) => ctx.db.delete("portalFileDownloadRateLimits", row._id)),
    ]);
    const scheduled =
      inboundRows.length === CLEANUP_BATCH_SIZE || portalFileRows.length === CLEANUP_BATCH_SIZE;
    if (scheduled) {
      await ctx.scheduler.runAfter(0, internal.crm.rateLimitMaintenance.cleanupExpired, {});
    }

    return { deleted: inboundRows.length + portalFileRows.length, scheduled };
  },
  returns: v.object({ deleted: v.number(), scheduled: v.boolean() }),
});
