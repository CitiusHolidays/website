import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery, query } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import {
  invalidateDocumentPreviewSource,
  scheduleDocumentPreviewPreparation,
} from "./documentPreviewLifecycle";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import { canSeeJobCardRecord, PERMISSIONS, requireStaff } from "./lib";
import { buildTravellerListSearchText, markListSearchDirty } from "./listSearch";
import {
  passportMetadataResultValidator,
  passportStorageMetadataResultValidator,
} from "./operationsReturnContracts";
import { normalizePassportExpiryDate } from "./passportExpiry";

async function passportTravellerPatch(
  ctx: MutationCtx,
  travellerId: Id<"travellers">,
  patch: RuntimeObject
) {
  const traveller = await ctx.db.get("travellers", travellerId);
  if (!traveller) {
    throw new ConvexError("Invalid traveller id");
  }
  const job = await ctx.db.get("jobCards", traveller.jobCardId);
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
  const traveller = await ctx.db.get("travellers", travellerIdNormalized);
  if (!traveller) {
    throw new ConvexError("FORBIDDEN");
  }
  const job = await ctx.db.get("jobCards", traveller.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
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

interface SavePassportMetadataInput {
  createdBy: string;
  encryptedPayload: string;
  expiryDate?: string;
  fileName: string;
  lastFour?: string;
  mimeType: string;
  passportNumberHash?: string;
  storageId: Id<"_storage">;
  travellerId: Id<"travellers">;
}

/**
 * Persist an already-authorized, encrypted passport replacement.
 *
 * Callers must establish either current Staff `MANAGE_VISA` authority or a
 * future ADR-0012-compliant intake capability before entering this helper.
 * Keeping the write in a plain helper lets the upload ticket and passport
 * state transition commit in one Convex transaction.
 */
export async function savePassportMetadataWithinTransaction(
  ctx: MutationCtx,
  args: SavePassportMetadataInput
) {
  const now = Date.now();
  const expiryDate = normalizePassportExpiryDate(args.expiryDate);
  const existing = await ctx.db
    .query("passportDetails")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", args.travellerId))
    .unique();
  const displacedStorageId = existing?.storageId ?? null;
  await invalidateDocumentPreviewSource(ctx, "passport", String(args.travellerId));

  if (existing) {
    await ctx.db.patch("passportDetails", existing._id, {
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
      travellerId: args.travellerId,
      updatedAt: now,
    });
  }

  await ctx.db.patch(
    "travellers",
    args.travellerId,
    await passportTravellerPatch(ctx, args.travellerId, {
      hasPassportScan: true,
      passportExpiryDate: expiryDate,
      passportStatus: "Received",
      updatedAt: now,
    })
  );
  await markListSearchDirty(ctx, "travellers", String(args.travellerId));
  await scheduleCrmMetricSync(ctx, "travellers", String(args.travellerId));
  await scheduleDocumentPreviewPreparation(ctx, "passport", String(args.travellerId));

  return displacedStorageId;
}

export const getPassportMetadata = query({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata = await loadPassportMetadata(ctx, args.travellerId);
    if (!metadata) {
      return null;
    }
    const { storageId: _storageId, ...publicMetadata } = metadata;
    return publicMetadata;
  },
  returns: passportMetadataResultValidator,
});

export const getAuthorizedPassportStorageMetadata = internalQuery({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => await loadPassportMetadata(ctx, args.travellerId),
  returns: passportStorageMetadataResultValidator,
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
    return await savePassportMetadataWithinTransaction(ctx, {
      ...args,
      travellerId,
    });
  },
  returns: v.union(v.id("_storage"), v.null()),
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
      await ctx.db.patch("passportDetails", existing._id, {
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
      "travellers",
      travellerId,
      await passportTravellerPatch(ctx, travellerId, {
        hasPassportScan: Boolean(existing?.storageId),
        passportExpiryDate: expiryDate,
        passportStatus: "Received",
        updatedAt: now,
      })
    );
    await markListSearchDirty(ctx, "travellers", String(travellerId));
    await scheduleCrmMetricSync(ctx, "travellers", String(travellerId));
    return null;
  },
  returns: v.null(),
});

export const deletePassportMetadata = internalMutation({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    await loadPassportMetadata(ctx, args.travellerId, PERMISSIONS.MANAGE_VISA);

    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) {
      return null;
    }

    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
      .unique();

    if (existing) {
      await invalidateDocumentPreviewSource(ctx, "passport", String(travellerIdNormalized));
      await ctx.db.delete("passportDetails", existing._id);
    }

    await ctx.db.patch(
      "travellers",
      travellerIdNormalized,
      await passportTravellerPatch(ctx, travellerIdNormalized, {
        hasPassportScan: false,
        passportExpiryDate: undefined,
        passportStatus: "Pending",
        updatedAt: Date.now(),
      })
    );
    await markListSearchDirty(ctx, "travellers", String(travellerIdNormalized));
    await scheduleCrmMetricSync(ctx, "travellers", String(travellerIdNormalized));

    return existing?.storageId ?? null;
  },
  returns: v.union(v.id("_storage"), v.null()),
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
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    page: v.array(v.object({ encryptedPayload: v.string(), id: v.id("passportDetails") })),
    scanned: v.number(),
  }),
});

export const backfillPassportExpiryDate = internalMutation({
  args: {
    expiryDate: v.optional(v.string()),
    passportId: v.id("passportDetails"),
  },
  handler: async (ctx, args) => {
    const passport = await ctx.db.get("passportDetails", args.passportId);
    const expiryDate = normalizePassportExpiryDate(args.expiryDate);
    await ctx.db.patch("passportDetails", args.passportId, {
      expiryDate,
      updatedAt: Date.now(),
    });
    if (passport) {
      await ctx.db.patch("travellers", passport.travellerId, { passportExpiryDate: expiryDate });
      await scheduleCrmMetricSync(ctx, "travellers", String(passport.travellerId));
    }
    return null;
  },
  returns: v.null(),
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
      return null;
    }
    const traveller = await ctx.db.get("travellers", travellerIdNormalized);
    if (!traveller) {
      return null;
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
    return null;
  },
  returns: v.null(),
});
