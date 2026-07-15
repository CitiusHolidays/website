import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  assertContractingPipelineBoardMove,
  type ContractingPipelineBoardStage,
  resolveContractingPipelineStage,
} from "./contractingPipelinePolicy";
import {
  canSeeQueryRecord,
  hasCementRole,
  isCementQueryType,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";
import { handleSendProposalToSales } from "./proposals";

async function linkedDraftProposalIds(ctx: MutationCtx, queryId: Id<"queries">) {
  const [links, legacyProposals] = await Promise.all([
    ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
    ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
  ]);
  const proposalIds = new Set<Id<"proposals">>([
    ...links.map((link) => link.proposalId),
    ...legacyProposals.map((proposal) => proposal._id),
  ]);
  const proposals = (
    await Promise.all(Array.from(proposalIds, (proposalId) => ctx.db.get(proposalId)))
  ).filter((proposal): proposal is NonNullable<typeof proposal> => proposal?.status === "Draft");
  return proposals.map((proposal) => proposal._id);
}

export async function handleMoveContractingPipelineStage(
  ctx: MutationCtx,
  args: {
    expectedContractingStatus: string;
    queryId: string;
    targetStage: ContractingPipelineBoardStage;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_PROPOSALS,
    PERMISSIONS.MANAGE_CONTRACTING,
  ]);
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

  const currentStage = resolveContractingPipelineStage(current);
  if (currentStage !== args.expectedContractingStatus) {
    throw new ConvexError("Pipeline card is out of date. Refresh and try again.");
  }
  assertContractingPipelineBoardMove({
    currentStage,
    query: current,
    targetStage: args.targetStage,
  });

  const proposalIds = await linkedDraftProposalIds(ctx, queryId);
  if (proposalIds.length === 0) {
    throw new ConvexError("No draft proposal is linked to this query. Create the proposal first.");
  }
  if (proposalIds.length > 1) {
    throw new ConvexError(
      "More than one draft proposal is linked to this query. Send the intended proposal from Proposals."
    );
  }

  const result = await handleSendProposalToSales(ctx, { proposalId: proposalIds[0] });
  return {
    fromStage: currentStage,
    id: queryId,
    proposalId: result.id,
    toStage: args.targetStage,
  };
}
