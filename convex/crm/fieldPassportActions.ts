"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { decryptBuffer } from "../lib/encryption";
import { downloadFileResultValidator } from "./fileReturnContracts";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";

/**
 * Citius Connect field passport read. The audit row and every authorization check (Tour
 * Manager role, own group, trip window) happen in `crm/fieldPassports:authorizeFieldPassportRead`
 * before the encrypted scan is read; the decrypted bytes go only to the caller.
 */
export const getFieldPassportFile = action({
  args: { travellerId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.roles.includes("Tour Manager"))) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);
    const grant: { fileName: string; mimeType: string; storageId: Id<"_storage"> } =
      await ctx.runMutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
        travellerId: args.travellerId,
      });
    const encryptedBlob = await ctx.storage.get(grant.storageId);
    if (!encryptedBlob) {
      throw new ConvexError("Encrypted passport file not found in storage");
    }
    const decrypted = new Uint8Array(
      decryptBuffer(Buffer.from(new Uint8Array(await encryptedBlob.arrayBuffer())))
    );
    const bytes = new Uint8Array(decrypted.byteLength);
    bytes.set(decrypted);
    return { bytes: bytes.buffer, fileName: grant.fileName, mimeType: grant.mimeType };
  },
  returns: downloadFileResultValidator,
});
