import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { createActivity, PERMISSIONS, requireStaff } from "./lib";
import { loadPassportMetadata, savePassportMetadataWithinTransaction } from "./passport";
import {
  encryptedPassportStorageContentType,
  hasStorageReference,
  passportUploadStorageContentType,
} from "./storageReferences";

export const PASSPORT_UPLOAD_TICKET_TTL_MS = 10 * 60 * 1000;
export const PASSPORT_UPLOAD_RECOVERY_WINDOW_MS = 15 * 60 * 1000;
export const PASSPORT_UPLOAD_CLAIM_LEASE_MS = 5 * 60 * 1000;
const RECOVERY_PAGE_SIZE = 64;
const MAX_CLEANUP_ATTEMPTS = 3;

const purposeValidator = v.literal("passport_scan");
const failureCodeValidator = v.union(
  v.literal("active_content"),
  v.literal("ambiguous_storage"),
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
const cleanupFailureCodeValidator = v.union(
  v.literal("ambiguous_storage"),
  v.literal("cleanup_failed"),
  v.literal("storage_referenced")
);
const cleanupResultValidator = v.object({
  degraded: v.boolean(),
  deleted: v.boolean(),
  terminal: v.boolean(),
});

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
    expectedContentDigest: v.string(),
    expectedFileSize: v.number(),
    expectedMimeType: v.string(),
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
    const expiresAt = now + PASSPORT_UPLOAD_TICKET_TTL_MS;
    const recoveryWindowEndsAt = now + PASSPORT_UPLOAD_RECOVERY_WINDOW_MS;
    const ticketId = await ctx.db.insert("passportUploadTickets", {
      actorId,
      cleanupAttempts: 0,
      createdAt: now,
      expectedContentDigest: args.expectedContentDigest,
      expectedFileSize: args.expectedFileSize,
      expectedMimeType: args.expectedMimeType,
      expiresAt,
      purpose: "passport_scan",
      recoveryMatchCount: 0,
      recoveryWindowEndsAt,
      status: "issued",
      targetJobCardId: traveller.jobCardId,
      targetTravellerId: travellerId,
      tokenDigest: args.tokenDigest,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      PASSPORT_UPLOAD_RECOVERY_WINDOW_MS,
      internal.crm.passportUploadTickets.recoverUnclaimedUpload,
      { ticketId }
    );
    await createActivity(ctx, access, {
      action: "passport_upload_ticket_created",
      entityId: String(ticketId),
      entityType: "passportUploadTicket",
      message: "Passport upload ticket created",
      metadata: {
        expiresAt,
        purpose: "passport_scan",
        travellerId: String(travellerId),
      },
    });
    return { expiresAt, ticketId };
  },
  returns: v.object({ expiresAt: v.number(), ticketId: v.id("passportUploadTickets") }),
});

const claimedTicketValidator = v.object({
  expectedContentDigest: v.string(),
  fileSize: v.number(),
  mimeType: v.string(),
  mode: v.literal("claimed"),
  targetTravellerId: v.id("travellers"),
  ticketId: v.id("passportUploadTickets"),
});
const replayedTicketValidator = v.object({
  expectedContentDigest: v.string(),
  fileSize: v.number(),
  mimeType: v.string(),
  mode: v.literal("replay"),
  targetTravellerId: v.id("travellers"),
  ticketId: v.id("passportUploadTickets"),
});

function claimResult(
  ticket: {
    _id: Id<"passportUploadTickets">;
    expectedContentDigest: string;
    expectedFileSize: number;
    expectedMimeType: string;
    targetTravellerId: Id<"travellers">;
  },
  mode: "claimed" | "replay"
) {
  return {
    expectedContentDigest: ticket.expectedContentDigest,
    fileSize: ticket.expectedFileSize,
    mimeType: ticket.expectedMimeType,
    mode,
    targetTravellerId: ticket.targetTravellerId,
    ticketId: ticket._id,
  };
}

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
      return claimResult(ticket, "replay");
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
      return claimResult(ticket, "claimed");
    }
    if (!(ticket && exactBinding && ticket.status === "issued" && ticket.expiresAt > now)) {
      return denyInvalidTicket();
    }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      metadata._creationTime < ticket.createdAt ||
      metadata._creationTime > ticket.recoveryWindowEndsAt ||
      metadata.contentType !== passportUploadStorageContentType(ticket.tokenDigest) ||
      metadata.sha256 !== ticket.expectedContentDigest ||
      metadata.size !== ticket.expectedFileSize
    ) {
      throw new ConvexError("Passport upload storage does not match its recovery record");
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
      recoveryCompletedAt: now,
      status: "claimed",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      PASSPORT_UPLOAD_CLAIM_LEASE_MS,
      internal.crm.passportUploadTickets.cleanup,
      { cleanupOwner: args.cleanupOwner, ticketId: ticket._id }
    );
    return claimResult(ticket, "claimed");
  },
  returns: v.union(claimedTicketValidator, replayedTicketValidator),
});

export const reserveEncryptedCleanup = internalMutation({
  args: {
    cleanupOwner: v.string(),
    expectedContentDigest: v.string(),
    expectedFileSize: v.number(),
    ticketId: v.id("passportUploadTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    const now = Date.now();
    if (
      ticket?.status !== "claimed" ||
      ticket.cleanupOwner !== args.cleanupOwner ||
      !ticket.claimExpiresAt ||
      ticket.claimExpiresAt <= now
    ) {
      return denyInvalidTicket();
    }
    const recoveryWindowEndsAt = now + PASSPORT_UPLOAD_CLAIM_LEASE_MS;
    const cleanupRecordId = await ctx.db.insert("passportUploadCleanupRecords", {
      attempts: 0,
      cleanupAfter: recoveryWindowEndsAt,
      cleanupOwner: args.cleanupOwner,
      createdAt: now,
      expectedContentDigest: args.expectedContentDigest,
      expectedFileSize: args.expectedFileSize,
      kind: "encrypted_candidate",
      recoveryMatchCount: 0,
      recoveryWindowEndsAt,
      status: "reserved",
      ticketId: ticket._id,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      recoveryWindowEndsAt - now,
      internal.crm.passportUploadTickets.recoverEncryptedCleanup,
      { cleanupRecordId }
    );
    return { cleanupRecordId };
  },
  returns: v.object({ cleanupRecordId: v.id("passportUploadCleanupRecords") }),
});

export const bindEncryptedCleanup = internalMutation({
  args: {
    cleanupRecordId: v.id("passportUploadCleanupRecords"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("passportUploadCleanupRecords", args.cleanupRecordId);
    if (
      record?.status === "leased" &&
      record.storageId === args.storageId &&
      record.recoveryCompletedAt !== undefined
    ) {
      return { bound: true };
    }
    const now = Date.now();
    if (
      record?.status !== "reserved" ||
      record.kind !== "encrypted_candidate" ||
      record.expectedContentDigest === undefined ||
      record.expectedFileSize === undefined ||
      record.recoveryWindowEndsAt === undefined ||
      now > record.recoveryWindowEndsAt
    ) {
      return denyInvalidTicket();
    }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      metadata._creationTime < record.createdAt ||
      metadata._creationTime > record.recoveryWindowEndsAt ||
      metadata.contentType !== encryptedPassportStorageContentType(String(record._id)) ||
      metadata.sha256 !== record.expectedContentDigest ||
      metadata.size !== record.expectedFileSize
    ) {
      throw new ConvexError("Encrypted passport storage does not match its recovery record");
    }
    if (await hasStorageReference(ctx, args.storageId)) {
      throw new ConvexError("Encrypted passport storage is already owned");
    }
    const existing = await ctx.db
      .query("passportUploadCleanupRecords")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (existing) {
      throw new ConvexError("Encrypted passport storage is already cleanup-owned");
    }
    await ctx.db.patch("passportUploadCleanupRecords", record._id, {
      recoveryCompletedAt: now,
      status: "leased",
      storageId: args.storageId,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      Math.max(record.recoveryWindowEndsAt - now, 0),
      internal.crm.passportUploadTickets.cleanupEncrypted,
      { cleanupRecordId: record._id }
    );
    return { bound: true };
  },
  returns: v.object({ bound: v.boolean() }),
});

export const promote = internalMutation({
  args: {
    cleanupOwner: v.string(),
    contentDigest: v.string(),
    createdBy: v.string(),
    encryptedCleanupRecordId: v.id("passportUploadCleanupRecords"),
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
    const [ticket, cleanupRecord] = await Promise.all([
      ctx.db.get("passportUploadTickets", args.ticketId),
      ctx.db.get("passportUploadCleanupRecords", args.encryptedCleanupRecordId),
    ]);
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
      ticket.claimExpiresAt <= now ||
      !cleanupRecord ||
      cleanupRecord.ticketId !== ticket._id ||
      cleanupRecord.cleanupOwner !== args.cleanupOwner ||
      cleanupRecord.kind !== "encrypted_candidate" ||
      cleanupRecord.status !== "leased" ||
      cleanupRecord.storageId !== args.encryptedStorageId
    ) {
      return denyInvalidTicket();
    }
    if (
      await hasStorageReference(ctx, args.encryptedStorageId, {
        ignorePassportUploadCleanupRecordId: cleanupRecord._id,
      })
    ) {
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
    await ctx.db.patch("passportUploadCleanupRecords", cleanupRecord._id, {
      cleanupAfter: undefined,
      releasedAt: now,
      status: "released",
      updatedAt: now,
    });
    if (displacedStorageId && displacedStorageId !== args.encryptedStorageId) {
      const displacedCleanupRecordId = await ctx.db.insert("passportUploadCleanupRecords", {
        attempts: 0,
        cleanupAfter: now,
        cleanupOwner: args.cleanupOwner,
        createdAt: now,
        kind: "displaced_encrypted",
        status: "pending",
        storageId: displacedStorageId,
        ticketId: ticket._id,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanupEncrypted, {
        cleanupRecordId: displacedCleanupRecordId,
      });
    }
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

export const requestEncryptedCleanup = internalMutation({
  args: { cleanupRecordId: v.id("passportUploadCleanupRecords") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("passportUploadCleanupRecords", args.cleanupRecordId);
    if (!record || record.status === "released" || record.status === "completed") {
      return { queued: false };
    }
    const now = Date.now();
    if (record.status === "reserved") {
      await ctx.scheduler.runAfter(
        Math.max((record.recoveryWindowEndsAt ?? now) - now, 0),
        internal.crm.passportUploadTickets.recoverEncryptedCleanup,
        { cleanupRecordId: record._id }
      );
      return { queued: true };
    }
    await ctx.db.patch("passportUploadCleanupRecords", record._id, {
      cleanupAfter: now,
      degradedAt: undefined,
      status: "pending",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanupEncrypted, {
      cleanupRecordId: record._id,
    });
    return { queued: true };
  },
  returns: v.object({ queued: v.boolean() }),
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

export const recoverUnclaimedUpload = internalMutation({
  args: { ticketId: v.id("passportUploadTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (ticket?.status !== "issued" || ticket.recoveryCompletedAt !== undefined) {
      return { recovered: false, terminal: true };
    }
    const now = Date.now();
    if (now < ticket.recoveryWindowEndsAt) {
      await ctx.scheduler.runAfter(
        ticket.recoveryWindowEndsAt - now,
        internal.crm.passportUploadTickets.recoverUnclaimedUpload,
        args
      );
      return { recovered: false, terminal: false };
    }
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", ticket.createdAt).lte("_creationTime", ticket.recoveryWindowEndsAt)
      )
      .order("asc")
      .paginate({ cursor: ticket.recoveryCursor ?? null, numItems: RECOVERY_PAGE_SIZE });
    const matches = page.page.filter(
      (metadata) =>
        metadata.contentType === passportUploadStorageContentType(ticket.tokenDigest) &&
        metadata.sha256 === ticket.expectedContentDigest &&
        metadata.size === ticket.expectedFileSize
    );
    const recoveryMatchCount = ticket.recoveryMatchCount + matches.length;
    const recoveryCandidateStorageId = ticket.recoveryCandidateStorageId ?? matches[0]?._id;
    if (!page.isDone) {
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        recoveryCandidateStorageId,
        recoveryCursor: page.continueCursor,
        recoveryMatchCount,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.recoverUnclaimedUpload, {
        ticketId: ticket._id,
      });
      return { recovered: false, terminal: false };
    }
    if (recoveryMatchCount === 0) {
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        cleanupCompletedAt: now,
        failureCode: "storage_missing",
        recoveryCompletedAt: now,
        recoveryCursor: undefined,
        status: "rejected",
        updatedAt: now,
      });
      return { recovered: false, terminal: true };
    }
    if (recoveryMatchCount !== 1 || !recoveryCandidateStorageId) {
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        cleanupAfter: undefined,
        cleanupDegradedAt: now,
        failureCode: "ambiguous_storage",
        recoveryCompletedAt: now,
        recoveryCursor: undefined,
        recoveryMatchCount,
        status: "cleanup_degraded",
        updatedAt: now,
      });
      return { recovered: false, terminal: true };
    }
    await ctx.db.patch("passportUploadTickets", ticket._id, {
      claimedAt: now,
      claimedStorageId: recoveryCandidateStorageId,
      cleanupAfter: now,
      cleanupOwner: ticket.tokenDigest,
      failureCode: "processing_interrupted",
      recoveryCompletedAt: now,
      recoveryCursor: undefined,
      recoveryMatchCount,
      status: "rejected",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanup, {
      cleanupOwner: ticket.tokenDigest,
      ticketId: ticket._id,
    });
    return { recovered: true, terminal: false };
  },
  returns: v.object({ recovered: v.boolean(), terminal: v.boolean() }),
});

export const recoverEncryptedCleanup = internalMutation({
  args: { cleanupRecordId: v.id("passportUploadCleanupRecords") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("passportUploadCleanupRecords", args.cleanupRecordId);
    if (record?.status !== "reserved") {
      return { recovered: false, terminal: true };
    }
    const now = Date.now();
    if (
      record.expectedContentDigest === undefined ||
      record.expectedFileSize === undefined ||
      record.recoveryWindowEndsAt === undefined
    ) {
      await ctx.db.patch("passportUploadCleanupRecords", record._id, {
        cleanupAfter: undefined,
        degradedAt: now,
        failureCode: "cleanup_failed",
        status: "degraded",
        updatedAt: now,
      });
      return { recovered: false, terminal: true };
    }
    if (now < record.recoveryWindowEndsAt) {
      await ctx.scheduler.runAfter(
        record.recoveryWindowEndsAt - now,
        internal.crm.passportUploadTickets.recoverEncryptedCleanup,
        args
      );
      return { recovered: false, terminal: false };
    }
    const { recoveryWindowEndsAt } = record;
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", record.createdAt).lte("_creationTime", recoveryWindowEndsAt)
      )
      .order("asc")
      .paginate({ cursor: record.recoveryCursor ?? null, numItems: RECOVERY_PAGE_SIZE });
    const matches = page.page.filter(
      (metadata) =>
        metadata.contentType === encryptedPassportStorageContentType(String(record._id)) &&
        metadata.sha256 === record.expectedContentDigest &&
        metadata.size === record.expectedFileSize
    );
    const recoveryMatchCount = (record.recoveryMatchCount ?? 0) + matches.length;
    const recoveryCandidateStorageId = record.recoveryCandidateStorageId ?? matches[0]?._id;
    if (!page.isDone) {
      await ctx.db.patch("passportUploadCleanupRecords", record._id, {
        recoveryCandidateStorageId,
        recoveryCursor: page.continueCursor,
        recoveryMatchCount,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.recoverEncryptedCleanup, {
        cleanupRecordId: record._id,
      });
      return { recovered: false, terminal: false };
    }
    if (recoveryMatchCount === 0) {
      await ctx.db.patch("passportUploadCleanupRecords", record._id, {
        cleanupAfter: undefined,
        completedAt: now,
        recoveryCompletedAt: now,
        recoveryCursor: undefined,
        status: "completed",
        updatedAt: now,
      });
      return { recovered: false, terminal: true };
    }
    if (recoveryMatchCount !== 1 || !recoveryCandidateStorageId) {
      await ctx.db.patch("passportUploadCleanupRecords", record._id, {
        cleanupAfter: undefined,
        degradedAt: now,
        failureCode: "ambiguous_storage",
        recoveryCompletedAt: now,
        recoveryCursor: undefined,
        recoveryMatchCount,
        status: "degraded",
        updatedAt: now,
      });
      return { recovered: false, terminal: true };
    }
    await ctx.db.patch("passportUploadCleanupRecords", record._id, {
      cleanupAfter: now,
      recoveryCompletedAt: now,
      recoveryCursor: undefined,
      recoveryMatchCount,
      status: "pending",
      storageId: recoveryCandidateStorageId,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanupEncrypted, {
      cleanupRecordId: record._id,
    });
    return { recovered: true, terminal: false };
  },
  returns: v.object({ recovered: v.boolean(), terminal: v.boolean() }),
});

export const cleanup = internalMutation({
  args: {
    cleanupOwner: v.string(),
    ticketId: v.id("passportUploadTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (
      !ticket ||
      ticket.cleanupOwner !== args.cleanupOwner ||
      !ticket.claimedStorageId ||
      ticket.cleanupCompletedAt !== undefined ||
      ticket.status === "cleanup_degraded"
    ) {
      return { degraded: ticket?.status === "cleanup_degraded", deleted: false, terminal: true };
    }

    const now = Date.now();
    if (ticket.status === "claimed" && ticket.claimExpiresAt && ticket.claimExpiresAt > now) {
      await ctx.scheduler.runAfter(
        ticket.claimExpiresAt - now,
        internal.crm.passportUploadTickets.cleanup,
        args
      );
      return { degraded: false, deleted: false, terminal: false };
    }
    if (ticket.status === "claimed") {
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        cleanupAfter: now,
        failureCode: "processing_interrupted",
        status: "rejected",
        updatedAt: now,
      });
    }

    const scheduleRetry = async (failureCode: "cleanup_failed" | "storage_referenced") => {
      const attempts = ticket.cleanupAttempts + 1;
      const retryAllowed = attempts < MAX_CLEANUP_ATTEMPTS;
      const retryAt = retryAllowed ? now + 2 ** (attempts - 1) * 1000 : undefined;
      let status: "cleanup_degraded" | "cleanup_pending" | "promoted" = "cleanup_degraded";
      if (retryAllowed) {
        status = ticket.status === "promoted" ? "promoted" : "cleanup_pending";
      }
      await ctx.db.patch("passportUploadTickets", ticket._id, {
        cleanupAfter: retryAt,
        cleanupAttempts: attempts,
        cleanupDegradedAt: retryAllowed ? undefined : now,
        failureCode,
        status,
        updatedAt: now,
      });
      if (retryAt !== undefined) {
        await ctx.scheduler.runAfter(retryAt - now, internal.crm.passportUploadTickets.cleanup, {
          cleanupOwner: args.cleanupOwner,
          ticketId: ticket._id,
        });
      }
      return { degraded: !retryAllowed, deleted: false, terminal: !retryAllowed };
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
      cleanupAttempts: ticket.cleanupAttempts + 1,
      cleanupCompletedAt: now,
      cleanupDegradedAt: undefined,
      updatedAt: now,
    });
    return { degraded: false, deleted: true, terminal: true };
  },
  returns: cleanupResultValidator,
});

export const cleanupEncrypted = internalMutation({
  args: { cleanupRecordId: v.id("passportUploadCleanupRecords") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("passportUploadCleanupRecords", args.cleanupRecordId);
    if (
      !record ||
      record.status === "released" ||
      record.status === "completed" ||
      record.status === "degraded"
    ) {
      return { degraded: record?.status === "degraded", deleted: false, terminal: true };
    }
    const now = Date.now();
    if (record.status === "reserved") {
      const recoveryAt = record.recoveryWindowEndsAt ?? now;
      await ctx.scheduler.runAfter(
        Math.max(recoveryAt - now, 0),
        internal.crm.passportUploadTickets.recoverEncryptedCleanup,
        args
      );
      return { degraded: false, deleted: false, terminal: false };
    }
    if (record.status === "leased" && record.cleanupAfter && record.cleanupAfter > now) {
      await ctx.scheduler.runAfter(
        record.cleanupAfter - now,
        internal.crm.passportUploadTickets.cleanupEncrypted,
        args
      );
      return { degraded: false, deleted: false, terminal: false };
    }

    const scheduleRetry = async (failureCode: "cleanup_failed" | "storage_referenced") => {
      const attempts = record.attempts + 1;
      const retryAllowed = attempts < MAX_CLEANUP_ATTEMPTS;
      const retryAt = retryAllowed ? now + 2 ** (attempts - 1) * 1000 : undefined;
      await ctx.db.patch("passportUploadCleanupRecords", record._id, {
        attempts,
        cleanupAfter: retryAt,
        degradedAt: retryAllowed ? undefined : now,
        failureCode,
        status: retryAllowed ? "pending" : "degraded",
        updatedAt: now,
      });
      if (retryAt !== undefined) {
        await ctx.scheduler.runAfter(
          retryAt - now,
          internal.crm.passportUploadTickets.cleanupEncrypted,
          { cleanupRecordId: record._id }
        );
      }
      return { degraded: !retryAllowed, deleted: false, terminal: !retryAllowed };
    };

    if (!record.storageId) {
      await ctx.db.patch("passportUploadCleanupRecords", record._id, {
        cleanupAfter: undefined,
        degradedAt: now,
        failureCode: "cleanup_failed",
        status: "degraded",
        updatedAt: now,
      });
      return { degraded: true, deleted: false, terminal: true };
    }

    if (
      await hasStorageReference(ctx, record.storageId, {
        ignorePassportUploadCleanupRecordId: record._id,
      })
    ) {
      return await scheduleRetry("storage_referenced");
    }
    try {
      await ctx.storage.delete(record.storageId);
    } catch {
      return await scheduleRetry("cleanup_failed");
    }
    await ctx.db.patch("passportUploadCleanupRecords", record._id, {
      attempts: record.attempts + 1,
      cleanupAfter: undefined,
      completedAt: now,
      degradedAt: undefined,
      status: "completed",
      updatedAt: now,
    });
    return { degraded: false, deleted: true, terminal: true };
  },
  returns: cleanupResultValidator,
});

export const retryPlaintextCleanup = internalMutation({
  args: { ticketId: v.id("passportUploadTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (
      !(ticket?.status === "cleanup_degraded" && ticket.claimedStorageId && ticket.cleanupOwner)
    ) {
      return { queued: false };
    }
    const now = Date.now();
    await ctx.db.patch("passportUploadTickets", ticket._id, {
      cleanupAfter: now,
      cleanupDegradedAt: undefined,
      status: "cleanup_pending",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanup, {
      cleanupOwner: ticket.cleanupOwner,
      ticketId: ticket._id,
    });
    return { queued: true };
  },
  returns: v.object({ queued: v.boolean() }),
});

export const retryEncryptedCleanup = internalMutation({
  args: { cleanupRecordId: v.id("passportUploadCleanupRecords") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("passportUploadCleanupRecords", args.cleanupRecordId);
    if (record?.status !== "degraded" || !record.storageId) {
      return { queued: false };
    }
    const now = Date.now();
    await ctx.db.patch("passportUploadCleanupRecords", record._id, {
      cleanupAfter: now,
      degradedAt: undefined,
      status: "pending",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanupEncrypted, {
      cleanupRecordId: record._id,
    });
    return { queued: true };
  },
  returns: v.object({ queued: v.boolean() }),
});

export const verifyRecoveryResidualPage = internalQuery({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    ticketId: v.id("passportUploadTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("passportUploadTickets", args.ticketId);
    if (!(ticket?.status === "cleanup_degraded" && ticket.failureCode === "ambiguous_storage")) {
      throw new ConvexError("Passport recovery residual is not ambiguous");
    }
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", ticket.createdAt).lte("_creationTime", ticket.recoveryWindowEndsAt)
      )
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: RECOVERY_PAGE_SIZE });
    return {
      continueCursor: page.continueCursor,
      descriptorActive: true as const,
      isDone: page.isDone,
      matchingCandidates: page.page.filter(
        (metadata) =>
          metadata.contentType === passportUploadStorageContentType(ticket.tokenDigest) &&
          metadata.sha256 === ticket.expectedContentDigest &&
          metadata.size === ticket.expectedFileSize
      ).length,
      recordedMatchCount: ticket.recoveryMatchCount,
    };
  },
  returns: v.object({
    continueCursor: v.string(),
    descriptorActive: v.literal(true),
    isDone: v.boolean(),
    matchingCandidates: v.number(),
    recordedMatchCount: v.number(),
  }),
});

export const verifyEncryptedRecoveryResidualPage = internalQuery({
  args: {
    cleanupRecordId: v.id("passportUploadCleanupRecords"),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get("passportUploadCleanupRecords", args.cleanupRecordId);
    if (
      record?.status !== "degraded" ||
      record.failureCode !== "ambiguous_storage" ||
      record.expectedContentDigest === undefined ||
      record.expectedFileSize === undefined ||
      record.recoveryWindowEndsAt === undefined
    ) {
      throw new ConvexError("Encrypted passport recovery residual is not ambiguous");
    }
    const { recoveryWindowEndsAt } = record;
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", record.createdAt).lte("_creationTime", recoveryWindowEndsAt)
      )
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: RECOVERY_PAGE_SIZE });
    return {
      continueCursor: page.continueCursor,
      descriptorActive: true as const,
      isDone: page.isDone,
      matchingCandidates: page.page.filter(
        (metadata) =>
          metadata.contentType === encryptedPassportStorageContentType(String(record._id)) &&
          metadata.sha256 === record.expectedContentDigest &&
          metadata.size === record.expectedFileSize
      ).length,
      recordedMatchCount: record.recoveryMatchCount ?? 0,
    };
  },
  returns: v.object({
    continueCursor: v.string(),
    descriptorActive: v.literal(true),
    isDone: v.boolean(),
    matchingCandidates: v.number(),
    recordedMatchCount: v.number(),
  }),
});

export const verifyCleanupResiduals = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 50);
    const [plaintext, encrypted] = await Promise.all([
      ctx.db
        .query("passportUploadTickets")
        .withIndex("by_status_cleanupAfter", (q) => q.eq("status", "cleanup_degraded"))
        .take(limit),
      ctx.db
        .query("passportUploadCleanupRecords")
        .withIndex("by_status_cleanupAfter", (q) => q.eq("status", "degraded"))
        .take(limit),
    ]);
    return {
      encrypted: await Promise.all(
        encrypted.map(async (record) => {
          const storageBound = record.storageId !== undefined;
          const residualPresent = record.storageId
            ? (await ctx.db.system.get("_storage", record.storageId)) !== null
            : (record.recoveryMatchCount ?? 0) > 0;
          return {
            attempts: record.attempts,
            cleanupRecordId: record._id,
            degradedAt: record.degradedAt ?? record.updatedAt,
            failureCode: record.failureCode ?? "cleanup_failed",
            kind: record.kind,
            ownershipBinding: storageBound
              ? ("storage_id" as const)
              : ("recovery_descriptor" as const),
            recoveryMatchCount: record.recoveryMatchCount ?? 0,
            residualPresent,
            ticketId: record.ticketId,
          };
        })
      ),
      plaintext: await Promise.all(
        plaintext.map(async (ticket) => {
          const storageBound = ticket.claimedStorageId !== undefined;
          const residualPresent = ticket.claimedStorageId
            ? (await ctx.db.system.get("_storage", ticket.claimedStorageId)) !== null
            : ticket.recoveryMatchCount > 0;
          return {
            attempts: ticket.cleanupAttempts,
            degradedAt: ticket.cleanupDegradedAt ?? ticket.updatedAt,
            failureCode: ticket.failureCode ?? "cleanup_failed",
            ownershipBinding: storageBound
              ? ("storage_id" as const)
              : ("recovery_descriptor" as const),
            recoveryMatchCount: ticket.recoveryMatchCount,
            residualPresent,
            ticketId: ticket._id,
          };
        })
      ),
    };
  },
  returns: v.object({
    encrypted: v.array(
      v.object({
        attempts: v.number(),
        cleanupRecordId: v.id("passportUploadCleanupRecords"),
        degradedAt: v.number(),
        failureCode: cleanupFailureCodeValidator,
        kind: v.union(v.literal("encrypted_candidate"), v.literal("displaced_encrypted")),
        ownershipBinding: v.union(v.literal("storage_id"), v.literal("recovery_descriptor")),
        recoveryMatchCount: v.number(),
        residualPresent: v.boolean(),
        ticketId: v.id("passportUploadTickets"),
      })
    ),
    plaintext: v.array(
      v.object({
        attempts: v.number(),
        degradedAt: v.number(),
        failureCode: failureCodeValidator,
        ownershipBinding: v.union(v.literal("storage_id"), v.literal("recovery_descriptor")),
        recoveryMatchCount: v.number(),
        residualPresent: v.boolean(),
        ticketId: v.id("passportUploadTickets"),
      })
    ),
  }),
});

export type PassportUploadTicketId = Id<"passportUploadTickets">;
