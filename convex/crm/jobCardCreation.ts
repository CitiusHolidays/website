import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
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
  const existing = await ctx.db
    .query("jobCards")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .first();
  if (existing) {
    throw new ConvexError("This query already has a linked Job Card");
  }

  let proposalId = args.proposalId ? ctx.db.normalizeId("proposals", args.proposalId) : null;
  if (args.proposalId && !proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  const [legacyProposalRows, proposalLinks] = await Promise.all([
    ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
    ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect(),
  ]);
  const proposalRowsById = new Map(legacyProposalRows.map((proposal) => [proposal._id, proposal]));
  const missingLinkProposalIds = proposalLinks.flatMap((link) =>
    proposalRowsById.has(link.proposalId) ? [] : [link.proposalId]
  );
  const missingLinkProposals = await Promise.all(
    missingLinkProposalIds.map((proposalId) => ctx.db.get(proposalId))
  );
  for (const linkedProposal of missingLinkProposals) {
    if (linkedProposal) {
      proposalRowsById.set(linkedProposal._id, linkedProposal);
    }
  }
  const proposalRows = Array.from(proposalRowsById.values());
  if (!proposalId) {
    const sortedProposals = proposalRows.sort((a, b) => b.updatedAt - a.updatedAt);
    proposalId =
      sortedProposals.find((proposal) => ["Accepted", "Sent"].includes(proposal.status))?._id ??
      sortedProposals[0]?._id ??
      null;
  }
  const proposal = proposalId ? await ctx.db.get(proposalId) : null;
  const selectedProposalLink =
    proposalId &&
    (await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId_and_queryId", (q) =>
        q.eq("proposalId", proposalId).eq("queryId", queryId)
      )
      .first());
  if (!proposal || (proposal.queryId !== queryId && !selectedProposalLink)) {
    throw new ConvexError("Link a proposal for this confirmed query before opening a Job Card");
  }
  if (!["Accepted", "Sent"].includes(proposal.status)) {
    throw new ConvexError("The linked proposal must be sent or accepted before opening a Job Card");
  }
  if ((proposal.sellingPrice ?? 0) <= 0 || (proposal.costPrice ?? 0) <= 0) {
    throw new ConvexError(
      "Enter selling price and cost price on the proposal before opening a Job Card"
    );
  }

  const now = Date.now();
  const jobCode = await nextCode(ctx, "jobCards", "JC", {
    suffix: creatorInitials(access.name),
  });
  const queryType = linkedQuery?.queryType;
  const jobCardPayload = {
    clientName: linkedQuery.clientName || args.clientName?.trim() || "",
    collaboratorStaffIds: [] as Id<"staffUsers">[],
    confirmedPax: args.confirmedPax,
    contractingOwnerId: linkedQuery?.contractingOwnerId,
    contractingOwnerName: linkedQuery?.contractingOwnerName ?? "",
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    destination: linkedQuery.destination || args.destination?.trim() || "",
    jobCode,
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
    proposalId,
    queryId,
    queryType: queryType as any,
    roomCount: args.roomCount ?? 0,
    status: "Open" as const,
    ticketingOwnerId: linkedQuery?.ticketingOwnerId,
    ticketingOwnerName: linkedQuery?.ticketingOwnerName ?? "",
    ticketingRequired: queryRequiresTicketingWork(linkedQuery),
    ticketingScope: linkedQuery?.ticketingScope ?? "",
    tourManagerName: args.tourManagerName?.trim() || "",
    travelBatchCount: 0,
    travelEndDate: linkedQuery?.travelEndDate || args.travelEndDate || "",
    travelStartDate: linkedQuery?.travelStartDate || args.travelStartDate || "",
    updatedAt: now,
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
    "Operations",
    ...(needsTicketingWork && !ticketingStaffId ? ["Ticketing"] : []),
  ];

  await Promise.all([
    createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "jobCard",
      message: `${jobCode} opened for ${linkedQuery?.clientName || args.clientName || "client"}`,
    }),
    notifyRoles(
      ctx,
      downstreamRoles,
      {
        body: `${jobCode} is live for ${linkedQuery?.queryCode || "the confirmed query"}. Begin traveller master, tickets, passport, visa, and tour manager work.`,
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
