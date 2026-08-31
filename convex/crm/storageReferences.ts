import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";

const MAX_STORAGE_DELETE_RETRIES = 3;
const PASSPORT_UPLOAD_STORAGE_MEDIA_TYPE = "application/octet-stream";

export function passportUploadStorageContentType(tokenDigest: string) {
  return `${PASSPORT_UPLOAD_STORAGE_MEDIA_TYPE}; citius-passport-ticket=${tokenDigest}`;
}

export function encryptedPassportStorageContentType(cleanupRecordId: string) {
  return `${PASSPORT_UPLOAD_STORAGE_MEDIA_TYPE}; citius-passport-cleanup=${cleanupRecordId}`;
}

/**
 * Return whether a storage blob is already owned by an application record.
 *
 * Upload URLs are intentionally short-lived, but a client can still abandon
 * an upload or retry an attachment request.  Cleanup code must never delete a
 * blob that has been linked by another workflow, so all attachment owners are
 * checked in one place before a temporary blob is removed.
 */
export async function hasStorageReference(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
  options: {
    ignorePassportUploadCleanupRecordId?: Id<"passportUploadCleanupRecords">;
    ignorePassportUploadTicketId?: Id<"passportUploadTickets">;
  } = {}
) {
  const [
    commercial,
    commercialUploadSession,
    queryAttachment,
    proposalAttachment,
    passport,
    generic,
    proposalPdf,
    passengerExport,
    passengerExportSourceChunk,
    documentPreviewArtifact,
    passportUploadCleanupRecords,
    passportUploadTickets,
  ] = await Promise.all([
    ctx.db
      .query("commercialFiles")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("commercialFileUploadSessions")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("queryAttachments")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("proposalAttachments")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("passportDetails")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("attachments")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("proposals")
      .withIndex("by_finalizedPdfStorageId", (q) => q.eq("finalizedPdfStorageId", storageId))
      .first(),
    ctx.db
      .query("passengerExportOperations")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("passengerExportSourceChunks")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("documentPreviewOperations")
      .withIndex("by_artifactStorageId", (q) => q.eq("artifactStorageId", storageId))
      .first(),
    ctx.db
      .query("passportUploadCleanupRecords")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .take(3),
    ctx.db
      .query("passportUploadTickets")
      .withIndex("by_claimedStorageId", (q) => q.eq("claimedStorageId", storageId))
      .take(2),
  ]);
  const activePassportUploadTicket = passportUploadTickets.some(
    (ticket) =>
      ticket._id !== options.ignorePassportUploadTicketId && ticket.cleanupCompletedAt === undefined
  );
  const activePassportUploadCleanupRecord = passportUploadCleanupRecords.some(
    (record) =>
      record._id !== options.ignorePassportUploadCleanupRecordId &&
      record.status !== "completed" &&
      record.status !== "released"
  );
  const passportUploadReferenceOverflow =
    passportUploadTickets.length >= 2 || passportUploadCleanupRecords.length >= 3;
  return Boolean(
    commercial ||
      commercialUploadSession ||
      queryAttachment ||
      proposalAttachment ||
      passport ||
      generic ||
      proposalPdf ||
      passengerExport ||
      passengerExportSourceChunk ||
      documentPreviewArtifact ||
      passportUploadReferenceOverflow ||
      activePassportUploadCleanupRecord ||
      activePassportUploadTicket
  );
}

export const isStorageReferenced = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => hasStorageReference(ctx, args.storageId),
  returns: v.boolean(),
});

/**
 * Delete a temporary blob only after the reference check runs inside the same
 * Convex mutation.  This closes the check/delete race between an action and a
 * concurrent attachment transaction; a retry sees the newly committed row
 * and leaves the blob intact.
 */
export const deleteIfUnreferenced = internalMutation({
  args: {
    attempt: v.optional(v.number()),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    if (await hasStorageReference(ctx, args.storageId)) {
      return { deleted: false };
    }
    try {
      await ctx.storage.delete(args.storageId);
      return { deleted: true };
    } catch (error) {
      const attempt = args.attempt ?? 0;
      if (attempt < MAX_STORAGE_DELETE_RETRIES) {
        await ctx.scheduler.runAfter(
          2 ** attempt * 1000,
          internal.crm.storageReferences.deleteIfUnreferenced,
          {
            attempt: attempt + 1,
            storageId: args.storageId,
          }
        );
      }
      console.error("Failed to delete unreferenced storage blob:", error);
      return { deleted: false };
    }
  },
  returns: v.object({ deleted: v.boolean() }),
});
