import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";

/** A Commercial Files source the caller may write, as listed by `commercialFiles.listForEntryPoint`. */
export interface WritableCommercialSource {
  id: string;
  sourceType: string;
  teamAreas: string[];
}

/**
 * Rejecting an upload must not leave an unreferenced blob in Convex Storage.
 * The blob is deleted only when no file record references it, so a retry that
 * names an existing blob cannot delete a document another record already uses.
 * Cleanup is best-effort: the original validation or authorization error stays
 * the one returned to the caller. deleteIfUnreferenced schedules its own bounded
 * retries when the storage delete fails; if the mutation cannot run at all, the
 * failure is only logged (there is no scheduled storage sweep).
 */
export async function cleanupUnreferencedUpload(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
  uploadDescription: string
) {
  try {
    await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId,
    });
  } catch (error) {
    console.error(`Failed to clean up ${uploadDescription}:`, error);
  }
}

/** Read a stored file's complete bytes for an authorized download. */
export async function readStoredFileForDownload(
  ctx: ActionCtx,
  record: {
    storageId: string;
    fileName: string;
    mimeType?: string;
  }
) {
  const blob = await ctx.storage.get(record.storageId);
  if (!blob) {
    throw new ConvexError("File is no longer available");
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    fileName: record.fileName,
    mimeType: record.mimeType ?? "application/octet-stream",
  };
}
