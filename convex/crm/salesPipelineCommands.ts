import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import {
  canSeeQueryRecord,
  createActivity,
  hasCementRole,
  hasRole,
  isCementQueryType,
  isDirectorOrAdmin,
  PERMISSIONS,
  requireStaff,
} from "./lib";
import {
  assertSalesPipelineBoardMove,
  resolveSalesPipelineStage,
  type SalesPipelineBoardStage,
} from "./salesPipelinePolicy";

export async function handleMoveSalesPipelineStage(
  ctx: MutationCtx,
  args: {
    expectedLeadStage: string;
    queryId: string;
    targetStage: SalesPipelineBoardStage;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
  const hasSalesAuthority =
    isDirectorOrAdmin(access) ||
    hasRole(access, "Sales") ||
    hasRole(access, "Sales Head") ||
    hasRole(access, "Sales Cement");
  if (!hasSalesAuthority) {
    throw new ConvexError("Only Sales can move Sales Pipeline cards");
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
  if (hasCementRole(access) && !isCementQueryType(current.queryType)) {
    throw new ConvexError("Cement roles can only move Cement query types");
  }

  const currentStage = resolveSalesPipelineStage(current);
  if (currentStage !== args.expectedLeadStage) {
    throw new ConvexError("Pipeline card is out of date. Refresh and try again.");
  }

  assertSalesPipelineBoardMove({
    currentStage,
    query: current,
    targetStage: args.targetStage,
  });

  const now = Date.now();
  await ctx.db.patch(queryId, {
    leadStage: args.targetStage,
    updatedAt: now,
  });

  await createActivity(ctx, access, {
    action: "pipeline_moved",
    entityId: queryId,
    entityType: "query",
    message: `${current.queryCode} moved from ${currentStage} to ${args.targetStage} on the sales pipeline`,
    metadata: {
      fromStage: currentStage,
      toStage: args.targetStage,
    },
  });

  return { fromStage: currentStage, id: queryId, toStage: args.targetStage };
}
