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
import { handleSendProposalToSales } from "./proposalHandoffCommands";

async function eligibleProposalIds(ctx: MutationCtx, queryId: Id<"queries">) {
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .collect();
  const candidates = await Promise.all(
    links.map(async (link) => ({ link, proposal: await ctx.db.get("proposals", link.proposalId) }))
  );
  return candidates.flatMap(({ link, proposal }) => {
    if (!proposal || ["Accepted", "Rejected"].includes(proposal.status)) {
      return [];
    }
    const currentRevision = proposal.proposalRevision ?? 1;
    return link.handedOffRevision === currentRevision ? [] : [proposal._id];
  });
}

export async function handleMoveContractingPipelineStage(
  ctx: MutationCtx,
  args: {
    commandId: string;
    expectedContractingStatus: string;
    proposalId: string;
    proposalRevision: number;
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

  const result = await handleSendProposalToSales(
    ctx,
    {
      commandId: args.commandId,
      proposalId: args.proposalId,
      proposalRevision: args.proposalRevision,
      queryId: args.queryId,
    },
    {
      beforeFreshHandoff: async () => {
        const currentStage = resolveContractingPipelineStage(current);
        if (currentStage !== args.expectedContractingStatus) {
          throw new ConvexError("Pipeline card is out of date. Refresh and try again.");
        }
        assertContractingPipelineBoardMove({
          currentStage,
          query: current,
          targetStage: args.targetStage,
        });
        const proposalIds = await eligibleProposalIds(ctx, queryId);
        if (proposalIds.length === 0) {
          throw new ConvexError(
            "No current Proposal revision is ready for this Query. Update the Proposal first."
          );
        }
        if (proposalIds.length > 1) {
          throw new ConvexError(
            "More than one Proposal is ready for this Query. Send the intended Proposal from Proposals."
          );
        }
        if (String(proposalIds[0]) !== args.proposalId) {
          throw new ConvexError("The selected Proposal is not the current Pipeline candidate");
        }
      },
    }
  );
  return {
    fromStage: args.expectedContractingStatus,
    id: queryId,
    proposalId: result.id,
    toStage: args.targetStage,
  };
}
