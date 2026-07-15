import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { canSeeJobCardRecord, PERMISSIONS, requireStaff } from "./lib";
import { buildTravellerListSearchText } from "./listSearch";
import { passportMetadataResultValidator } from "./operationsReturnContracts";
import { normalizePassportExpiryDate } from "./passportExpiry";

async function passportTravellerPatch(
  ctx: MutationCtx,
  travellerId: Id<"travellers">,
  patch: Record<string, unknown>
) {
  const traveller = await ctx.db.get(travellerId);
  if (!traveller) {
    throw new ConvexError("Invalid traveller id");
  }
  const job = await ctx.db.get(traveller.jobCardId);
  const nextTraveller = { ...traveller, ...patch };
  return {
    ...patch,
    listSearchText: buildTravellerListSearchText(nextTraveller, {
      jobCode: job?.jobCode,
      travelBatchReference: nextTraveller.travelBatchReference,
    }),
  };
}

export async function loadPassportMetadata(
  ctx: QueryCtx | MutationCtx,
  travellerIdRaw: string,
  permission = PERMISSIONS.VIEW_VISA
) {
  const access = await requireStaff(ctx, permission);
  const travellerIdNormalized = ctx.db.normalizeId("travellers", travellerIdRaw);
  if (!travellerIdNormalized) {
    throw new ConvexError("FORBIDDEN");
  }
  const traveller = await ctx.db.get(travellerIdNormalized);
  if (!traveller) {
    throw new ConvexError("FORBIDDEN");
  }
  const job = await ctx.db.get(traveller.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const row = await ctx.db
    .query("passportDetails")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
    .unique();
  if (!row) {
    return null;
  }
  return {
    createdAt: new Date(row.createdAt).toISOString(),
    expiryDate: row.expiryDate ?? "",
    fileName: row.fileName,
    id: row._id,
    lastFour: row.lastFour ?? "",
    mimeType: row.mimeType,
    status: row.status ?? "Received",
    storageId: row.storageId,
    travellerId: row.travellerId,
  };
}

export const getPassportMetadata = query({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => await loadPassportMetadata(ctx, args.travellerId),
  returns: passportMetadataResultValidator,
});

export const savePassportMetadata = internalMutation({
  args: {
    createdBy: v.string(),
    encryptedPayload: v.string(),
    expiryDate: v.optional(v.string()),
    fileName: v.string(),
    lastFour: v.optional(v.string()),
    mimeType: v.string(),
    passportNumberHash: v.optional(v.string()),
    storageId: v.id("_storage"),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    await loadPassportMetadata(ctx, args.travellerId, PERMISSIONS.MANAGE_VISA);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }

    const now = Date.now();
    const expiryDate = normalizePassportExpiryDate(args.expiryDate);
    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .unique();
    const displacedStorageId = existing?.storageId ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        fileName: args.fileName,
        lastFour: args.lastFour,
        mimeType: args.mimeType,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        storageId: args.storageId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("passportDetails", {
        createdAt: now,
        createdBy: args.createdBy,
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        fileName: args.fileName,
        lastFour: args.lastFour,
        mimeType: args.mimeType,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        storageId: args.storageId,
        travellerId,
        updatedAt: now,
      });
    }

    await ctx.db.patch(
      travellerId,
      await passportTravellerPatch(ctx, travellerId, {
        hasPassportScan: true,
        passportExpiryDate: expiryDate,
        passportStatus: "Received",
        updatedAt: now,
      })
    );

    return displacedStorageId;
  },
});

export const savePassportDetailsOnly = internalMutation({
  args: {
    createdBy: v.string(),
    encryptedPayload: v.string(),
    expiryDate: v.optional(v.string()),
    lastFour: v.optional(v.string()),
    passportNumberHash: v.optional(v.string()),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }

    const now = Date.now();
    const expiryDate = normalizePassportExpiryDate(args.expiryDate);
    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        lastFour: args.lastFour,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("passportDetails", {
        createdAt: now,
        createdBy: args.createdBy,
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        lastFour: args.lastFour,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        travellerId,
        updatedAt: now,
      });
    }

    await ctx.db.patch(
      travellerId,
      await passportTravellerPatch(ctx, travellerId, {
        hasPassportScan: Boolean(existing?.storageId),
        passportExpiryDate: expiryDate,
        passportStatus: "Received",
        updatedAt: now,
      })
    );
  },
});

export const deletePassportMetadata = internalMutation({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    await loadPassportMetadata(ctx, args.travellerId, PERMISSIONS.MANAGE_VISA);

    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) {
      return;
    }

    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.patch(
      travellerIdNormalized,
      await passportTravellerPatch(ctx, travellerIdNormalized, {
        hasPassportScan: false,
        passportExpiryDate: undefined,
        passportStatus: "Pending",
        updatedAt: Date.now(),
      })
    );

    return existing?.storageId ?? null;
  },
});

export const listPassportDetailsForBackfill = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(Math.floor(args.limit), 1), 100);
    const page = await ctx.db
      .query("passportDetails")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems });
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      page: page.page.flatMap((row) =>
        !row.expiryDate && row.encryptedPayload
          ? [
              {
                encryptedPayload: row.encryptedPayload,
                id: row._id,
              },
            ]
          : []
      ),
      scanned: page.page.length,
    };
  },
});

export const backfillPassportExpiryDate = internalMutation({
  args: {
    expiryDate: v.optional(v.string()),
    passportId: v.id("passportDetails"),
  },
  handler: async (ctx, args) => {
    const passport = await ctx.db.get(args.passportId);
    const expiryDate = normalizePassportExpiryDate(args.expiryDate);
    await ctx.db.patch(args.passportId, {
      expiryDate,
      updatedAt: Date.now(),
    });
    if (passport) {
      await ctx.db.patch(passport.travellerId, { passportExpiryDate: expiryDate });
    }
  },
});

export const logViewActivity = internalMutation({
  args: {
    authUserId: v.string(),
    travellerId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) {
      return;
    }
    const traveller = await ctx.db.get(travellerIdNormalized);
    if (!traveller) {
      return;
    }

    await ctx.db.insert("activityLogs", {
      action: "viewed",
      actorId: args.authUserId,
      actorName: args.userName,
      createdAt: Date.now(),
      entityId: args.travellerId,
      entityType: "passport",
      message: `Passport scanned document of ${traveller.fullName} viewed by ${args.userName}`,
    });
  },
});
