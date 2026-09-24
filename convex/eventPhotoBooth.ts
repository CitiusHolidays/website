import { DAY, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  BOOTH_ARTWORK_URLS,
  type BoothSceneDraft,
  DEFAULT_BOOTH_SCENES,
  EMPTY_BOOTH_METRICS,
  isBoothMetricBatch,
} from "../src/lib/eventPhotoBooth/contracts";
import { internal } from "./_generated/api";
import {
  env,
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getPortalAccess } from "./crm/lib/staffAccess";
import {
  boothAccess,
  boothAvailability,
  boothCounts,
  boothMetric,
  boothScene,
} from "./lib/eventPhotoBoothValidators";
import { rateLimiterComponent } from "./lib/rateLimiterComponent";

const SCENE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const RATE_KEY = /^[a-f0-9]{64}$/;
const limiter = new RateLimiter(rateLimiterComponent, {
  photoBoothMetrics: { kind: "fixed window", period: 15 * MINUTE, rate: 1200 },
});
const resolvedScene = boothScene.extend({ artworkUrl: v.string() });
const configFor = (ctx: QueryCtx | MutationCtx) =>
  ctx.db
    .query("eventPhotoBoothConfig")
    .withIndex("by_key", (q) => q.eq("key", "event"))
    .unique();
const metricsFor = (ctx: QueryCtx | MutationCtx) =>
  ctx.db
    .query("eventPhotoBoothMetrics")
    .withIndex("by_key", (q) => q.eq("key", "event"))
    .unique();

async function accessFor(ctx: QueryCtx | MutationCtx) {
  const staff = await getPortalAccess(ctx);
  const privileged = Boolean(
    staff.allowed &&
      staff.staffId &&
      (staff.roles.includes("Admin") || staff.roles.includes("Directors"))
  );
  const { staffId } = staff;
  const assigned = Boolean(
    staff.allowed &&
      staffId &&
      (await ctx.db
        .query("eventPhotoBoothAssignments")
        .withIndex("by_staffId", (q) => q.eq("staffId", staffId))
        .unique())
  );
  return {
    canManage: privileged || assigned,
    canManageAssignments: privileged,
    canParticipateWhenClosed: privileged,
  };
}
async function requireManager(ctx: QueryCtx | MutationCtx, assignments = false) {
  const access = await accessFor(ctx);
  if (!(assignments ? access.canManageAssignments : access.canManage)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}
async function resolveScenes(ctx: QueryCtx | MutationCtx, scenes: BoothSceneDraft[]) {
  return await Promise.all(
    scenes.map(async (scene) => {
      if (scene.artwork.kind === "bundled") {
        return { ...scene, artworkUrl: BOOTH_ARTWORK_URLS[scene.artwork.key] };
      }
      const artwork = await ctx.db.get("eventPhotoBoothArtwork", scene.artwork.id);
      const artworkUrl = artwork ? await ctx.storage.getUrl(artwork.storageId) : null;
      if (!artworkUrl) {
        throw new ConvexError("ARTWORK_UNAVAILABLE");
      }
      return { ...scene, artworkUrl };
    })
  );
}
async function validateScenes(ctx: QueryCtx | MutationCtx, scenes: BoothSceneDraft[]) {
  if (
    scenes.length < 1 ||
    scenes.length > 24 ||
    new Set(scenes.map((s) => s.id)).size !== scenes.length
  ) {
    throw new ConvexError("INVALID_SCENES");
  }
  for (const scene of scenes) {
    if (!SCENE_ID.test(scene.id)) {
      throw new ConvexError("INVALID_SCENE_ID");
    }
    for (const lang of ["en", "hi"] as const) {
      if (
        !scene.title[lang].trim() ||
        scene.title[lang].length > 80 ||
        scene.caption[lang].length > 160
      ) {
        throw new ConvexError("INVALID_SCENE_TEXT");
      }
    }
  }
  await resolveScenes(ctx, scenes);
}
function checkRevision(expected: number, actual: number) {
  if (!Number.isSafeInteger(expected) || expected !== actual) {
    throw new ConvexError("REVISION_CONFLICT");
  }
}
async function ensureConfig(ctx: MutationCtx) {
  const existing = await configFor(ctx);
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("eventPhotoBoothConfig", {
    availability: "closed",
    draftScenes: DEFAULT_BOOTH_SCENES,
    key: "event",
    publishedScenes: DEFAULT_BOOTH_SCENES,
    revision: 0,
  });
  const config = await ctx.db.get("eventPhotoBoothConfig", id);
  if (!config) {
    throw new ConvexError("CONFIG_UNAVAILABLE");
  }
  return config;
}

export const getMyAccess = query({ args: {}, handler: accessFor, returns: boothAccess });
export const getParticipantState = query({
  args: {},
  handler: async (ctx) => {
    const [config, access] = await Promise.all([configFor(ctx), accessFor(ctx)]);
    const availability = config?.availability ?? "closed";
    const canParticipate = availability === "open" || access.canParticipateWhenClosed;
    return {
      availability,
      canParticipate,
      privilegedAccess: access.canParticipateWhenClosed,
      revision: config?.revision ?? 0,
      scenes: canParticipate
        ? await resolveScenes(
            ctx,
            (config?.publishedScenes ?? DEFAULT_BOOTH_SCENES).filter((s) => s.visible)
          )
        : [],
    };
  },
  returns: v.object({
    availability: boothAvailability,
    canParticipate: v.boolean(),
    privilegedAccess: v.boolean(),
    revision: v.number(),
    scenes: v.array(resolvedScene),
  }),
});
export const getManagementState = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireManager(ctx);
    const [config, metrics] = await Promise.all([configFor(ctx), metricsFor(ctx)]);
    return {
      availability: config?.availability ?? "closed",
      canManageAssignments: access.canManageAssignments,
      draftScenes: await resolveScenes(ctx, config?.draftScenes ?? DEFAULT_BOOTH_SCENES),
      metrics: metrics?.counts ?? EMPTY_BOOTH_METRICS,
      publishedScenes: await resolveScenes(ctx, config?.publishedScenes ?? DEFAULT_BOOTH_SCENES),
      revision: config?.revision ?? 0,
    };
  },
  returns: v.object({
    availability: boothAvailability,
    canManageAssignments: v.boolean(),
    draftScenes: v.array(resolvedScene),
    metrics: boothCounts,
    publishedScenes: v.array(resolvedScene),
    revision: v.number(),
  }),
});
export const setAvailability = mutation({
  args: { availability: boothAvailability },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const config = await ensureConfig(ctx);
    if (args.availability === "open") {
      if (!config.publishedScenes.some((scene) => scene.visible)) {
        throw new ConvexError("NO_VISIBLE_SCENES");
      }
      await validateScenes(ctx, config.publishedScenes);
    }
    await ctx.db.patch("eventPhotoBoothConfig", config._id, { availability: args.availability });
    return null;
  },
  returns: v.null(),
});
export const saveDraftScenes = mutation({
  args: { expectedRevision: v.number(), scenes: v.array(boothScene) },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const config = await ensureConfig(ctx);
    checkRevision(args.expectedRevision, config.revision);
    await validateScenes(ctx, args.scenes);
    const revision = config.revision + 1;
    await ctx.db.patch("eventPhotoBoothConfig", config._id, { draftScenes: args.scenes, revision });
    await cleanRemovedArtwork(ctx, config.draftScenes, [...args.scenes, ...config.publishedScenes]);
    return revision;
  },
  returns: v.number(),
});
export const publishScenes = mutation({
  args: { expectedRevision: v.number() },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const config = await ensureConfig(ctx);
    checkRevision(args.expectedRevision, config.revision);
    await validateScenes(ctx, config.draftScenes);
    if (config.availability === "open" && !config.draftScenes.some((scene) => scene.visible)) {
      throw new ConvexError("NO_VISIBLE_SCENES");
    }
    const revision = config.revision + 1;
    await ctx.db.patch("eventPhotoBoothConfig", config._id, {
      publishedScenes: config.draftScenes,
      revision,
    });
    await cleanRemovedArtwork(ctx, config.publishedScenes, config.draftScenes);
    return revision;
  },
  returns: v.number(),
});
export const listAssignableStaff = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireManager(ctx, true);
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new ConvexError("INVALID_PAGE_SIZE");
    }
    const page = await ctx.db
      .query("staffUsers")
      .withIndex("by_name")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page
          .filter((staff) => Boolean(staff.authUserId))
          .map(async (staff) => ({
            active: staff.active,
            assigned: Boolean(
              await ctx.db
                .query("eventPhotoBoothAssignments")
                .withIndex("by_staffId", (q) => q.eq("staffId", staff._id))
                .unique()
            ),
            id: staff._id,
            name: staff.name,
            roles: staff.roles,
          }))
      ),
    };
  },
  returns: paginationResultValidator(
    v.object({
      active: v.boolean(),
      assigned: v.boolean(),
      id: v.id("staffUsers"),
      name: v.string(),
      roles: v.array(v.string()),
    })
  ),
});
export const setStaffAssignment = mutation({
  args: { assigned: v.boolean(), staffId: v.id("staffUsers") },
  handler: async (ctx, args) => {
    await requireManager(ctx, true);
    const existing = await ctx.db
      .query("eventPhotoBoothAssignments")
      .withIndex("by_staffId", (q) => q.eq("staffId", args.staffId))
      .unique();
    if (args.assigned) {
      const target = await ctx.db.get("staffUsers", args.staffId);
      if (!(target?.active && target.authUserId && target.roles.length)) {
        throw new ConvexError("INVALID_STAFF");
      }
      if (!existing) {
        await ctx.db.insert("eventPhotoBoothAssignments", { staffId: args.staffId });
      }
    } else if (existing) {
      await ctx.db.delete("eventPhotoBoothAssignments", existing._id);
    }
    return null;
  },
  returns: v.null(),
});

export const cleanupRateKey = internalMutation({
  args: { id: v.id("eventPhotoBoothRateKeys") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("eventPhotoBoothRateKeys", args.id);
    if (!row) {
      return null;
    }
    if (row.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(row.expiresAt, internal.eventPhotoBooth.cleanupRateKey, args);
      return null;
    }
    await limiter.reset(ctx, "photoBoothMetrics", { key: row.keyHash });
    await ctx.db.delete("eventPhotoBoothRateKeys", row._id);
    return null;
  },
  returns: v.null(),
});
export const recordMetricGateway = mutation({
  args: {
    events: v.array(
      v.object({ count: v.number(), event: boothMetric, sceneId: v.optional(v.string()) })
    ),
    gatewaySecret: v.string(),
    rateLimitKeyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const secret = env.EVENT_PHOTO_BOOTH_GATEWAY_SECRET?.trim();
    if (!(secret && args.gatewaySecret === secret)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!(RATE_KEY.test(args.rateLimitKeyHash) && isBoothMetricBatch({ events: args.events }))) {
      throw new ConvexError("INVALID_METRICS");
    }
    const config = await configFor(ctx);
    const visible = new Set(
      (config?.publishedScenes ?? DEFAULT_BOOTH_SCENES).filter((s) => s.visible).map((s) => s.id)
    );
    if (args.events.some((e) => e.event !== "visit")) {
      if (config?.availability !== "open" && !(await accessFor(ctx)).canParticipateWhenClosed) {
        throw new ConvexError("EVENT_CLOSED");
      }
      if (args.events.some((e) => e.sceneId && !visible.has(e.sceneId))) {
        throw new ConvexError("INVALID_SCENE_ID");
      }
    }
    await limiter.limit(ctx, "photoBoothMetrics", { key: args.rateLimitKeyHash, throws: true });
    const retained = await ctx.db
      .query("eventPhotoBoothRateKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.rateLimitKeyHash))
      .unique();
    if (!retained) {
      const expiresAt = Date.now() + DAY;
      const id = await ctx.db.insert("eventPhotoBoothRateKeys", {
        expiresAt,
        keyHash: args.rateLimitKeyHash,
      });
      await ctx.scheduler.runAt(expiresAt, internal.eventPhotoBooth.cleanupRateKey, { id });
    }
    const existing = await metricsFor(ctx);
    const counts = { ...(existing?.counts ?? EMPTY_BOOTH_METRICS) };
    for (const event of args.events) {
      counts[event.event] += event.count;
    }
    // ponytail: one bounded aggregate row; shard counters only if measured event traffic causes contention.
    if (existing) {
      await ctx.db.patch("eventPhotoBoothMetrics", existing._id, { counts });
    } else {
      await ctx.db.insert("eventPhotoBoothMetrics", { counts, key: "event" });
    }
    return null;
  },
  returns: v.null(),
});

export const registerArtwork = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const id = await ctx.db.insert("eventPhotoBoothArtwork", {
      createdAt: Date.now(),
      storageId: args.storageId,
    });
    await ctx.scheduler.runAfter(DAY, internal.eventPhotoBooth.cleanupArtwork, { id });
    return id;
  },
  returns: v.id("eventPhotoBoothArtwork"),
});
export const cleanupArtwork = internalMutation({
  args: { id: v.id("eventPhotoBoothArtwork") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("eventPhotoBoothArtwork", args.id);
    if (!row) {
      return null;
    }
    const config = await configFor(ctx);
    const referenced = [...(config?.draftScenes ?? []), ...(config?.publishedScenes ?? [])].some(
      (scene) => scene.artwork.kind === "upload" && scene.artwork.id === args.id
    );
    if (!referenced) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete("eventPhotoBoothArtwork", row._id);
    }
    return null;
  },
  returns: v.null(),
});

async function cleanRemovedArtwork(
  ctx: MutationCtx,
  previous: BoothSceneDraft[],
  retained: BoothSceneDraft[]
) {
  const used = new Set(
    retained.flatMap((scene) => (scene.artwork.kind === "upload" ? [scene.artwork.id] : []))
  );
  const removed = new Set(
    previous.flatMap((scene) =>
      scene.artwork.kind === "upload" && !used.has(scene.artwork.id) ? [scene.artwork.id] : []
    )
  );
  await Promise.all(
    [...removed].map((id) =>
      ctx.scheduler.runAfter(DAY, internal.eventPhotoBooth.cleanupArtwork, { id })
    )
  );
}
