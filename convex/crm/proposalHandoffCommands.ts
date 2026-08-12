import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { resolveCommandReceipt, storeCommandReceipt } from "./commandReceipts";
import {
  canEditProposalRecord,
  canSeeProposalRecord,
  createActivity,
  editorPatch,
  PERMISSIONS,
  publishWorkflowNotification,
  requireAnyPermission,
} from "./lib";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";
import { refreshProposalLinkProjections } from "./proposalLinkProjection";
import { linkedQueriesForProposal } from "./proposalRelations";
import { enqueueQueryCommercialProjections } from "./queryCommercialProjection";

function assertProposalPricingComplete(proposal: { costPrice?: number; sellingPrice?: number }) {
  if (!((proposal.sellingPrice ?? 0) > 0 && (proposal.costPrice ?? 0) > 0)) {
    throw new ConvexError(
      "Enter selling price and cost price on the proposal before sending it to Sales."
    );
  }
}

export async function handleSendProposalToSales(
  ctx: MutationCtx,
  args: { commandId?: string; proposalId: string }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_PROPOSALS,
    PERMISSIONS.MANAGE_CONTRACTING,
  ]);
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  if (!proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
  if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!canEditProposalRecord(access, proposal, linkedQueries)) {
    throw new ConvexError(
      "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can send this proposal to Sales"
    );
  }
  const receipt = args.commandId
    ? await resolveCommandReceipt(ctx, {
        access,
        commandId: args.commandId,
        operation: "proposal.send_to_sales",
        payload: { proposalId: String(proposalId) },
        targetId: String(proposalId),
      })
    : null;
  if (receipt?.replayedResultId) {
    const replayedId = ctx.db.normalizeId("proposals", receipt.replayedResultId);
    if (!replayedId) {
      throw new ConvexError("Stored command result is no longer valid");
    }
    return { id: replayedId };
  }
  if (proposal.status === "Sent") {
    throw new ConvexError("This proposal was already sent to Sales");
  }
  assertProposalPricingComplete(proposal);
  const now = Date.now();
  const queryCodes =
    linkedQueries.map((linkedQuery) => linkedQuery.queryCode).join(", ") || "linked query";
  const primaryQuery = linkedQueries[0] ?? null;
  await Promise.all([
    patchWithE2eOwnership(ctx, "proposals", proposalId, {
      sentToSalesAt: now,
      status: "Sent",
      ...editorPatch(access, now),
    }),
    Promise.all(
      linkedQueries.map((linkedQuery) =>
        patchWithE2eOwnership(ctx, "queries", linkedQuery._id, {
          contractingStatus: "Proposal sent",
          updatedAt: now,
        })
      )
    ),
    createActivity(ctx, access, {
      action: "sent_to_sales",
      entityId: proposalId,
      entityType: "proposal",
      message: `${proposal.proposalCode} sent to Sales for review (${queryCodes})`,
    }),
  ]);
  await Promise.all(
    linkedQueries.map((linkedQuery) => refreshProposalLinkProjections(ctx, linkedQuery._id))
  );
  await enqueueQueryCommercialProjections(
    ctx,
    linkedQueries.map((linkedQuery) => linkedQuery._id)
  );

  const salesOwnerNotified = new Set<string>();
  const salesOwnerNotifications: Promise<unknown>[] = [];
  for (const linkedQuery of linkedQueries) {
    if (!linkedQuery.salesOwnerId || salesOwnerNotified.has(linkedQuery.salesOwnerId)) {
      continue;
    }
    const salesStaffId = ctx.db.normalizeId("staffUsers", linkedQuery.salesOwnerId);
    if (!salesStaffId) {
      continue;
    }
    salesOwnerNotified.add(linkedQuery.salesOwnerId);
    salesOwnerNotifications.push(
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "staff", staffIds: [salesStaffId] },
        content: {
          body: `${proposal.proposalCode} for ${linkedQuery.queryCode} is ready. Review costing and use Sales Decision on the query.`,
          entityId: linkedQuery._id,
          entityType: "query",
          title: "Proposal ready for review",
        },
        emailTargets: { kind: "staff", staffIds: [salesStaffId] },
      })
    );
  }

  await Promise.all([
    ...salesOwnerNotifications,
    ...(primaryQuery
      ? [
          publishWorkflowNotification(ctx, {
            bellTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
            content: {
              body: `${proposal.proposalCode} has been submitted by Contracting. Open the linked query to review and decide.`,
              entityId: primaryQuery._id,
              entityType: "query",
              title: "Proposal ready for review",
            },
            emailTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
          }),
        ]
      : [
          publishWorkflowNotification(ctx, {
            bellTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
            content: {
              body: `${proposal.proposalCode} has been submitted by Contracting. Open Proposals or the linked query to review and decide.`,
              entityId: proposalId,
              entityType: "proposal",
              title: "Proposal ready for review",
            },
            emailTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
          }),
        ]),
  ]);
  if (receipt && args.commandId) {
    await storeCommandReceipt(ctx, {
      actorKey: receipt.actorKey,
      commandId: args.commandId,
      operation: "proposal.send_to_sales",
      payloadDigest: receipt.payloadDigest,
      resultId: String(proposalId),
      targetId: String(proposalId),
    });
  }
  return { id: proposalId };
}
