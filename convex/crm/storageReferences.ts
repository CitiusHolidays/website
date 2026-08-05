import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Return whether a storage blob is already owned by an application record.
 *
 * Upload URLs are intentionally short-lived, but a client can still abandon
 * an upload or retry an attachment request.  Cleanup code must never delete a
 * blob that has been linked by another workflow, so all attachment owners are
 * checked in one place before a temporary blob is removed.
 */
async function hasStorageReference(ctx: any, storageId: string) {
  const [commercial, queryAttachment, proposalAttachment, passport, generic, proposalPdf] =
    await Promise.all([
      ctx.db
        .query("commercialFiles")
        .withIndex("by_storageId", (q: any) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("queryAttachments")
        .withIndex("by_storageId", (q: any) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("proposalAttachments")
        .withIndex("by_storageId", (q: any) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("passportDetails")
        .withIndex("by_storageId", (q: any) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("attachments")
        .withIndex("by_storageId", (q: any) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("proposals")
        .withIndex("by_finalizedPdfStorageId", (q: any) => q.eq("finalizedPdfStorageId", storageId))
        .first(),
    ]);
  return Boolean(
    commercial || queryAttachment || proposalAttachment || passport || generic || proposalPdf
  );
}

export const isStorageReferenced = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => hasStorageReference(ctx, String(args.storageId)),
});

/**
 * Delete a temporary blob only after the reference check runs inside the same
 * Convex mutation.  This closes the check/delete race between an action and a
 * concurrent attachment transaction; a retry sees the newly committed row
 * and leaves the blob intact.
 */
export const deleteIfUnreferenced = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    if (await hasStorageReference(ctx, String(args.storageId))) {
      return { deleted: false };
    }
    await ctx.storage.delete(args.storageId);
    return { deleted: true };
  },
});
