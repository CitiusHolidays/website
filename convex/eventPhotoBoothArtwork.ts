"use node";
import { ConvexError, v } from "convex/values";
import sharp from "sharp";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { boothArtwork } from "./lib/eventPhotoBoothValidators";

export const uploadArtwork = action({
  args: { bytes: v.bytes() },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.eventPhotoBooth.getMyAccess, {});
    if (!access.canManage) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!args.bytes.byteLength || args.bytes.byteLength > 900_000) {
      throw new ConvexError("ARTWORK_TOO_LARGE");
    }
    let bytes: Buffer;
    try {
      const image = sharp(Buffer.from(args.bytes), {
        failOn: "warning",
        limitInputPixels: 16_777_216,
      });
      const info = await image.metadata();
      if (
        !(
          info.format &&
          ["jpeg", "png", "webp"].includes(info.format) &&
          info.width &&
          info.height
        ) ||
        info.width > 4096 ||
        info.height > 4096 ||
        (info.pages ?? 1) > 1
      ) {
        throw new Error("Unsupported artwork");
      }
      // Decode and re-encode instead of trusting extensions, headers, or embedded metadata.
      bytes = await image.rotate().webp({ quality: 88 }).toBuffer();
      if (bytes.byteLength > 900_000) {
        throw new Error("Artwork too large");
      }
    } catch {
      // biome-ignore lint/style/useErrorCause: image parser details must not leak through the public action.
      throw new ConvexError("INVALID_ARTWORK");
    }
    const storageId = await ctx.storage.store(
      new Blob([Uint8Array.from(bytes)], { type: "image/webp" })
    );
    try {
      const id: Id<"eventPhotoBoothArtwork"> = await ctx.runMutation(
        internal.eventPhotoBooth.registerArtwork,
        { storageId }
      );
      const artworkUrl = await ctx.storage.getUrl(storageId);
      if (!artworkUrl) {
        throw new ConvexError("ARTWORK_UNAVAILABLE");
      }
      return { artwork: { id, kind: "upload" as const }, artworkUrl };
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
  returns: v.object({ artwork: boothArtwork, artworkUrl: v.string() }),
});
