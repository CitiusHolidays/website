import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import {
  assertCementQueryTypeAllowed,
  assertDateRangeOrder,
  assertMaxWordCount,
  canSeeQueryRecord,
  createActivity,
  hasRole,
  isDirectorOrAdmin,
  MAX_QUERY_NOTES_WORDS,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import { buildQueryListSearchText } from "./listSearch";
import {
  notifyAssignedQueryOwners,
  notifyJobCardCreators,
  notifyOrderConfirmedWorkflow,
  notifyQueryAssignmentHeads,
  notifyQueryOwner,
} from "./queryNotifications";
import { buildQueryStatusNotificationPlan, buildQueryStatusPatch } from "./queryStatusPolicy";
import { applyQueryTeamAssignments } from "./queryTeamAssignment";
import type { QueryStatusArgs, QueryType, TravelType } from "./queryValidators";

export async function handleQueryCreate(
  ctx: MutationCtx,
  args: {
    batchingNotes?: string;
    budgetAmount?: number;
    clientName: string;
    contactMobile?: string;
    contactPerson?: string;
    contractingStaffId?: string;
    destination?: string;
    notes?: string;
    paxCount: number;
    queryType: QueryType;
    salesOwnerName?: string;
    source?: string;
    ticketingScope?: string;
    travelEndDate?: string;
    travelInBatches?: boolean;
    travelStartDate?: string;
    travelType: TravelType;
  }
) {
  if (!args.clientName.trim()) {
    throw new ConvexError("Client name is required");
  }
  if (args.paxCount < 1) {
    throw new ConvexError("Pax count must be greater than zero");
  }
  assertMaxWordCount(args.notes, MAX_QUERY_NOTES_WORDS, "Notes");
  assertDateRangeOrder(
    args.travelStartDate,
    args.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const now = Date.now();
  const [access, [queryCode, clientId]] = await Promise.all([
    requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES),
    Promise.all([
      nextCode(ctx, "queries", "Q"),
      ctx.db.insert("clients", {
        contactPerson: args.contactPerson?.trim() || "",
        createdAt: now,
        name: args.clientName.trim(),
        phone: args.contactMobile?.trim() || "",
        updatedAt: now,
      }),
    ]),
  ]);
  assertCementQueryTypeAllowed(access, args.queryType);
  const queryPayload = {
    attachmentCount: 0,
    attachmentPreview: [],
    batchingNotes: args.batchingNotes?.trim() || "",
    budgetAmount: Math.max(args.budgetAmount ?? 0, 0),
    clientId,
    clientName: args.clientName.trim(),
    contactMobile: args.contactMobile?.trim() || "",
    contactPerson: args.contactPerson?.trim() || "",
    contractingStatus: "Query Received" as const,
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    destination: args.destination?.trim() || "",
    leadStage: "Proposal" as const,
    listSearchText: buildQueryListSearchText({
      clientName: args.clientName,
      destination: args.destination,
      queryCode,
      queryType: args.queryType,
      salesOwnerName: args.salesOwnerName?.trim() || access.name,
    }),
    notes: args.notes?.trim() || "",
    paxCount: args.paxCount,
    queryCode,
    queryType: args.queryType,
    salesOwnerId: access.authUserId,
    salesOwnerName: args.salesOwnerName?.trim() || access.name,
    salesStatus: "Proposal in discussion" as const,
    source: (args.source ?? "Client") as "Website" | "WhatsApp" | "Email" | "Client" | "Referral",
    submittedToContractingAt: now,
    travelEndDate: args.travelEndDate || "",
    travelInBatches: Boolean(args.travelInBatches),
    travelStartDate: args.travelStartDate || "",
    travelType: args.travelType,
    updatedAt: now,
  };
  const id = await ctx.db.insert("queries", queryPayload);

  await createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "query",
    message: `${queryCode} created for ${args.clientName.trim()}`,
  });

  if (args.contractingStaffId || args.ticketingScope) {
    await applyQueryTeamAssignments(ctx, access, {
      contractingStaffId: args.contractingStaffId,
      queryId: id,
      ticketingScope: args.ticketingScope,
    });
  } else {
    await notifyQueryAssignmentHeads(
      ctx,
      { ticketingScope: args.ticketingScope },
      {
        body: `${queryCode} was raised by Sales. Review and assign contracting and ticketing teams.`,
        entityId: id,
        entityType: "query",
        title: "Query ready for assignment",
      }
    );
  }

  return { id, queryCode };
}

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
  if (args.salesOwnerName !== undefined) {
    patch.salesOwnerName = args.salesOwnerName.trim();
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

  const patch = buildQueryStatusPatch({
    args,
    now: Date.now(),
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

  await ctx.db.patch(queryId, patch);

  const wasConfirmed =
    current.salesStatus === "Order Confirmed" || current.contractingStatus === "Order Confirmed";
  const isNewlyConfirmed =
    !wasConfirmed &&
    (args.salesStatus === "Order Confirmed" || args.contractingStatus === "Order Confirmed");
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
      metadata: patch,
    }),
    ...(notificationPlan.notifyJobCardCreators
      ? [notifyJobCardCreators(ctx, current, queryId)]
      : []),
    ...(notificationPlan.notifyOrderConfirmedWorkflow
      ? [notifyOrderConfirmedWorkflow(ctx, current, queryId)]
      : []),
    ...notificationPlan.roleNotifications.map((notification) =>
      notifyRoles(ctx, notification.roles, {
        body: notification.body,
        entityId: queryId,
        entityType: "query",
        title: notification.title,
      })
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
