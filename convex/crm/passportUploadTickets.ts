import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { createActivity, PERMISSIONS, requireStaff } from "./lib";
import { loadPassportMetadata, savePassportMetadataWithinTransaction } from "./passport";
import { hasStorageReference } from "./storageReferences";

export const PASSPORT_UPLOAD_TICKET_TTL_MS = 10 * 60 * 1000;
const PASSPORT_UPLOAD_CLAIM_LEASE_MS = 5 * 60 * 1000;
const MAX_CLEANUP_ATTEMPTS = 3;

const purposeValidator = v.literal("passport_scan");
const failureCodeValidator = v.union(
  v.literal("active_content"),
  v.literal("cleanup_failed"),
  v.literal("encryption_failed"),
  v.literal("invalid_size"),
  v.literal("mime_mismatch"),
  v.literal("password_protected"),
  v.literal("processing_interrupted"),
  v.literal("storage_missing"),
  v.literal("storage_referenced"),
  v.literal("unsupported_signature")
);

function denyInvalidTicket(): never {
  throw new ConvexError("Passport upload ticket is invalid or expired");
}

async function loadAuthorizedTarget(
  ctx: Parameters<typeof requireStaff>[0],
  travellerIdRaw: string
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
  if (!access.authUserId) {
    throw new ConvexError("FORBIDDEN");
  }
  await loadPassportMetadata(ctx, travellerIdRaw, PERMISSIONS.MANAGE_VISA);
  const travellerId = ctx.db.normalizeId("travellers", travellerIdRaw);
  if (!travellerId) {
    throw new ConvexError("FORBIDDEN");
  }
  const traveller = await ctx.db.get("travellers", travellerId);
  if (!traveller) {
    throw new ConvexError("FORBIDDEN");
  }
  return { access, actorId: access.authUserId, traveller, travellerId };
}

export const create = internalMutation({
  args: {
    tokenDigest: v.string(),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const { access, actorId, traveller, travellerId } = await loadAuthorizedTarget(
      ctx,
      args.travellerId
    );
    const existing = await ctx.db
      .query("passportUploadTickets")
      .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", args.tokenDigest))
      .first();
    if (existing) {
      throw new ConvexError("Passport upload ticket already exists");
    }
    const now = Date.now();
    const ticketId = await ctx.db.insert("passportUploadTickets", {
      actorId,
      cleanupAttempts: 0,
      createdAt: now,
      expiresAt: now + PASSPORT_UPLOAD_TICKET_TTL_MS,
      purpose: "passport_scan",
      status: "issued",
      targetJobCardId: traveller.jobCardId,
      targetTravellerId: travellerId,
      tokenDigest: args.tokenDigest,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      action: "passport_upload_ticket_created",
      entityId: String(ticketId),
      entityType: "passportUploadTicket",
      message: "Passport upload ticket created",
      metadata: {
        expiresAt: now + PASSPORT_UPLOAD_TICKET_TTL_MS,
        purpose: "passport_scan",
        travellerId: String(travellerId),
      },
    });
    return { expiresAt: now + PASSPORT_UPLOAD_TICKET_TTL_MS, ticketId };
  },
  returns: v.object({ expiresAt: v.number(), ticketId: v.id("passportUploadTickets") }),
});

export const claim = internalMutation({
  args: {
    cleanupOwner: v.string(),
    purpose: purposeValidator,
    storageId: v.id("_storage"),
    tokenDigest: v.string(),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const { actorId, traveller, travellerId } = await loadAuthorizedTarget(ctx, args.travellerId);
    const ticket = await ctx.db
      .query("passportUploadTickets")
      .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", args.tokenDigest))
      .unique();
    const exactBinding =
      ticket?.actorId === actorId &&
      ticket?.purpose === args.purpose &&
      ticket?.targetTravellerId === travellerId &&
      ticket?.targetJobCardId === traveller.jobCardId;
    if (
      ticket?.status === "promoted" &&
      exactBinding &&
      ticket.claimedStorageId === args.storageId
    ) {
      return {
        mode: "replay" as const,
        targetTravellerId: ticket.targetTravellerId,
        ticketId: ticket._id,
      };
    }
    const now = Date.now();
    if (
      ticket?.status === "claimed" &&
      exactBinding &&
      ticket.claimedStorageId === args.storageId &&
      ticket.cleanupOwner === args.cleanupOwner &&
      ticket.claimExpiresAt &&
      ticket.claimExpiresAt > now
    ) {
      return {
        mode: "claimed" as const,
        targetTravellerId: ticket.targetTravellerId,
        ticketId: ticket._id,
      };
    }
    if (!(ticket && exactBinding && ticket.status === "issued" && ticket.expiresAt > now)) {
      return denyInvalidTicket();
    }
    if (await hasStorageReference(ctx, args.storageId)) {
      throw new ConvexError("Passport upload storage is already owned");
    }
    const claimExpiresAt = now + PASSPORT_UPLOAD_CLAIM_LEASE_MS;
    await ctx.db.patch("passportUploadTickets", ticket._id, {
      claimExpiresAt,
      claimedAt: now,
      claimedStorageId: args.storageId,
      cleanupAfter: claimExpiresAt,
      cleanupOwner: args.cleanupOwner,
      status: "claimed",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      PASSPORT_UPLOAD_CLAIM_LEASE_MS,
      internal.crm.passportUploadTickets.cleanup,
      {
        cleanupOwner: args.cleanupOwner,
        ticketId: ticket._id,
      }
    );
    return {
      mode: "claimed" as const,
      targetTravellerId: ticket.targetTravellerId,
      ticketId: ticket._id,
    };
  },
  returns: v.union(
    v.object({
      mode: v.literal("claimed"),
      targetTravellerId: v.id("travellers"),
      ticketId: v.id("passportUploadTickets"),
    }),
    v.object({
      mode: v.literal("replay"),
      targetTravellerId: v.id("travellers"),
      ticketId: v.id("passportUploadTickets"),
    })
  ),
});

export const promote = internalMutation({
  args: {
    cleanupOwner: v.string(),
    contentDigest: v.string(),
    createdBy: v.string(),
    encryptedPayload: v.string(),
    encryptedStorageId: v.id("_storage"),
    expiryDate: v.optional(v.string()),
    fileName: v.string(),
    lastFour: v.optional(v.string()),
    mimeType: v.string(),
    passportNumberHash: v.optional(v.string()),
    ticketId: v.id("passportUploadTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (!ticket) {
      return denyInvalidTicket();
    }
    const { access, actorId, traveller, travellerId } = await loadAuthorizedTarget(
      ctx,
      String(ticket.targetTravellerId)
    );
    const now = Date.now();
    if (
      ticket.actorId !== actorId ||
      ticket.targetTravellerId !== travellerId ||
      ticket.targetJobCardId !== traveller.jobCardId ||
      ticket.purpose !== "passport_scan" ||
      ticket.status !== "claimed" ||
      ticket.cleanupOwner !== args.cleanupOwner ||
      !ticket.claimedStorageId ||
      !ticket.claimExpiresAt ||
      ticket.claimExpiresAt <= now
    ) {
      return denyInvalidTicket();
    }
    if (await hasStorageReference(ctx, args.encryptedStorageId)) {
      throw new ConvexError("Encrypted passport storage is already owned");
    }

    const displacedStorageId = await savePassportMetadataWithinTransaction(ctx, {
      createdBy: args.createdBy,
      encryptedPayload: args.encryptedPayload,
      expiryDate: args.expiryDate,
      fileName: args.fileName,
      lastFour: args.lastFour,
      mimeType: args.mimeType,
      passportNumberHash: args.passportNumberHash,
      storageId: args.encryptedStorageId,
      travellerId,
    });
    await ctx.db.patch("passportUploadTickets", ticket._id, {
      cleanupAfter: now,
      contentDigest: args.contentDigest,
      mimeType: args.mimeType,
      promotedAt: now,
      promotedStorageId: args.encryptedStorageId,
      status: "promoted",
      updatedAt: now,
      validatedAt: now,
    });
    await createActivity(ctx, access, {
      action: "passport_upload_promoted",
      entityId: String(ticket._id),
      entityType: "passportUploadTicket",
      message: "Validated passport upload encrypted and promoted",
      metadata: {
        contentDigest: args.contentDigest,
        purpose: ticket.purpose,
        travellerId: String(travellerId),
      },
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanup, {
      cleanupOwner: args.cleanupOwner,
      ticketId: ticket._id,
    });
    return { displacedStorageId };
  },
  returns: v.object({ displacedStorageId: v.union(v.id("_storage"), v.null()) }),
});

export const reject = internalMutation({
  args: {
    cleanupOwner: v.string(),
    failureCode: failureCodeValidator,
    ticketId: v.id("passportUploadTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (!ticket || ticket.cleanupOwner !== args.cleanupOwner || ticket.status === "promoted") {
      return { rejected: false };
    }
    if (ticket.status !== "claimed" && ticket.status !== "cleanup_pending") {
      return { rejected: ticket.status === "rejected" };
    }
    const now = Date.now();
    await ctx.db.patch("passportUploadTickets", ticket._id, {
      cleanupAfter: now,
      failureCode: args.failureCode,
      status: "rejected",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanup, {
      cleanupOwner: args.cleanupOwner,
      ticketId: ticket._id,
    });
    return { rejected: true };
  },
  returns: v.object({ rejected: v.boolean() }),
});

export const cleanup = internalMutation({
  args: {
    attempt: v.optional(v.number()),
    cleanupOwner: v.string(),
    ticketId: v.id("passportUploadTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (
      !ticket ||
      ticket.cleanupOwner !== args.cleanupOwner ||
      !ticket.claimedStorageId ||
      ticket.cleanupCompletedAt !== undefined
    ) {
      return { deleted: false, terminal: true };
    }

    const now = Date.now();
    if (ticket.status === "claimed" && ticket.claimExpiresAt && ticket.claimExpiresAt > now) {
      await ctx.scheduler.runAfter(
        ticket.claimExpiresAt - now,
        internal.crm.passportUploadTickets.cleanup,
        args
      );
      return { deleted: false, terminal: false };
    }

    const attempt = args.attempt ?? ticket.cleanupAttempts;
    if (ticket.status === "claimed") {
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        cleanupAfter: now,
        failureCode: "processing_interrupted",
        status: "rejected",
        updatedAt: now,
      });
    }

    const scheduleRetry = async (failureCode: "cleanup_failed" | "storage_referenced") => {
      const nextAttempt = attempt + 1;
      const retryAllowed = nextAttempt <= MAX_CLEANUP_ATTEMPTS;
      const retryAt = retryAllowed ? now + 2 ** attempt * 1000 : undefined;
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        cleanupAfter: retryAt,
        cleanupAttempts: nextAttempt,
        failureCode,
        status: ticket.status === "promoted" ? "promoted" : "cleanup_pending",
        updatedAt: now,
      });
      if (retryAt !== undefined) {
        await ctx.scheduler.runAfter(retryAt - now, internal.crm.passportUploadTickets.cleanup, {
          attempt: nextAttempt,
          cleanupOwner: args.cleanupOwner,
          ticketId: ticket._id,
        });
      }
      return { deleted: false, terminal: !retryAllowed };
    };

    if (
      await hasStorageReference(ctx, ticket.claimedStorageId, {
        ignorePassportUploadTicketId: ticket._id,
      })
    ) {
      return await scheduleRetry("storage_referenced");
    }
    try {
      await ctx.storage.delete(ticket.claimedStorageId);
    } catch {
      return await scheduleRetry("cleanup_failed");
    }

    await ctx.db.patch("passportUploadTickets", ticket._id, {
      cleanupAfter: undefined,
      cleanupAttempts: attempt,
      cleanupCompletedAt: now,
      updatedAt: now,
    });
    return { deleted: true, terminal: true };
  },
  returns: v.object({ deleted: v.boolean(), terminal: v.boolean() }),
});

export type PassportUploadTicketId = Id<"passportUploadTickets">;
