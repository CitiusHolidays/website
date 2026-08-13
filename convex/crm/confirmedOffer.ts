import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { profitPerPerson } from "./commercialRecordChain";
import { insertWithE2eOwnership } from "./lib/e2eOwnership";
import type { SalesDecisionCommand } from "./queryStatusPolicy";
import type { QuerySource } from "./queryValidators";

export interface ConfirmedOfferInput {
  approxMargin?: number;
  confirmedAt: number;
  confirmedPax: number;
  destination?: string;
  proposalId: string;
  proposalRevision: number;
  queryId: string;
  source?: QuerySource;
  sourceConsentAt?: number;
  sourceInboundIntentId?: Id<"inboundQueryIntents">;
  travelEndDate?: string;
  travelStartDate: string;
}

export function calculateConfirmedOfferProfitPerPax(input: {
  sellingPricePerPax: number;
  landCostPerPax: number;
  airfarePerPax: number;
  visaCostPerPax: number;
}) {
  return profitPerPerson({
    airfarePerPax: input.airfarePerPax,
    landCostPerPax: input.landCostPerPax,
    sellingPricePerPax: input.sellingPricePerPax,
    visaCostPerPax: input.visaCostPerPax,
  });
}

export async function loadConfirmedOfferForQuery(ctx: MutationCtx, queryId: Id<"queries">) {
  return await ctx.db
    .query("confirmedOffers")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .first();
}

export async function assertEligibleProposalForConfirmation(
  ctx: MutationCtx,
  queryId: Id<"queries">,
  proposalIdRaw: string,
  proposalRevision: number
) {
  const proposalId = ctx.db.normalizeId("proposals", proposalIdRaw);
  if (!proposalId) {
    throw new ConvexError("Select a linked proposal before confirming the order.");
  }
  const proposal = await ctx.db.get("proposals", proposalId);
  if (!proposal) {
    throw new ConvexError("Selected proposal was not found.");
  }
  const link = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId_and_queryId", (q) =>
      q.eq("proposalId", proposalId).eq("queryId", queryId)
    )
    .unique();
  if (!link) {
    throw new ConvexError("Select a proposal linked to this query.");
  }
  const currentRevision = proposal.proposalRevision ?? 1;
  if (currentRevision !== proposalRevision || link.handedOffRevision !== proposalRevision) {
    throw new ConvexError(
      "The selected Proposal revision is not the current revision handed to Sales. Refresh and try again."
    );
  }
  const handoff = await ctx.db
    .query("proposalQueryHandoffs")
    .withIndex("by_proposalId_queryId_revision", (q) =>
      q.eq("proposalId", proposalId).eq("queryId", queryId).eq("proposalRevision", proposalRevision)
    )
    .unique();
  if (!handoff) {
    throw new ConvexError("The exact Proposal revision has no immutable Sales handoff.");
  }
  return { handoff, link, proposal };
}

export async function createConfirmedOfferSnapshot(
  ctx: MutationCtx,
  access: { authUserId?: string },
  input: ConfirmedOfferInput
) {
  const queryId = ctx.db.normalizeId("queries", input.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const existing = await loadConfirmedOfferForQuery(ctx, queryId);
  if (existing) {
    throw new ConvexError("This query already has a confirmed offer snapshot.");
  }
  const { handoff, proposal } = await assertEligibleProposalForConfirmation(
    ctx,
    queryId,
    input.proposalId,
    input.proposalRevision
  );
  if (input.confirmedPax < 1) {
    throw new ConvexError("Passenger count must be greater than zero.");
  }
  if (!input.travelStartDate.trim()) {
    throw new ConvexError("Travel start date is required.");
  }
  if (handoff.sellingPrice <= 0) {
    throw new ConvexError("Selling Price per Person must be greater than zero.");
  }
  if (
    [handoff.landCostPerPax, handoff.airfarePerPax, handoff.visaCostPerPax].some(
      (value) => value < 0
    )
  ) {
    throw new ConvexError("Per-person costs cannot be negative.");
  }

  const profitPerPax = calculateConfirmedOfferProfitPerPax({
    airfarePerPax: handoff.airfarePerPax,
    landCostPerPax: handoff.landCostPerPax,
    sellingPricePerPax: handoff.sellingPrice,
    visaCostPerPax: handoff.visaCostPerPax,
  });
  const offerId = await insertWithE2eOwnership(ctx, "confirmedOffers", {
    airfarePerPax: Math.max(handoff.airfarePerPax, 0),
    approxMargin: input.approxMargin === undefined ? undefined : Math.max(input.approxMargin, 0),
    confirmedAt: input.confirmedAt,
    confirmedPax: input.confirmedPax,
    createdAt: input.confirmedAt,
    createdBy: access.authUserId ?? "unknown",
    destination: input.destination?.trim() || "",
    landCostPerPax: Math.max(handoff.landCostPerPax, 0),
    profitPerPax,
    proposalId: proposal._id,
    proposalQueryHandoffId: handoff._id,
    proposalRevision: handoff.proposalRevision,
    queryId,
    sellingPricePerPax: Math.max(handoff.sellingPrice, 0),
    source: input.source,
    sourceConsentAt: input.sourceConsentAt,
    sourceInboundIntentId: input.sourceInboundIntentId,
    taxRate: handoff.taxRate ?? 0,
    travelEndDate: input.travelEndDate || "",
    travelStartDate: input.travelStartDate,
    updatedAt: input.confirmedAt,
    visaCostPerPax: Math.max(handoff.visaCostPerPax, 0),
  });

  return { offerId, profitPerPax, proposal };
}

export async function snapshotNewlyConfirmedOffer(
  ctx: MutationCtx,
  access: { authUserId?: string },
  current: {
    contractingStatus: string;
    destination?: string;
    paxCount: number;
    salesStatus: string;
    source?: QuerySource;
    sourceConsentAt?: number;
    inboundIntentId?: Id<"inboundQueryIntents">;
    travelEndDate?: string;
    travelStartDate?: string;
  },
  args: SalesDecisionCommand,
  confirmedAt: number
): Promise<Id<"confirmedOffers"> | undefined> {
  const wasConfirmed =
    current.salesStatus === "Order Confirmed" || current.contractingStatus === "Order Confirmed";
  const isNewlyConfirmed = !wasConfirmed && args.salesStatus === "Order Confirmed";
  if (!isNewlyConfirmed) {
    return;
  }
  if (!args.proposalId?.trim()) {
    throw new ConvexError("Select the accepted proposal before confirming the order.");
  }
  if (!(Number.isSafeInteger(args.proposalRevision) && Number(args.proposalRevision) > 0)) {
    throw new ConvexError("Select the exact handed-off proposal revision before confirming.");
  }
  const { offerId } = await createConfirmedOfferSnapshot(ctx, access, {
    approxMargin: args.approxMargin,
    confirmedAt,
    confirmedPax: args.confirmedPax ?? current.paxCount,
    destination: args.destination ?? current.destination,
    proposalId: args.proposalId,
    proposalRevision: Number(args.proposalRevision),
    queryId: args.queryId,
    source: current.source,
    sourceConsentAt: current.sourceConsentAt,
    sourceInboundIntentId: current.inboundIntentId,
    travelEndDate: args.travelEndDate ?? current.travelEndDate,
    travelStartDate: args.travelStartDate ?? current.travelStartDate ?? "",
  });
  return offerId;
}
