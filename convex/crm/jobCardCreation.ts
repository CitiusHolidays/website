import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { loadConfirmedOfferForQuery } from "./confirmedOffer";
import { materializeDefaultChecklistTasks } from "./jobCardChecklist";
import { DEFAULT_CHECKLIST } from "./jobCardConstants";
import {
  canCreateJobCardFromConfirmedQuery,
  notifyFinanceHeadsOnJobCardCreation,
  queryRequiresTicketingWork,
} from "./jobCardNotifications";
import {
  assertDateRangeOrder,
  canSeeQueryRecord,
  createActivity,
  creatorInitials,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  paymentTermsFor,
  requireStaff,
} from "./lib";
import { buildJobCardListSearchText } from "./listSearch";

export async function handleCreateFromQuery(
  ctx: MutationCtx,
  args: {
    clientName?: string;
    confirmedPax: number;
    destination?: string;
    proposalId?: string;
    queryId?: string;
    roomCount?: number;
    tourManagerName?: string;
    travelEndDate?: string;
    travelStartDate?: string;
  }
) {
  if (args.confirmedPax < 1) {
    throw new ConvexError("Confirmed pax must be greater than zero");
  }
  assertDateRangeOrder(
    args.travelStartDate,
    args.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  if (!args.queryId) {
    throw new ConvexError("Select a confirmed query before opening a Job Card");
  }
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  const [access, linkedQuery] = await Promise.all([
    requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS),
    queryId ? ctx.db.get(queryId) : null,
  ]);
  if (!(queryId && linkedQuery)) {
    throw new ConvexError("Linked query not found");
  }
  if (!canSeeQueryRecord(access, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const staff = access.staffId ? await ctx.db.get(access.staffId) : null;
  if (!canCreateJobCardFromConfirmedQuery(access, staff)) {
    throw new ConvexError("Only Accounts can create Job Cards after order confirmation");
  }
  if (
    linkedQuery &&
    linkedQuery.salesStatus !== "Order Confirmed" &&
    linkedQuery.contractingStatus !== "Order Confirmed"
  ) {
    throw new ConvexError("Accounts can open a Job Card only after order confirmation");
  }
  const confirmedOffer =
    (linkedQuery?.confirmedOfferId ? await ctx.db.get(linkedQuery.confirmedOfferId) : null) ??
    (await loadConfirmedOfferForQuery(ctx, queryId));
  if (!confirmedOffer) {
    throw new ConvexError("A Confirmed Offer is required before opening a Job Card");
  }
  const existing = await ctx.db
    .query("jobCards")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .first();
  if (existing) {
    throw new ConvexError("This query already has a linked Job Card");
  }

  let proposalId = confirmedOffer.proposalId;
  if (args.proposalId) {
    const requestedProposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!requestedProposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    proposalId = requestedProposalId;
  }
  const proposal = proposalId ? await ctx.db.get(proposalId) : null;
  if (!proposal || proposal._id !== confirmedOffer.proposalId) {
    throw new ConvexError("Open the Job Card from the query's Confirmed Offer proposal");
  }

  const salesRepStaff = linkedQuery.salesOwnerId
    ? await ctx.db
        .query("staffUsers")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", linkedQuery.salesOwnerId))
        .unique()
    : null;
  const jobCodeSuffixName =
    salesRepStaff?.name?.trim() || linkedQuery.salesOwnerName || access.name;
  const now = Date.now();
  const jobCode = await nextCode(ctx, "jobCards", "JC", {
    suffix: creatorInitials(jobCodeSuffixName),
  });
  const queryType = linkedQuery.queryType;
  const jobCardPayload = {
    airfarePerPax: confirmedOffer.airfarePerPax,
    approxMargin: confirmedOffer.approxMargin,
    clientName: linkedQuery.clientName || args.clientName?.trim() || "",
    collaboratorStaffIds: [] as Id<"staffUsers">[],
    confirmedOfferId: confirmedOffer._id,
    confirmedPax: args.confirmedPax || confirmedOffer.confirmedPax,
    contractingOwnerId: linkedQuery.contractingOwnerId,
    contractingOwnerName: linkedQuery.contractingOwnerName ?? "",
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    destination:
      linkedQuery.destination || confirmedOffer.destination || args.destination?.trim() || "",
    jobCode,
    landCostPerPax: confirmedOffer.landCostPerPax,
    lastEditedAt: now,
    lastEditedBy: access.authUserId ?? access.email ?? "unknown",
    lastEditedByName: access.name,
    listSearchText: buildJobCardListSearchText({
      clientName: linkedQuery.clientName || args.clientName?.trim() || "",
      destination: linkedQuery.destination || args.destination?.trim() || "",
      jobCode,
      queryType,
    }),
    paymentTerms: queryType ? paymentTermsFor(queryType) : null,
    preDepartureChecklist: DEFAULT_CHECKLIST,
    profitPerPax: confirmedOffer.profitPerPax,
    proposalId,
    queryId,
    queryType: queryType as any,
    roomCount: args.roomCount ?? 0,
    sellingPricePerPax: confirmedOffer.sellingPricePerPax,
    status: "Open" as const,
    ticketingOwnerId: linkedQuery.ticketingOwnerId,
    ticketingOwnerName: linkedQuery.ticketingOwnerName ?? "",
    ticketingRequired: queryRequiresTicketingWork(linkedQuery),
    ticketingScope: linkedQuery.ticketingScope ?? "",
    tourManagerName: args.tourManagerName?.trim() || "",
    travelBatchCount: 0,
    travelEndDate:
      args.travelEndDate || confirmedOffer.travelEndDate || linkedQuery.travelEndDate || "",
    travelStartDate:
      args.travelStartDate || confirmedOffer.travelStartDate || linkedQuery.travelStartDate || "",
    updatedAt: now,
    visaCostPerPax: confirmedOffer.visaCostPerPax,
  };
  const id = await ctx.db.insert("jobCards", jobCardPayload);
  await materializeDefaultChecklistTasks(
    ctx,
    id,
    DEFAULT_CHECKLIST,
    access.authUserId ?? "unknown",
    now
  );

  const ownerNotifications = [];
  const contractingStaffId = linkedQuery?.contractingOwnerId
    ? ctx.db.normalizeId("staffUsers", linkedQuery.contractingOwnerId)
    : null;
  if (contractingStaffId) {
    ownerNotifications.push(
      notifyStaffMember(ctx, contractingStaffId, {
        body: `${jobCode} is ready. Continue contracting and coordinate operations deliverables.`,
        entityId: id,
        entityType: "jobCard",
        title: "Job Card opened on your query",
      })
    );
  }
  const ticketingStaffId = linkedQuery?.ticketingOwnerId
    ? ctx.db.normalizeId("staffUsers", linkedQuery.ticketingOwnerId)
    : null;
  const needsTicketingWork = queryRequiresTicketingWork(linkedQuery);
  if (ticketingStaffId && needsTicketingWork) {
    ownerNotifications.push(
      notifyStaffMember(ctx, ticketingStaffId, {
        body: `${jobCode} is ready. Begin ticketing for this departure.`,
        entityId: id,
        entityType: "jobCard",
        title: "Job Card opened on your query",
      })
    );
  }
  const downstreamRoles = [
    "Contracting",
    "Contracting Head",
    "Operations",
    "Operations Head",
    ...(needsTicketingWork ? ["Ticketing", "Head of Ticketing"] : []),
  ];
  const downstreamEmailRoles = [
    ...(contractingStaffId ? [] : ["Contracting"]),
    "Operations Head",
    ...(needsTicketingWork && !ticketingStaffId ? ["Ticketing"] : []),
  ];

  await Promise.all([
    createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "jobCard",
      message: `${jobCode} opened for ${linkedQuery?.clientName || args.clientName || "client"}`,
      metadata: {
        confirmedOfferId: confirmedOffer._id,
        confirmedOfferPax: confirmedOffer.confirmedPax,
        confirmedOfferTravelEndDate: confirmedOffer.travelEndDate ?? "",
        confirmedOfferTravelStartDate: confirmedOffer.travelStartDate,
        jobCardPax: args.confirmedPax || confirmedOffer.confirmedPax,
        jobCardTravelEndDate:
          args.travelEndDate || confirmedOffer.travelEndDate || linkedQuery.travelEndDate || "",
        jobCardTravelStartDate:
          args.travelStartDate ||
          confirmedOffer.travelStartDate ||
          linkedQuery.travelStartDate ||
          "",
      },
    }),
    notifyRoles(
      ctx,
      downstreamRoles,
      {
        body: `${jobCode} is live for ${linkedQuery.queryCode} (${linkedQuery.clientName}, ${linkedQuery.destination || confirmedOffer.destination || "destination TBD"}, ${args.confirmedPax || confirmedOffer.confirmedPax} pax, ${args.travelStartDate || confirmedOffer.travelStartDate || linkedQuery.travelStartDate || "dates TBD"}${linkedQuery.ticketingScope ? `, Ticketing Scope ${linkedQuery.ticketingScope}` : ""}, Contracting ${linkedQuery.contractingOwnerName || "unassigned"}, Ticketing ${linkedQuery.ticketingOwnerName || "unassigned"}). Begin traveller master, tickets, passport, visa, and tour manager work.`,
        entityId: id,
        entityType: "jobCard",
        title: "Job Card opened — start operations",
      },
      { emailRoles: downstreamEmailRoles }
    ),
    ...ownerNotifications,
    notifyRoles(ctx, ["Sales", "Sales Head"], {
      body: `${jobCode} has been created and is ready for operations.`,
      entityId: id,
      entityType: "jobCard",
      title: "Job Card opened",
    }),
    notifyFinanceHeadsOnJobCardCreation(ctx, jobCode, id),
  ]);

  return { id, jobCode };
}
