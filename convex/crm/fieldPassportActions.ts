"use node";

import { ConvexError, type Infer, v } from "convex/values";
import sharp from "sharp";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { decryptBuffer } from "../lib/encryption";
import { fieldPassportVariantValidator } from "./fieldPassportOpenPolicy";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";

/** About 900 px on the long edge at JPEG quality 70: typically well under 150 KB. */
const PREVIEW_LONG_EDGE_PX = 900;
const PREVIEW_JPEG_QUALITY = 70;
// Phone cameras top out near 200 MP; anything larger is not a passport scan.
const MAX_INPUT_PIXELS = 250_000_000;
const FILE_EXTENSION_PATTERN = /\.[^.]*$/;

/**
 * The response. Without `variant` it is exactly the original `{ bytes, fileName, mimeType }`,
 * so app builds that predate previews are unchanged.
 */
const fieldPassportFileResultValidator = v.union(
  v.object({ bytes: v.bytes(), fileName: v.string(), mimeType: v.string() }),
  v.object({
    bytes: v.bytes(),
    fileName: v.string(),
    // Displayed size (EXIF orientation applied) of image scans; absent for a PDF.
    height: v.optional(v.number()),
    mimeType: v.string(),
    variant: v.literal("full"),
    width: v.optional(v.number()),
  }),
  v.object({
    bytes: v.bytes(),
    fileName: v.string(),
    fullMimeType: v.string(),
    height: v.number(),
    mimeType: v.literal("image/jpeg"),
    variant: v.literal("preview"),
    width: v.number(),
  }),
  v.object({ variant: v.literal("none") })
);
type FieldPassportFileResult = Infer<typeof fieldPassportFileResultValidator>;

interface FieldPassportGrant {
  fileName: string;
  mimeType: string;
  serve: "full" | "none" | "preview";
  storageId: Id<"_storage">;
}

function toArrayBuffer(buffer: Buffer) {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes.buffer;
}

async function readDecryptedScan(ctx: ActionCtx, storageId: Id<"_storage">) {
  const encryptedBlob = await ctx.storage.get(storageId);
  if (!encryptedBlob) {
    throw new ConvexError("Encrypted passport file not found in storage");
  }
  return decryptBuffer(Buffer.from(new Uint8Array(await encryptedBlob.arrayBuffer())));
}

/** Displayed width and height of an image scan from its header, or null when unreadable. */
async function displayedSize(scan: Buffer) {
  try {
    const metadata = await sharp(scan, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    if (!(metadata.width && metadata.height)) {
      return null;
    }
    // EXIF orientations 5-8 turn the stored image a quarter turn.
    const quarterTurn = (metadata.orientation ?? 1) >= 5;
    return quarterTurn
      ? { height: metadata.width, width: metadata.height }
      : { height: metadata.height, width: metadata.width };
  } catch {
    return null;
  }
}

/**
 * A fresh downscaled JPEG, generated per request and never stored. `rotate()` applies the EXIF
 * orientation; sharp writes no metadata (EXIF, GPS, ICC, XMP) unless asked to keep it.
 */
async function previewOf(scan: Buffer) {
  try {
    const { data, info } = await sharp(scan, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        fit: "inside",
        height: PREVIEW_LONG_EDGE_PX,
        width: PREVIEW_LONG_EDGE_PX,
        withoutEnlargement: true,
      })
      .jpeg({ mozjpeg: true, quality: PREVIEW_JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data, height: info.height, width: info.width };
  } catch {
    return null;
  }
}

function previewFileName(fileName: string) {
  const stem = fileName.replace(FILE_EXTENSION_PATTERN, "").trim() || "passport";
  return `${stem}-preview.jpg`;
}

/**
 * Citius Connect field passport read. The audit row and every authorization check (Tour
 * Manager role, own group, trip window, app pilot, portal file rate limit) happen in
 * `crm/fieldPassports:authorizeFieldPassportRead` before the encrypted scan is read; the
 * decrypted bytes, or a preview made from them in memory, go only to the caller.
 *
 * `variant: "preview"` returns a small upright JPEG of an image scan for a quick first paint,
 * or `{ variant: "none" }` for a PDF or an image sharp cannot read, and the app then loads the
 * full file. The app sends one `openId` with the preview and the full call of one open, so the
 * two share one audit row and count once against the rate limit.
 */
export const getFieldPassportFile = action({
  args: {
    openId: v.optional(v.string()),
    travellerId: v.string(),
    variant: v.optional(fieldPassportVariantValidator),
  },
  handler: async (ctx, args): Promise<FieldPassportFileResult> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.roles.includes("Tour Manager"))) {
      throw new ConvexError("FORBIDDEN");
    }
    let grant: FieldPassportGrant;
    try {
      grant = await ctx.runMutation(internal.crm.fieldPassports.authorizeFieldPassportRead, args);
    } catch (error) {
      // A refused call still counts against the rate limit, as it did before opens: the
      // mutation's own count rolled back with its refusal. When the refusal is the rate limit
      // itself the window is full, so this counts nothing and throws the same error.
      await enforcePortalFileDownloadLimit(ctx, access);
      throw error;
    }
    if (grant.serve === "none") {
      return { variant: "none" };
    }
    const scan = await readDecryptedScan(ctx, grant.storageId);
    if (grant.serve === "preview") {
      const preview = await previewOf(scan);
      if (!preview) {
        return { variant: "none" };
      }
      return {
        bytes: toArrayBuffer(preview.data),
        fileName: previewFileName(grant.fileName),
        fullMimeType: grant.mimeType,
        height: preview.height,
        mimeType: "image/jpeg",
        variant: "preview",
        width: preview.width,
      };
    }
    const file = { bytes: toArrayBuffer(scan), fileName: grant.fileName, mimeType: grant.mimeType };
    if (args.variant === undefined) {
      return file;
    }
    const size = grant.mimeType.startsWith("image/") ? await displayedSize(scan) : null;
    return { ...file, ...size, variant: "full" };
  },
  returns: fieldPassportFileResultValidator,
});
