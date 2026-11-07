import { ConvexError, type Infer, v } from "convex/values";

/**
 * One field passport "open" in the Connect app: the app shows a quick low-resolution preview,
 * then swaps in the full scan. Both calls carry the same client-generated `openId`, so they share
 * one audit row and count once against the portal file rate limit.
 */
export const fieldPassportVariantValidator = v.union(v.literal("full"), v.literal("preview"));
export type FieldPassportVariant = Infer<typeof fieldPassportVariantValidator>;

/** Calls with the same actor, traveller and `openId` within this time share one audit row. */
export const FIELD_PASSPORT_OPEN_WINDOW_MS = 10 * 60 * 1000;

/**
 * The open window rule, measured on the server clock from the open's first call (its row's
 * `accessedAt`): a call at `now` joins the open while `now - openedAt` is under ten minutes. At
 * exactly ten minutes, or later, it starts a new open.
 */
export function joinsFieldPassportOpen(openedAt: number, now: number) {
  return now >= openedAt && now - openedAt < FIELD_PASSPORT_OPEN_WINDOW_MS;
}

/** Rows with `accessedAt` strictly after this can still be joined at `now`. */
export function fieldPassportOpenCutoff(now: number) {
  return now - FIELD_PASSPORT_OPEN_WINDOW_MS;
}
export const FIELD_PASSPORT_OPEN_ID_MAX_LENGTH = 128;
/** Matching rows read per open lookup; a miss only writes one more audit row. */
export const FIELD_PASSPORT_OPEN_LOOKUP_LIMIT = 20;
const OPEN_ID_PATTERN = /^[\w.:-]+$/;

/** The trimmed `openId`, or undefined without one. Refuses an unbounded or odd value. */
export function normalizeFieldPassportOpenId(openId: string | undefined) {
  if (openId === undefined) {
    return;
  }
  const trimmed = openId.trim();
  if (
    !trimmed ||
    trimmed.length > FIELD_PASSPORT_OPEN_ID_MAX_LENGTH ||
    !OPEN_ID_PATTERN.test(trimmed)
  ) {
    throw new ConvexError("INVALID_OPEN_ID");
  }
  return trimmed;
}

/**
 * Scan types the server can downscale. These are the image types a passport scan may be stored
 * as (`crm/passportActions`); a PDF or anything else gets no preview, and the app loads the full
 * file directly.
 */
const PREVIEWABLE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isPreviewableFieldPassportMimeType(mimeType: string) {
  return PREVIEWABLE_MIME_TYPES.has(mimeType.trim().toLowerCase());
}

/** The variants served on one audit row, in a stable order, without repeats. */
export function mergeFieldPassportVariants(
  served: readonly FieldPassportVariant[] | undefined,
  variant: FieldPassportVariant
): FieldPassportVariant[] {
  const all = new Set([...(served ?? []), variant]);
  return (["preview", "full"] as const).filter((item) => all.has(item));
}
