import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { profitPerPerson } from "./commercialRecordChain";
import type { QueryStatusArgs } from "./queryValidators";

export interface ConfirmedOfferInput {
  airfarePerPax: number;
  approxMargin?: number;
  confirmedPax: number;
  destination?: string;
  landCostPerPax: number;
  proposalId: string;
  queryId: string;
  sellingPricePerPax: number;
  travelEndDate?: string;
  travelStartDate: string;
  visaCostPerPax: number;
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
  proposalIdRaw: string
) {
  const proposalId = ctx.db.normalizeId("proposals", proposalIdRaw);
  if (!proposalId) {
    throw new ConvexError("Select a linked proposal before confirming the order.");
  }
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) {
    throw new ConvexError("Selected proposal was not found.");
  }
  const directLink = proposal.queryId === queryId;
  const linked = directLink
    ? true
    : Boolean(
        await ctx.db
          .query("proposalQueryLinks")
          .withIndex("by_proposalId_and_queryId", (q) =>
            q.eq("proposalId", proposalId).eq("queryId", queryId)
          )
          .first()
      );
  if (!linked) {
    throw new ConvexError("Select a proposal linked to this query.");
  }
  if (!["Accepted", "Sent"].includes(proposal.status)) {
    throw new ConvexError("The selected proposal must be sent to Sales before confirmation.");
  }
  return proposal;
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
  const proposal = await assertEligibleProposalForConfirmation(ctx, queryId, input.proposalId);
  if (input.confirmedPax < 1) {
    throw new ConvexError("Passenger count must be greater than zero.");
  }
  if (!input.travelStartDate.trim()) {
    throw new ConvexError("Travel start date is required.");
  }
  if (input.sellingPricePerPax <= 0) {
    throw new ConvexError("Selling Price per Person must be greater than zero.");
  }
  if (
    [input.landCostPerPax, input.airfarePerPax, input.visaCostPerPax].some((value) => value < 0)
  ) {
    throw new ConvexError("Per-person costs cannot be negative.");
  }

  const now = Date.now();
  const profitPerPax = calculateConfirmedOfferProfitPerPax(input);
  const offerId = await ctx.db.insert("confirmedOffers", {
    airfarePerPax: Math.max(input.airfarePerPax, 0),
    approxMargin: input.approxMargin === undefined ? undefined : Math.max(input.approxMargin, 0),
    confirmedPax: input.confirmedPax,
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    destination: input.destination?.trim() || "",
    landCostPerPax: Math.max(input.landCostPerPax, 0),
    profitPerPax,
    proposalId: proposal._id,
    queryId,
    sellingPricePerPax: Math.max(input.sellingPricePerPax, 0),
    taxRate: proposal.taxRate ?? 0,
    travelEndDate: input.travelEndDate || "",
    travelStartDate: input.travelStartDate,
    updatedAt: now,
    visaCostPerPax: Math.max(input.visaCostPerPax, 0),
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
    travelEndDate?: string;
    travelStartDate?: string;
  },
  args: QueryStatusArgs
): Promise<Id<"confirmedOffers"> | undefined> {
  const wasConfirmed =
    current.salesStatus === "Order Confirmed" || current.contractingStatus === "Order Confirmed";
  const isNewlyConfirmed =
    !wasConfirmed &&
    (args.salesStatus === "Order Confirmed" || args.contractingStatus === "Order Confirmed");
  if (!isNewlyConfirmed) {
    return;
  }
  if (!args.proposalId?.trim()) {
    throw new ConvexError("Select the accepted proposal before confirming the order.");
  }
  const { offerId } = await createConfirmedOfferSnapshot(ctx, access, {
    airfarePerPax: args.airfarePerPax ?? 0,
    approxMargin: args.approxMargin,
    confirmedPax: args.confirmedPax ?? current.paxCount,
    destination: args.destination ?? current.destination,
    landCostPerPax: args.landCostPerPax ?? 0,
    proposalId: args.proposalId,
    queryId: args.queryId,
    sellingPricePerPax: args.sellingPricePerPax ?? 0,
    travelEndDate: args.travelEndDate ?? current.travelEndDate,
    travelStartDate: args.travelStartDate ?? current.travelStartDate ?? "",
    visaCostPerPax: args.visaCostPerPax ?? 0,
  });
  return offerId;
}
