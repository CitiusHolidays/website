import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const MAX_SACRED_BHARAT_GROUP_MEMBERS = 100;
export const SACRED_BHARAT_GROUP_COUNT_MIGRATION_KEY = "sacred-bharat-group-count-v1";

export async function readBoundedGroupMemberCount(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"sacredBharatGroups">
) {
  const members = await ctx.db
    .query("sacredBharatGroupMembers")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .take(MAX_SACRED_BHARAT_GROUP_MEMBERS + 1);
  if (members.length > MAX_SACRED_BHARAT_GROUP_MEMBERS) {
    throw new ConvexError("GROUP_MEMBER_LIMIT_REPAIR_REQUIRED");
  }
  return members.length;
}

export async function groupCountProjectionIsVerified(ctx: QueryCtx | MutationCtx) {
  const readiness = await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", SACRED_BHARAT_GROUP_COUNT_MIGRATION_KEY))
    .unique();
  return (
    readiness?.status === "verified" &&
    readiness.stage === "complete" &&
    readiness.legacyRemaining === 0
  );
}

export function verifiedGroupMemberCount(group: Doc<"sacredBharatGroups">) {
  const memberCount = group.memberCount;
  if (memberCount === undefined || !Number.isSafeInteger(memberCount) || memberCount < 0) {
    throw new ConvexError("GROUP_MEMBER_COUNT_PROJECTION_INCOMPLETE");
  }
  return memberCount;
}
