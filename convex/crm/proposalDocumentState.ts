import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";
import { notifyLinkedQuerySalesOwnersOfProposalDocument } from "./proposalDocument";
import { linkedQueriesForProposal } from "./proposalRelations";
import { enqueueQueryCommercialProjections } from "./queryCommercialProjection";

export async function handleSaveFinalizedPdf(
  ctx: MutationCtx,
  args: {
    fileName: string;
    proposalId: Id<"proposals">;
    storageId: Id<"_storage">;
    uploadedBy: string;
  }
) {
  const proposal = await ctx.db.get("proposals", args.proposalId);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  const now = Date.now();
  const previousStorageId = proposal.finalizedPdfStorageId;
  await patchWithE2eOwnership(ctx, "proposals", args.proposalId, {
    finalizedPdfFileName: args.fileName.trim() || "proposal.pdf",
    finalizedPdfStorageId: args.storageId,
    finalizedPdfUploadedAt: now,
    finalizedPdfUploadedBy: args.uploadedBy,
    updatedAt: now,
  });
  await notifyLinkedQuerySalesOwnersOfProposalDocument(ctx, {
    isReplacement: Boolean(previousStorageId),
    proposalCode: proposal.proposalCode,
    proposalId: args.proposalId,
  });
  const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
  await enqueueQueryCommercialProjections(
    ctx,
    linkedQueries.map((linkedQuery) => linkedQuery._id)
  );
  return { previousStorageId: previousStorageId ?? null };
}

export async function handleClearFinalizedPdf(
  ctx: MutationCtx,
  args: { proposalId: Id<"proposals"> }
) {
  const proposal = await ctx.db.get("proposals", args.proposalId);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  const previousStorageId = proposal.finalizedPdfStorageId ?? null;
  await patchWithE2eOwnership(ctx, "proposals", args.proposalId, {
    finalizedPdfFileName: undefined,
    finalizedPdfStorageId: undefined,
    finalizedPdfUploadedAt: undefined,
    finalizedPdfUploadedBy: undefined,
    updatedAt: Date.now(),
  });
  const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
  await enqueueQueryCommercialProjections(
    ctx,
    linkedQueries.map((linkedQuery) => linkedQuery._id)
  );
  return { previousStorageId };
}

export async function handleGetFinalizedPdfRecord(ctx: QueryCtx, args: { proposalId: string }) {
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  if (!proposalId) {
    return null;
  }
  const proposal = await ctx.db.get("proposals", proposalId);
  if (!proposal?.finalizedPdfStorageId) {
    return null;
  }
  const [linkedQueries, access] = await Promise.all([
    linkedQueriesForProposal(ctx, proposal),
    requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]),
  ]);
  if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
    const linkedJobs = await ctx.db
      .query("jobCards")
      .withIndex("by_proposalId", (query) => query.eq("proposalId", proposalId))
      .collect();
    const visibleJob = linkedJobs.some((job) => {
      const linkedQuery = linkedQueries.find(
        (candidateQuery) => candidateQuery._id === job.queryId
      );
      return canSeeJobCardRecord(access, job, linkedQuery);
    });
    if (!visibleJob) {
      throw new ConvexError("FORBIDDEN");
    }
  }
  return {
    fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
    proposalId,
    storageId: proposal.finalizedPdfStorageId,
  };
}
