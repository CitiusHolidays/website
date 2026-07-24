import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  canSeeQueryRecord,
  createActivity,
  deleteEntityNotifications,
  isDirectorOrAdmin,
  PERMISSIONS,
  requireStaff,
} from "./lib";

export async function handleQueryRemove(
  ctx: MutationCtx,
  args: {
    queryId: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
  if (!isDirectorOrAdmin(access)) {
    throw new ConvexError("Only Admin or Directors can delete queries");
  }
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const current = await ctx.db.get(queryId);
  if (!current) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, current)) {
    throw new ConvexError("FORBIDDEN");
  }

  const [legacyProposals, proposalLinksForQuery, jobCards] = await Promise.all([
    ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
    ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
    ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
  ]);
  const linkedRecordTypes: string[] = [];
  if (legacyProposals.length > 0 || proposalLinksForQuery.length > 0) {
    linkedRecordTypes.push("proposals");
  }
  if (jobCards.length > 0) {
    linkedRecordTypes.push("job cards");
  }
  if (linkedRecordTypes.length > 0) {
    const linkedSummary =
      linkedRecordTypes.length === 1
        ? linkedRecordTypes[0]
        : `${linkedRecordTypes.slice(0, -1).join(", ")} and ${
            linkedRecordTypes[linkedRecordTypes.length - 1]
          }`;
    throw new ConvexError(
      `Cannot delete ${current.queryCode} because it has linked ${linkedSummary}. Delete or unlink those records first.`
    );
  }

  const assignments = await ctx.db
    .query("contractingAssignments")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .collect();
  await Promise.all(assignments.map((assignment) => ctx.db.delete(assignment._id)));

  const { storageIds } = await ctx.runMutation(internal.crm.queryAttachments.deleteAllForQuery, {
    queryId,
  });
  await Promise.all(
    storageIds.map(async (storageId: Id<"_storage">) => {
      try {
        await ctx.storage.delete(storageId);
      } catch (err) {
        console.error("Failed to delete query attachment file:", err);
      }
    })
  );

  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} deleted`,
    }),
    deleteEntityNotifications(ctx, "query", queryId),
    ctx.db.delete(queryId),
  ]);
  return { id: queryId };
}
