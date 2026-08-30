import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveCommandReceipt, storeCommandReceipt } from "./commandReceipts";
import { scheduleCrmMetricSync } from "./financeMetricSync";
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
  PERMISSIONS,
  paymentTermsFor,
  publishWorkflowNotification,
  requireStaff,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { buildJobCardListSearchText, markListSearchDirty } from "./listSearch";

interface CreateJobCardArgs {
  clientName?: string;
  commandId: string;
  confirmedOfferId: string;
  confirmedPax: number;
  destination?: string;
  proposalId: string;
  proposalQueryHandoffId: string;
  proposalRevision: number;
  queryId: string;
  roomCount?: number;
  tourManagerName?: string;
  travelEndDate?: string;
  travelStartDate?: string;
}

async function loadExactConfirmedOfferAuthority(
  ctx: MutationCtx,
  args: CreateJobCardArgs,
  linkedQuery: Doc<"queries">,
  queryId: Id<"queries">
) {
  const confirmedOfferId = ctx.db.normalizeId("confirmedOffers", args.confirmedOfferId);
  if (!confirmedOfferId) {
    throw new ConvexError("Select the Query's exact Confirmed Offer");
  }
  const confirmedOffer = await ctx.db.get("confirmedOffers", confirmedOfferId);
  if (!confirmedOffer) {
    throw new ConvexError("A Confirmed Offer is required before opening a Job Card");
  }
  if (
    confirmedOffer._id !== confirmedOfferId ||
    linkedQuery.confirmedOfferId !== confirmedOfferId ||
    confirmedOffer.queryId !== queryId
  ) {
    throw new ConvexError("Open the Job Card from the Query's exact Confirmed Offer");
  }
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  if (!proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  const proposal = await ctx.db.get("proposals", proposalId);
  if (!proposal || proposal._id !== confirmedOffer.proposalId) {
    throw new ConvexError("Open the Job Card from the query's Confirmed Offer proposal");
  }
  const proposalQueryHandoffId = ctx.db.normalizeId(
    "proposalQueryHandoffs",
    args.proposalQueryHandoffId
  );
  if (
    !proposalQueryHandoffId ||
    confirmedOffer.proposalQueryHandoffId !== proposalQueryHandoffId ||
    confirmedOffer.proposalRevision !== args.proposalRevision
  ) {
    throw new ConvexError("Open the Job Card from the Confirmed Offer's exact Proposal revision");
  }
  const handoff = await ctx.db.get("proposalQueryHandoffs", proposalQueryHandoffId);
  if (
    !handoff ||
    handoff.proposalId !== proposalId ||
    handoff.queryId !== queryId ||
    handoff.proposalRevision !== args.proposalRevision
  ) {
    throw new ConvexError("The Confirmed Offer's immutable Proposal handoff is unavailable");
  }
  return {
    confirmedOffer,
    proposalId,
    proposalQueryHandoffId,
    proposalRevision: args.proposalRevision,
  };
}

function firstTruthy<Value>(...values: Array<Value | null | undefined | "">): Value | "" {
  return values.find(Boolean) ?? "";
}

async function loadJobCardCreationContext(ctx: MutationCtx, args: CreateJobCardArgs) {
  if (args.confirmedPax < 1) {
    throw new ConvexError("Confirmed pax must be greater than zero");
  }
  assertDateRangeOrder(
    args.travelStartDate,
    args.travelEndDate,
    "Travel start date",
    "Travel end date"
  );
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  const [access, linkedQuery] = await Promise.all([
    requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS),
    queryId ? ctx.db.get("queries", queryId) : null,
  ]);
  if (!(queryId && linkedQuery)) {
    throw new ConvexError("Linked query not found");
  }
  if (!canSeeQueryRecord(access, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const staff = access.staffId ? await ctx.db.get("staffUsers", access.staffId) : null;
  if (!canCreateJobCardFromConfirmedQuery(access, staff)) {
    throw new ConvexError("Only Accounts can create Job Cards after order confirmation");
  }
  if (!access.staffId) {
    throw new ConvexError("A stable Staff identity is required to open a Job Card");
  }
  if (
    linkedQuery.salesStatus !== "Order Confirmed" &&
    linkedQuery.contractingStatus !== "Order Confirmed"
  ) {
    throw new ConvexError("Accounts can open a Job Card only after order confirmation");
  }
  const exactAuthority = await loadExactConfirmedOfferAuthority(ctx, args, linkedQuery, queryId);
  const existing = await ctx.db
    .query("jobCards")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .first();
  return {
    access,
    ...exactAuthority,
    existing,
    linkedQuery,
    queryId,
  };
}

function ownerNotificationsForJobCard(
  ctx: MutationCtx,
  linkedQuery: Doc<"queries">,
  id: Id<"jobCards">,
  jobCode: string
) {
  const notifications: ReturnType<typeof publishWorkflowNotification>[] = [];
  const contractingStaffId = linkedQuery.contractingOwnerId
    ? ctx.db.normalizeId("staffUsers", linkedQuery.contractingOwnerId)
    : null;
  if (contractingStaffId) {
    notifications.push(
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "staff", staffIds: [contractingStaffId] },
        content: {
          body: `${jobCode} is ready. Continue contracting and coordinate operations deliverables.`,
          entityId: id,
          entityType: "jobCard",
          title: "Job Card opened on your query",
        },
        emailTargets: { kind: "staff", staffIds: [contractingStaffId] },
      })
    );
  }
  const ticketingStaffId = linkedQuery.ticketingOwnerId
    ? ctx.db.normalizeId("staffUsers", linkedQuery.ticketingOwnerId)
    : null;
  const needsTicketingWork = queryRequiresTicketingWork(linkedQuery);
  if (ticketingStaffId && needsTicketingWork) {
    notifications.push(
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "staff", staffIds: [ticketingStaffId] },
        content: {
          body: `${jobCode} is ready. Begin ticketing for this departure.`,
          entityId: id,
          entityType: "jobCard",
          title: "Job Card opened on your query",
        },
        emailTargets: { kind: "staff", staffIds: [ticketingStaffId] },
      })
    );
  }
  return { contractingStaffId, needsTicketingWork, notifications, ticketingStaffId };
}

function buildJobCardPayload({
  access,
  args,
  confirmedOffer,
  jobCode,
  linkedQuery,
  now,
  proposalId,
  proposalQueryHandoffId,
  proposalRevision,
  queryId,
}: {
  access: Awaited<ReturnType<typeof requireStaff>>;
  args: CreateJobCardArgs;
  confirmedOffer: Doc<"confirmedOffers">;
  jobCode: string;
  linkedQuery: Doc<"queries">;
  now: number;
  proposalId: Id<"proposals">;
  proposalQueryHandoffId: Id<"proposalQueryHandoffs">;
  proposalRevision: number;
  queryId: Id<"queries">;
}) {
  const { queryType } = linkedQuery;
  const clientName = firstTruthy(linkedQuery.clientName, args.clientName?.trim());
  const destination = firstTruthy(
    linkedQuery.destination,
    confirmedOffer.destination,
    args.destination?.trim()
  );
  return {
    airfarePerPax: confirmedOffer.airfarePerPax,
    approxMargin: confirmedOffer.approxMargin,
    clientName,
    collaboratorStaffIds: [],
    confirmedOfferId: confirmedOffer._id,
    confirmedPax: args.confirmedPax,
    contractingOwnerId: linkedQuery.contractingOwnerId,
    contractingOwnerName: linkedQuery.contractingOwnerName ?? "",
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    destination,
    jobCode,
    landCostPerPax: confirmedOffer.landCostPerPax,
    lastEditedAt: now,
    lastEditedBy: access.authUserId ?? access.email ?? "unknown",
    lastEditedByName: access.name,
    listSearchText: buildJobCardListSearchText({
      clientName,
      destination: firstTruthy(linkedQuery.destination, args.destination?.trim()),
      jobCode,
      queryType,
    }),
    paymentTerms: queryType ? paymentTermsFor(queryType) : null,
    preDepartureChecklist: DEFAULT_CHECKLIST,
    profitPerPax: confirmedOffer.profitPerPax,
    proposalId,
    proposalQueryHandoffId,
    proposalRevision,
    queryId,
    queryType,
    roomCount: args.roomCount ?? 0,
    sellingPricePerPax: confirmedOffer.sellingPricePerPax,
    status: "Open" as const,
    ticketingOwnerId: linkedQuery.ticketingOwnerId,
    ticketingOwnerName: linkedQuery.ticketingOwnerName ?? "",
    ticketingRequired: queryRequiresTicketingWork(linkedQuery),
    ticketingScope: linkedQuery.ticketingScope ?? "",
    tourManagerName: args.tourManagerName?.trim() || "",
    travelBatchCount: 0,
    travelEndDate: firstTruthy(
      args.travelEndDate,
      confirmedOffer.travelEndDate,
      linkedQuery.travelEndDate
    ),
    travelStartDate: firstTruthy(
      args.travelStartDate,
      confirmedOffer.travelStartDate,
      linkedQuery.travelStartDate
    ),
    updatedAt: now,
    visaCostPerPax: confirmedOffer.visaCostPerPax,
  };
}

async function publishJobCardCreationNotifications(
  ctx: MutationCtx,
  {
    access,
    args,
    confirmedOffer,
    id,
    jobCode,
    linkedQuery,
  }: {
    access: Awaited<ReturnType<typeof requireStaff>>;
    args: CreateJobCardArgs;
    confirmedOffer: Doc<"confirmedOffers">;
    id: Id<"jobCards">;
    jobCode: string;
    linkedQuery: Doc<"queries">;
  }
) {
  const {
    contractingStaffId,
    needsTicketingWork,
    notifications: ownerNotifications,
    ticketingStaffId,
  } = ownerNotificationsForJobCard(ctx, linkedQuery, id, jobCode);
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
  const travelStartDate = firstTruthy(
    args.travelStartDate,
    confirmedOffer.travelStartDate,
    linkedQuery.travelStartDate
  );

  await Promise.all([
    createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "jobCard",
      message: `${jobCode} opened for ${linkedQuery.clientName || args.clientName || "client"}`,
      metadata: {
        confirmedOfferId: confirmedOffer._id,
        confirmedOfferPax: confirmedOffer.confirmedPax,
        confirmedOfferTravelEndDate: confirmedOffer.travelEndDate ?? "",
        confirmedOfferTravelStartDate: confirmedOffer.travelStartDate,
        jobCardPax: args.confirmedPax,
        jobCardTravelEndDate: firstTruthy(
          args.travelEndDate,
          confirmedOffer.travelEndDate,
          linkedQuery.travelEndDate
        ),
        jobCardTravelStartDate: travelStartDate,
      },
    }),
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "roles", roles: downstreamRoles },
      content: {
        body: `${jobCode} is live for ${linkedQuery.queryCode} (${linkedQuery.clientName}, ${linkedQuery.destination || confirmedOffer.destination || "destination TBD"}, ${args.confirmedPax} pax, ${travelStartDate || "dates TBD"}${linkedQuery.ticketingScope ? `, Ticketing Scope ${linkedQuery.ticketingScope}` : ""}, Contracting ${linkedQuery.contractingOwnerName || "unassigned"}, Ticketing ${linkedQuery.ticketingOwnerName || "unassigned"}). Begin traveller master, tickets, passport, visa, and tour manager work.`,
        entityId: id,
        entityType: "jobCard",
        title: "Job Card opened — start operations",
      },
      emailTargets: { kind: "roles", roles: downstreamEmailRoles },
    }),
    ...ownerNotifications,
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
      content: {
        body: `${jobCode} has been created and is ready for operations.`,
        entityId: id,
        entityType: "jobCard",
        title: "Job Card opened",
      },
      emailTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
    }),
    notifyFinanceHeadsOnJobCardCreation(ctx, jobCode, id),
  ]);
}

export async function handleCreateFromQuery(ctx: MutationCtx, args: CreateJobCardArgs) {
  const {
    access,
    confirmedOffer,
    existing,
    linkedQuery,
    proposalId,
    proposalQueryHandoffId,
    proposalRevision,
    queryId,
  } = await loadJobCardCreationContext(ctx, args);
  const targetId = `${String(queryId)}:${String(confirmedOffer._id)}:${String(proposalQueryHandoffId)}:${proposalRevision}`;
  const receipt = await resolveCommandReceipt(ctx, {
    access,
    commandId: args.commandId,
    operation: "job_card.create_from_confirmed_offer.v1",
    payload: {
      confirmedOfferId: String(confirmedOffer._id),
      confirmedPax: args.confirmedPax,
      proposalId: String(proposalId),
      proposalQueryHandoffId: String(proposalQueryHandoffId),
      proposalRevision,
      queryId: String(queryId),
      roomCount: args.roomCount,
      travelEndDate: args.travelEndDate,
      travelStartDate: args.travelStartDate,
    },
    targetId,
  });
  if (receipt.replayedResultId) {
    const replayedId = ctx.db.normalizeId("jobCards", receipt.replayedResultId);
    const replayed = replayedId ? await ctx.db.get("jobCards", replayedId) : null;
    if (
      !replayed ||
      replayed.confirmedOfferId !== confirmedOffer._id ||
      replayed.proposalQueryHandoffId !== proposalQueryHandoffId ||
      replayed.proposalRevision !== proposalRevision ||
      replayed.queryId !== queryId
    ) {
      throw new ConvexError("Stored command result is no longer valid");
    }
    return { id: replayed._id, jobCode: replayed.jobCode };
  }
  if (existing) {
    throw new ConvexError("This query already has a linked Job Card");
  }

  const salesOwnerStaffId = linkedQuery.salesOwnerId
    ? ctx.db.normalizeId("staffUsers", linkedQuery.salesOwnerId)
    : null;
  const stableSalesRep = salesOwnerStaffId
    ? await ctx.db.get("staffUsers", salesOwnerStaffId)
    : null;
  const legacySalesMatches =
    !stableSalesRep && linkedQuery.salesOwnerId
      ? await ctx.db
          .query("staffUsers")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", linkedQuery.salesOwnerId))
          .take(2)
      : [];
  const salesRepStaff =
    stableSalesRep ?? (legacySalesMatches.length === 1 ? legacySalesMatches[0] : null);
  const jobCodeSuffixName =
    salesRepStaff?.name?.trim() || linkedQuery.salesOwnerName || access.name;
  const now = Date.now();
  const jobCode = await nextCode(ctx, "jobCards", "JC", {
    suffix: creatorInitials(jobCodeSuffixName),
  });
  const jobCardPayload = buildJobCardPayload({
    access,
    args,
    confirmedOffer,
    jobCode,
    linkedQuery,
    now,
    proposalId,
    proposalQueryHandoffId,
    proposalRevision,
    queryId,
  });
  const id = await insertWithE2eOwnership(ctx, "jobCards", jobCardPayload);
  await markListSearchDirty(ctx, "jobCards", String(id));
  await scheduleCrmMetricSync(ctx, "jobCards", String(id));
  await patchWithE2eOwnership(ctx, "queries", queryId, {
    jobCardPreview: { jobCardCode: jobCode, jobCardId: id },
  });
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await materializeDefaultChecklistTasks(
    ctx,
    id,
    DEFAULT_CHECKLIST,
    access.authUserId ?? "unknown",
    now
  );

  await publishJobCardCreationNotifications(ctx, {
    access,
    args,
    confirmedOffer,
    id,
    jobCode,
    linkedQuery,
  });

  await storeCommandReceipt(ctx, {
    actorKey: receipt.actorKey,
    commandId: args.commandId,
    operation: "job_card.create_from_confirmed_offer.v1",
    payloadDigest: receipt.payloadDigest,
    resultId: String(id),
    targetId,
  });

  return { id, jobCode };
}
