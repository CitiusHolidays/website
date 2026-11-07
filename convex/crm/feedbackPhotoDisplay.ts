"use node";

import { ConvexError } from "convex/values";
import sharp from "sharp";

/**
 * Longest edge of the sharper on-screen copy of a feedback photo. A single
 * photo can fill the panel width, and the stored 640px thumbnail is soft on
 * phones and 2x screens there. Made on request from the stored photo and never
 * stored, so retention, deletion and erasure have nothing new to clean up.
 */
export const FEEDBACK_PHOTO_DISPLAY_EDGE = 1600;
const DISPLAY_QUALITY = 82;

export async function feedbackPhotoDisplay(blob: Blob | null, fileName: string) {
  if (!blob) {
    throw new ConvexError("Photo not found");
  }
  const bytes = await sharp(Buffer.from(await blob.arrayBuffer()), {
    limitInputPixels: 40_000_000,
  })
    .resize({
      fit: "inside",
      height: FEEDBACK_PHOTO_DISPLAY_EDGE,
      width: FEEDBACK_PHOTO_DISPLAY_EDGE,
      withoutEnlargement: true,
    })
    .webp({ effort: 4, quality: DISPLAY_QUALITY })
    .toBuffer();
  return {
    bytes: new Uint8Array(bytes).buffer,
    fileName: `${fileName}.display.webp`,
    mimeType: "image/webp",
  };
}
