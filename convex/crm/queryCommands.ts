import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { snapshotNewlyConfirmedOffer } from "./confirmedOffer";
import {
  assertCementQueryTypeAllowed,
  assertDateRangeOrder,
  assertMaxWordCount,
  canSeeQueryRecord,
  createActivity,
  hasRole,
  isDirectorOrAdmin,
  MAX_QUERY_NOTES_WORDS,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import { buildQueryListSearchText } from "./listSearch";
import { resolveSalesOwnerSelection } from "./queryCreation";
import {
  notifyAssignedQueryOwners,
  notifyJobCardCreators,
  notifyOrderConfirmedWorkflow,
  notifyQueryAssignmentHeads,
  notifyQueryOwner,
} from "./queryNotifications";
import {
  assertConfirmedQueryIsTerminal,
  assertRevisionHasActualChange,
  buildQueryStatusNotificationPlan,
  buildQueryStatusPatch,
} from "./queryStatusPolicy";
import type { QueryStatusArgs } from "./queryValidators";

export { handleQueryCreate } from "./queryCreation";

export async function handleQueryUpdate(
  ctx: MutationCtx,
  args: {
    batchingNotes?: string;
    budgetAmount?: number;
    clientName?: string;
    contactMobile?: string;
    contactPerson?: string;
    destination?: string;
    notes?: string;
    paxCount?: number;
    queryId: string;
    queryType?: string;
    salesOwnerName?: string;
    salesOwnerStaffId?: string;
    source?: string;
    travelEndDate?: string;
    travelInBatches?: boolean;
    travelStartDate?: string;
    travelType?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
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
  if (args.clientName !== undefined && !args.clientName.trim()) {
    throw new ConvexError("Client name is required");
  }
  if (args.paxCount !== undefined && args.paxCount < 1) {
    throw new ConvexError("Pax count must be greater than zero");
  }
  assertMaxWordCount(args.notes, MAX_QUERY_NOTES_WORDS, "Notes");
  if (args.queryType !== undefined) {
    assertCementQueryTypeAllowed(access, args.queryType);
  }
  assertDateRangeOrder(
    args.travelStartDate ?? current.travelStartDate,
    args.travelEndDate ?? current.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (args.clientName !== undefined) {
    patch.clientName = args.clientName.trim();
  }
  if (args.contactPerson !== undefined) {
    patch.contactPerson = args.contactPerson.trim();
  }
  if (args.contactMobile !== undefined) {
    patch.contactMobile = args.contactMobile.trim();
  }
  if (args.destination !== undefined) {
    patch.destination = args.destination.trim();
  }
  if (args.paxCount !== undefined) {
    patch.paxCount = args.paxCount;
  }
  if (args.travelStartDate !== undefined) {
    patch.travelStartDate = args.travelStartDate;
  }
  if (args.travelEndDate !== undefined) {
    patch.travelEndDate = args.travelEndDate;
  }
  if (args.queryType !== undefined) {
    patch.queryType = args.queryType;
  }
  if (args.travelType !== undefined) {
    patch.travelType = args.travelType;
  }
  if (args.budgetAmount !== undefined) {
    patch.budgetAmount = Math.max(args.budgetAmount, 0);
  }
  if (args.source !== undefined) {
    patch.source = args.source;
  }
  if (args.salesOwnerName !== undefined || args.salesOwnerStaffId !== undefined) {
    const salesOwnerStaff = await resolveSalesOwnerSelection(
      ctx,
      access,
      args.salesOwnerStaffId,
      args.salesOwnerName
    );
    patch.salesOwnerId = salesOwnerStaff.authUserId;
    patch.salesOwnerName = salesOwnerStaff.name.trim();
  }
  if (args.travelInBatches !== undefined) {
    patch.travelInBatches = args.travelInBatches;
  }
  if (args.batchingNotes !== undefined) {
    patch.batchingNotes = args.batchingNotes.trim();
  }
  if (args.notes !== undefined) {
    patch.notes = args.notes.trim();
  }
  patch.listSearchText = buildQueryListSearchText({ ...current, ...patch });

  await ctx.db.patch(queryId, patch);
  await createActivity(ctx, access, {
    action: "updated",
    entityId: queryId,
    entityType: "query",
    message: `${current.queryCode} updated`,
  });
  return { id: queryId };
}

export async function handleAssignJobCardCreator(
  ctx: MutationCtx,
  args: {
    queryId: string;
    staffId: string;
  }
) {
  const access = await requireHeadOrAdmin(ctx, ["Accounts Head"]);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const query = await ctx.db.get(queryId);
  if (!query) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, query)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (query.salesStatus !== "Order Confirmed" && query.contractingStatus !== "Order Confirmed") {
    throw new ConvexError("Assign a Job Card creator only after order confirmation");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await ctx.db.get(staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  if (!staff.roles.some((role) => ["Accounts", "Accounts Head"].includes(role))) {
    throw new ConvexError("Selected staff member is not in Accounts");
  }
  const now = Date.now();
  await Promise.all([
    ctx.db.patch(queryId, {
      jobCardCreatorName: staff.name.trim(),
      jobCardCreatorStaffId: staffId,
      updatedAt: now,
    }),
    createActivity(ctx, access, {
      action: "assigned_job_card_creator",
      entityId: queryId,
      entityType: "query",
      message: `${query.queryCode} Job Card creator assigned to ${staff.name.trim()}`,
    }),
    notifyStaffMember(ctx, staffId, {
      body: `${query.queryCode} is assigned to you for Job Card creation.`,
      entityId: queryId,
      entityType: "query",
      title: "Job Card assigned",
    }),
  ]);
  return { id: queryId };
}

export async function handleSubmitToContracting(
  ctx: MutationCtx,
  args: {
    queryId: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
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
  const now = Date.now();
  await ctx.db.patch(queryId, {
    contractingStatus: "Query Received",
    leadStage: current.leadStage === "Inquiry" ? "Proposal" : current.leadStage,
    submittedToContractingAt: now,
    updatedAt: now,
  });
  const hasAssignedTeam = Boolean(
    current.contractingOwnerId || current.ticketingOwnerId || current.ticketingScope
  );
  await Promise.all([
    createActivity(ctx, access, {
      action: "submitted_to_contracting",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} submitted to Contracting`,
    }),
    notifyQueryAssignmentHeads(ctx, current, {
      body: hasAssignedTeam
        ? `${current.queryCode} was submitted by Sales and is ready for assigned proposal work.`
        : `${current.queryCode} was submitted by Sales. Review and assign contracting and ticketing teams.`,
      entityId: queryId,
      entityType: "query",
      title: hasAssignedTeam ? "Query submitted to Contracting" : "Query ready for assignment",
    }),
    ...(hasAssignedTeam ? [notifyAssignedQueryOwners(ctx, current, queryId)] : []),
  ]);
  return { id: queryId };
}

export async function handleQueryUpdateStatus(
  ctx: MutationCtx,
  args: QueryStatusArgs & {
    approxMargin?: number;
    contractingAirlinesCost?: number;
    contractingLandCost?: number;
    contractingStatus?: string;
    contractingVisaCost?: number;
    leadStage?: string;
    lostReason?: string;
    lostReasonOther?: string;
    salesStatus?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_QUERIES,
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

  const canSetSalesOutcome =
    isDirectorOrAdmin(access) ||
    hasRole(access, "Sales") ||
    hasRole(access, "Sales Head") ||
    access.permissions.includes(PERMISSIONS.MANAGE_QUERIES);
  const salesOutcomeRequested =
    args.salesStatus !== undefined ||
    args.leadStage !== undefined ||
    args.lostReason !== undefined ||
    args.contractingStatus === "Order Confirmed" ||
    args.contractingStatus === "Order Lost";
  if (salesOutcomeRequested && !canSetSalesOutcome) {
    throw new ConvexError("Only Sales can confirm or lose an order");
  }

  assertConfirmedQueryIsTerminal(current, args);
  assertRevisionHasActualChange(current, args);
  assertDateRangeOrder(
    args.travelStartDate ?? current.travelStartDate,
    args.travelEndDate ?? current.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const now = Date.now();
  const patch = buildQueryStatusPatch({
    args,
    now,
  });

  const willBeConfirmed =
    patch.salesStatus === "Order Confirmed" ||
    patch.contractingStatus === "Order Confirmed" ||
    current.salesStatus === "Order Confirmed" ||
    current.contractingStatus === "Order Confirmed";

  if (args.approxMargin !== undefined) {
    if (!willBeConfirmed) {
      throw new ConvexError("Approximate margin can only be entered after the query is confirmed");
    }
    if (!access.permissions.includes(PERMISSIONS.MANAGE_QUERIES)) {
      throw new ConvexError("Only Sales can enter approximate margin");
    }
    patch.approxMargin = Math.max(args.approxMargin, 0);
  }

  const wasConfirmed =
    current.salesStatus === "Order Confirmed" || current.contractingStatus === "Order Confirmed";
  const isNewlyConfirmed =
    !wasConfirmed &&
    (args.salesStatus === "Order Confirmed" || args.contractingStatus === "Order Confirmed");

  const confirmedOfferId = await snapshotNewlyConfirmedOffer(ctx, access, current, args);
  if (confirmedOfferId) {
    patch.confirmedOfferId = confirmedOfferId;
  }

  await ctx.db.patch(queryId, patch);

  const isLost = args.salesStatus === "Order Lost";
  const notificationPlan = buildQueryStatusNotificationPlan({
    args,
    current,
    isNewlyConfirmed,
    wasConfirmed,
  });

  await Promise.all([
    createActivity(ctx, access, {
      action: isNewlyConfirmed ? "confirmed" : isLost ? "lost" : "status_updated",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} status updated`,
      metadata: { ...patch, confirmedOfferId },
    }),
    ...(notificationPlan.notifyJobCardCreators
      ? [notifyJobCardCreators(ctx, current, queryId)]
      : []),
    ...(notificationPlan.notifyOrderConfirmedWorkflow
      ? [notifyOrderConfirmedWorkflow(ctx, current, queryId)]
      : []),
    ...notificationPlan.roleNotifications.map((notification) =>
      notifyRoles(
        ctx,
        notification.roles,
        {
          body: notification.body,
          entityId: queryId,
          entityType: "query",
          title: notification.title,
        },
        notification.emailRoles ? { emailRoles: notification.emailRoles } : undefined
      )
    ),
    ...notificationPlan.ownerNotifications.map((notification) =>
      notifyQueryOwner(ctx, notification.ownerId, {
        body: notification.body,
        entityId: queryId,
        entityType: "query",
        title: notification.title,
      })
    ),
  ]);

  return { id: queryId };
}
