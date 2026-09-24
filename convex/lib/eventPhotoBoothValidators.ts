import { v } from "convex/values";
export const boothAvailability = v.union(v.literal("open"), v.literal("closed"));
export const boothText = v.object({ en: v.string(), hi: v.string() });
export const boothArtwork = v.union(
  v.object({
    key: v.union(
      v.literal("paris"),
      v.literal("bali"),
      v.literal("dubai"),
      v.literal("kashi"),
      v.literal("ayodhya"),
      v.literal("kedarnath")
    ),
    kind: v.literal("bundled"),
  }),
  v.object({ id: v.id("eventPhotoBoothArtwork"), kind: v.literal("upload") })
);
export const boothScene = v.object({
  artwork: boothArtwork,
  caption: boothText,
  category: v.union(v.literal("travel"), v.literal("pilgrimage")),
  id: v.string(),
  title: boothText,
  visible: v.boolean(),
});
export const boothMetric = v.union(
  v.literal("visit"),
  v.literal("creation_completed"),
  v.literal("download_action"),
  v.literal("share_attempt"),
  v.literal("enquiry_entry")
);
export const boothCounts = v.object({
  creation_completed: v.number(),
  download_action: v.number(),
  enquiry_entry: v.number(),
  share_attempt: v.number(),
  visit: v.number(),
});
export const boothAccess = v.object({
  canManage: v.boolean(),
  canManageAssignments: v.boolean(),
  canParticipateWhenClosed: v.boolean(),
});
