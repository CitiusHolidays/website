import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveCommandReceipt, storeCommandReceipt } from "./commandReceipts";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import type { PortalAccess } from "./lib";
import {
  canEditProposalRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  createActivity,
  editorPatch,
  PERMISSIONS,
  publishWorkflowNotification,
  requireAnyPermission,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import type { BellNotificationTargets } from "./lib/notifications";
import { linkedQueriesForProposal } from "./proposalRelations";
import { enqueueQueryCommercialProjections } from "./queryCommercialProjection";

export const PROPOSAL_HANDOFF_OPERATION = "proposal.query_handoff.v2";

export interface ProposalHandoffArgs {
  commandId: string;
  proposalId: string;
  proposalRevision: number;
  queryId: string;
}

interface FreshProposalHandoff {
  currentRevision: number;
  link: Doc<"proposalQueryLinks">;
  proposal: Doc<"proposals">;
  query: Doc<"queries">;
}

interface ProposalHandoffOptions {
  beforeFreshHandoff?: (input: FreshProposalHandoff) => Promise<void>;
}

interface NormalizedHandoffTarget {
  proposalId: Id<"proposals">;
  proposalRevision: number;
  queryId: Id<"queries">;
}

function assertProposalPricingComplete(proposal: { costPrice?: number; sellingPrice?: number }) {
  if (!((proposal.sellingPrice ?? 0) > 0 && (proposal.costPrice ?? 0) > 0)) {
    throw new ConvexError(
      "Enter selling price and cost price on the proposal before sending it to Sales."
    );
  }
}

function handoffTargetId(
  proposalId: Id<"proposals">,
  queryId: Id<"queries">,
  proposalRevision: number
) {
  return `${proposalId}:${queryId}:${proposalRevision}`;
}

function normalizeHandoffTarget(
  ctx: MutationCtx,
  args: ProposalHandoffArgs
): NormalizedHandoffTarget {
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  if (!(Number.isSafeInteger(args.proposalRevision) && args.proposalRevision > 0)) {
    throw new ConvexError("Proposal revision must be a positive integer");
  }
  return { proposalId, proposalRevision: args.proposalRevision, queryId };
}

async function loadAuthorizedHandoff(
  ctx: MutationCtx,
  access: PortalAccess,
  target: NormalizedHandoffTarget
) {
  const [proposal, query, link] = await Promise.all([
    ctx.db.get("proposals", target.proposalId),
    ctx.db.get("queries", target.queryId),
    ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId_and_queryId", (builder) =>
        builder.eq("proposalId", target.proposalId).eq("queryId", target.queryId)
      )
      .unique(),
  ]);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  if (!(query && link)) {
    throw new ConvexError("The selected Query is not linked to this Proposal");
  }
  const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
  if (
    !(canSeeProposalRecord(access, proposal, linkedQueries) && canSeeQueryRecord(access, query))
  ) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!canEditProposalRecord(access, proposal, linkedQueries)) {
    throw new ConvexError(
      "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can send this proposal to Sales"
    );
  }
  return { link, proposal, query };
}

async function assertValidStoredHandoff(
  ctx: MutationCtx,
  resultId: string,
  target: NormalizedHandoffTarget
) {
  const handoffId = ctx.db.normalizeId("proposalQueryHandoffs", resultId);
  const handoff = handoffId ? await ctx.db.get("proposalQueryHandoffs", handoffId) : null;
  if (
    !handoff ||
    handoff.proposalId !== target.proposalId ||
    handoff.queryId !== target.queryId ||
    handoff.proposalRevision !== target.proposalRevision
  ) {
    throw new ConvexError("Stored command result is no longer valid");
  }
}

async function assertFreshHandoff(
  ctx: MutationCtx,
  target: NormalizedHandoffTarget,
  handoff: FreshProposalHandoff
) {
  if (target.proposalRevision !== handoff.currentRevision) {
    throw new ConvexError("Proposal revision is out of date. Refresh and try again.");
  }
  if (["Accepted", "Rejected"].includes(handoff.proposal.status)) {
    throw new ConvexError("This Proposal can no longer be handed to Sales");
  }
  assertProposalPricingComplete(handoff.proposal);
  const existingHandoff = await ctx.db
    .query("proposalQueryHandoffs")
    .withIndex("by_proposalId_queryId_revision", (builder) =>
      builder
        .eq("proposalId", target.proposalId)
        .eq("queryId", target.queryId)
        .eq("proposalRevision", handoff.currentRevision)
    )
    .unique();
  if (existingHandoff) {
    throw new ConvexError(
      "This Proposal revision was already handed to Sales for the selected Query"
    );
  }
}

async function publishProposalHandoffNotification(
  ctx: MutationCtx,
  proposal: Doc<"proposals">,
  query: Doc<"queries">
) {
  const salesStaffId = query.salesOwnerId
    ? ctx.db.normalizeId("staffUsers", query.salesOwnerId)
    : null;
  const targets: BellNotificationTargets = salesStaffId
    ? { kind: "staff", staffIds: [salesStaffId] }
    : { kind: "roles", roles: ["Sales", "Sales Head"] };
  await publishWorkflowNotification(ctx, {
    bellTargets: targets,
    content: {
      body: salesStaffId
        ? `${proposal.proposalCode} for ${query.queryCode} is ready. Review costing and use Sales Decision on the query.`
        : `${proposal.proposalCode} has been submitted by Contracting. Open the linked query to review and decide.`,
      entityId: query._id,
      entityType: "query",
      title: "Proposal ready for review",
    },
    emailTargets: targets,
  });
}

export async function handleSendProposalToSales(
  ctx: MutationCtx,
  args: ProposalHandoffArgs,
  options: ProposalHandoffOptions = {}
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_PROPOSALS,
    PERMISSIONS.MANAGE_CONTRACTING,
  ]);
  const target = normalizeHandoffTarget(ctx, args);
  const { link, proposal, query } = await loadAuthorizedHandoff(ctx, access, target);
  const targetId = handoffTargetId(target.proposalId, target.queryId, target.proposalRevision);
  const receipt = await resolveCommandReceipt(ctx, {
    access,
    commandId: args.commandId,
    operation: PROPOSAL_HANDOFF_OPERATION,
    payload: {
      proposalId: String(target.proposalId),
      proposalRevision: target.proposalRevision,
      queryId: String(target.queryId),
    },
    targetId,
  });
  if (receipt.replayedResultId) {
    await assertValidStoredHandoff(ctx, receipt.replayedResultId, target);
    return { id: target.proposalId };
  }

  const currentRevision = proposal.proposalRevision ?? 1;
  const freshHandoff = { currentRevision, link, proposal, query };
  await options.beforeFreshHandoff?.(freshHandoff);
  await assertFreshHandoff(ctx, target, freshHandoff);

  const now = Date.now();
  const handoffId = await insertWithE2eOwnership(ctx, "proposalQueryHandoffs", {
    airfarePerPax: proposal.airfarePerPax ?? 0,
    clientName: proposal.clientName,
    commandId: args.commandId,
    costPrice: proposal.costPrice ?? 0,
    handedOffAt: now,
    handedOffBy: access.authUserId ?? access.email ?? "unknown",
    itinerarySummary: proposal.itinerarySummary ?? "",
    landCostPerPax: proposal.landCostPerPax ?? 0,
    proposalCode: proposal.proposalCode,
    proposalId: target.proposalId,
    proposalRevision: currentRevision,
    queryId: target.queryId,
    sellingPrice: proposal.sellingPrice ?? 0,
    taxRate: proposal.taxRate,
    visaCostPerPax: proposal.visaCostPerPax ?? 0,
  });
  await Promise.all([
    patchWithE2eOwnership(ctx, "proposalQueryLinks", link._id, {
      handedOffAt: now,
      handedOffRevision: currentRevision,
      revisionRequestedAt: undefined,
    }),
    patchWithE2eOwnership(ctx, "proposals", target.proposalId, {
      sentToSalesAt: now,
      status: "Sent",
      ...editorPatch(access, now),
    }),
    patchWithE2eOwnership(ctx, "queries", target.queryId, {
      contractingStatus: "Proposal sent",
      updatedAt: now,
    }),
    createActivity(ctx, access, {
      action: "sent_to_sales",
      entityId: target.proposalId,
      entityType: "proposal",
      message: `${proposal.proposalCode} revision ${currentRevision} sent to Sales for ${query.queryCode}`,
    }),
  ]);
  await Promise.all([
    scheduleCrmMetricSync(ctx, "proposals", String(target.proposalId)),
    scheduleCrmMetricSync(ctx, "queries", String(target.queryId)),
  ]);

  await publishProposalHandoffNotification(ctx, proposal, query);
  await enqueueQueryCommercialProjections(ctx, [target.queryId]);
  await storeCommandReceipt(ctx, {
    actorKey: receipt.actorKey,
    commandId: args.commandId,
    operation: PROPOSAL_HANDOFF_OPERATION,
    payloadDigest: receipt.payloadDigest,
    resultId: String(handoffId),
    targetId,
  });
  return { id: target.proposalId };
}
