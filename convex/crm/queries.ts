import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import {
  assertCementQueryTypeAllowed,
  assertDateRangeOrder,
  assertMaxWordCount,
  canSeeQueryRecord,
  contractingNotifyRolesForQueryType,
  createActivity,
  deleteEntityNotifications,
  hasRole,
  isDirectorOrAdmin,
  MAX_QUERY_NOTES_WORDS,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  publicQuery,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import { publicQueryAttachment } from "./queryAttachments";
import { applyQueryTeamAssignments } from "./queryTeamAssignment";

const OPS_START_ROLES = [
  "Contracting",
  "Contracting Head",
  "Operations",
  "Operations Head",
  "Ticketing",
  "Head of Ticketing",
] as const;

const ticketingScopeValidator = v.union(
  v.literal("Domestic"),
  v.literal("International"),
  v.literal("Both"),
  v.literal("Not required"),
);

async function notifyQueryOwner(
  ctx: Parameters<typeof notifyStaffMember>[0],
  ownerId: string | undefined,
  notification: Parameters<typeof notifyStaffMember>[2],
) {
  if (!ownerId) {
    return;
  }
  const staffId = ctx.db.normalizeId("staffUsers", ownerId);
  if (!staffId) {
    return;
  }
  await notifyStaffMember(ctx, staffId, notification);
}

async function notifyOrderConfirmedWorkflow(
  ctx: Parameters<typeof notifyRoles>[0],
  query: { queryCode: string; contractingOwnerId?: string; ticketingOwnerId?: string },
  queryId: Id<"queries">,
) {
  const entity = { entityType: "query" as const, entityId: queryId };
  await Promise.all([
    notifyRoles(ctx, [...OPS_START_ROLES], {
      title: "Order confirmed — prepare operations",
      body: `${query.queryCode} was confirmed by Sales. Accounts will open a Job Card; contracting, operations, and ticketing can begin traveller master, tickets, passport, visa, and tour manager work.`,
      ...entity,
    }),
    notifyQueryOwner(ctx, query.contractingOwnerId, {
      title: "Order confirmed on your query",
      body: `${query.queryCode} was confirmed. Prepare revised costing if needed and coordinate operations once the Job Card opens.`,
      ...entity,
    }),
    notifyQueryOwner(ctx, query.ticketingOwnerId, {
      title: "Order confirmed on your query",
      body: `${query.queryCode} was confirmed. Prepare ticketing once the Job Card opens.`,
      ...entity,
    }),
  ]);
}

async function notifyJobCardCreators(
  ctx: Parameters<typeof notifyStaffMember>[0],
  query: { queryCode: string },
  queryId: Id<"queries">,
) {
  const staffRows = await ctx.db.query("staffUsers").collect();
  const notifications = [];
  for (const staff of staffRows) {
    if (!isJobCardCreatorNotificationTarget(staff)) continue;
    notifications.push(
      notifyStaffMember(ctx, staff._id, {
        title: "Order confirmed — open Job Card",
        body: `${query.queryCode} is confirmed. Create the Job Card in Accounts.`,
        entityType: "query",
        entityId: queryId,
      }),
    );
  }
  await Promise.all(notifications);
}

export function isJobCardCreatorNotificationTarget(staff: { active?: boolean; roles?: string[] }) {
  return Boolean(
    staff.active && staff.roles?.some((role) => ["Accounts", "Accounts Head"].includes(role)),
  );
}

const queryTypeValidator = v.union(
  v.literal("MICE"),
  v.literal("MICE Bidding"),
  v.literal("Cement"),
  v.literal("Cement Bidding"),
  v.literal("FIT"),
  v.literal("Family Group"),
  v.literal("B2B"),
  v.literal("Spiritual"),
);

const travelTypeValidator = v.union(
  v.literal("Domestic Travel"),
  v.literal("International Travel"),
);

const salesStatusValidator = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const leadStageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost"),
  v.literal("Closed"),
);

const querySourceValidator = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral"),
);

const contractingStatusValidator = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const lostReasonValidator = v.union(
  v.literal("Price"),
  v.literal("Competition"),
  v.literal("Not travelling"),
  v.literal("Other"),
);

export type SalesStatus =
  | "Proposal in discussion"
  | "Change in destination"
  | "Date/Destination Change Required"
  | "Order Confirmed"
  | "Order Lost";

export type LeadStage = "Inquiry" | "Proposal" | "Negotiation" | "Confirmation" | "Lost" | "Closed";

export type ContractingStatus =
  | "Query Received"
  | "Proposal in progress"
  | "Proposal sent"
  | "Change in destination"
  | "Date/Destination Change Required"
  | "Order Confirmed"
  | "Order Lost";

export type LostReason = "Price" | "Competition" | "Not travelling" | "Other";

export type QueryStatusArgs = {
  queryId: string;
  salesStatus?: SalesStatus;
  leadStage?: LeadStage;
  contractingStatus?: ContractingStatus;
  lostReason?: LostReason;
  lostReasonOther?: string;
  contractingLandCost?: number;
  contractingAirlinesCost?: number;
  contractingVisaCost?: number;
  approxMargin?: number;
};

type CurrentQueryStatus = {
  queryCode: string;
  salesStatus: SalesStatus;
  leadStage?: LeadStage;
  contractingStatus: ContractingStatus;
  contractingOwnerId?: string;
  ticketingOwnerId?: string;
};

type QueryStatusPatch = Record<string, unknown>;

export function buildQueryStatusPatch({
  args,
  now,
}: {
  args: QueryStatusArgs;
  now: number;
}): QueryStatusPatch {
  if (args.contractingStatus === "Order Lost") {
    throw new ConvexError("Only Sales can mark an order as lost");
  }
  if (args.salesStatus === "Order Lost" && !args.lostReason) {
    throw new ConvexError("Select a lost reason.");
  }

  const patch: QueryStatusPatch = {
    updatedAt: now,
  };
  if (args.salesStatus) {
    patch.salesStatus = args.salesStatus;
    if (args.salesStatus === "Order Confirmed") {
      patch.contractingStatus = "Order Confirmed";
      patch.leadStage = "Confirmation";
      patch.confirmedAt = now;
      patch.reassignToTeams = false;
    }
    if (args.salesStatus === "Order Lost") {
      patch.contractingStatus = "Order Lost";
      patch.leadStage = "Lost";
      patch.reassignToTeams = false;
    }
    if (args.salesStatus === "Date/Destination Change Required") {
      patch.contractingStatus = "Proposal in progress";
      patch.leadStage = "Negotiation";
      patch.reassignToTeams = true;
    }
    if (args.salesStatus === "Proposal in discussion") {
      patch.leadStage = "Proposal";
      patch.reassignToTeams = false;
    }
  }
  if (args.leadStage) {
    patch.leadStage = args.leadStage;
  }
  if (args.contractingStatus) {
    patch.contractingStatus = args.contractingStatus;
    if (args.contractingStatus === "Order Confirmed") {
      patch.salesStatus = "Order Confirmed";
      patch.leadStage = "Confirmation";
      patch.confirmedAt = now;
    }
  }
  if (args.lostReason) {
    patch.lostReason = args.lostReason;
    patch.lostReasonOther = args.lostReasonOther?.trim() || "";
  }
  if (args.contractingLandCost !== undefined) {
    patch.contractingLandCost = Math.max(args.contractingLandCost, 0);
  }
  if (args.contractingAirlinesCost !== undefined) {
    patch.contractingAirlinesCost = Math.max(args.contractingAirlinesCost, 0);
  }
  if (args.contractingVisaCost !== undefined) {
    patch.contractingVisaCost = Math.max(args.contractingVisaCost, 0);
  }

  return patch;
}

type PlannedRoleNotification = {
  roles: string[];
  title: string;
  body: string;
};

type PlannedOwnerNotification = {
  ownerId: string;
  title: string;
  body: string;
};

export function buildQueryStatusNotificationPlan({
  current,
  args,
  isNewlyConfirmed,
}: {
  current: CurrentQueryStatus;
  args: QueryStatusArgs;
  wasConfirmed: boolean;
  isNewlyConfirmed: boolean;
}) {
  const roleNotifications: PlannedRoleNotification[] = [];
  const ownerNotifications: PlannedOwnerNotification[] = [];
  const addOwnerNotification = (
    ownerId: string | undefined,
    notification: Omit<PlannedOwnerNotification, "ownerId">,
  ) => {
    if (!ownerId || ownerNotifications.some((entry) => entry.ownerId === ownerId)) {
      return;
    }
    ownerNotifications.push({ ownerId, ...notification });
  };

  if (args.salesStatus === "Date/Destination Change Required") {
    addOwnerNotification(current.contractingOwnerId, {
      title: "Revise proposal",
      body: `${current.queryCode} was sent back by Sales for a date or destination change.`,
    });
    addOwnerNotification(current.ticketingOwnerId, {
      title: "Revise proposal costing",
      body: `${current.queryCode} needs updated ticketing inputs for the revised proposal.`,
    });
  }

  if (args.salesStatus === "Order Lost") {
    roleNotifications.push({
      roles: ["Contracting", "Contracting Head"],
      title: "Order lost",
      body: `${current.queryCode} was marked lost by Sales.`,
    });
    addOwnerNotification(current.contractingOwnerId, {
      title: "Order lost on your query",
      body: `${current.queryCode} was marked lost by Sales.`,
    });
    addOwnerNotification(current.ticketingOwnerId, {
      title: "Order lost on your query",
      body: `${current.queryCode} was marked lost by Sales.`,
    });
  }

  if (isNewlyConfirmed) {
    roleNotifications.push({
      roles: ["Finance"],
      title: "Order confirmed",
      body: `${current.queryCode} has been confirmed by Sales.`,
    });
  }

  return {
    notifyJobCardCreators: isNewlyConfirmed,
    notifyOrderConfirmedWorkflow: isNewlyConfirmed,
    roleNotifications,
    ownerNotifications,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows, attachments] = await Promise.all([
      requireAnyPermission(ctx, [
        PERMISSIONS.VIEW_QUERIES,
        PERMISSIONS.VIEW_CONTRACTING,
        PERMISSIONS.VIEW_JOB_CARDS,
      ]),
      ctx.db.query("queries").collect(),
      ctx.db.query("queryAttachments").collect(),
    ]);
    const attachmentsByQuery = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      const key = attachment.queryId;
      const bucket = attachmentsByQuery.get(key) ?? [];
      bucket.push(attachment);
      attachmentsByQuery.set(key, bucket);
    }
    return rows
      .filter((row) => canSeeQueryRecord(access, row))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        ...publicQuery(row),
        attachments: (attachmentsByQuery.get(row._id) ?? [])
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(publicQueryAttachment),
      }));
  },
});

export const create = mutation({
  args: {
    clientName: v.string(),
    contactPerson: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    paxCount: v.number(),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    queryType: queryTypeValidator,
    travelType: travelTypeValidator,
    budgetAmount: v.optional(v.number()),
    source: v.optional(querySourceValidator),
    salesOwnerName: v.optional(v.string()),
    contractingStaffId: v.optional(v.string()),
    ticketingScope: v.optional(ticketingScopeValidator),
    travelInBatches: v.optional(v.boolean()),
    batchingNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      "Travel end date",
    );

    const now = Date.now();
    const [access, [queryCode, clientId]] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES),
      Promise.all([
        nextCode(ctx, "queries", "Q"),
        ctx.db.insert("clients", {
          name: args.clientName.trim(),
          contactPerson: args.contactPerson?.trim() || "",
          phone: args.contactMobile?.trim() || "",
          createdAt: now,
          updatedAt: now,
        }),
      ]),
    ]);
    assertCementQueryTypeAllowed(access, args.queryType);
    const id = await ctx.db.insert("queries", {
      queryCode,
      clientId,
      clientName: args.clientName.trim(),
      contactPerson: args.contactPerson?.trim() || "",
      contactMobile: args.contactMobile?.trim() || "",
      destination: args.destination?.trim() || "",
      paxCount: args.paxCount,
      travelStartDate: args.travelStartDate || "",
      travelEndDate: args.travelEndDate || "",
      queryType: args.queryType,
      travelType: args.travelType,
      salesStatus: "Proposal in discussion",
      leadStage: "Proposal",
      contractingStatus: "Query Received",
      budgetAmount: Math.max(args.budgetAmount ?? 0, 0),
      source: args.source ?? "Client",
      salesOwnerId: access.authUserId,
      salesOwnerName: args.salesOwnerName?.trim() || access.name,
      travelInBatches: Boolean(args.travelInBatches),
      batchingNotes: args.batchingNotes?.trim() || "",
      notes: args.notes?.trim() || "",
      submittedToContractingAt: now,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await Promise.all([
      createActivity(ctx, access, {
        entityType: "query",
        entityId: id,
        action: "created",
        message: `${queryCode} created for ${args.clientName.trim()}`,
      }),
      notifyRoles(ctx, contractingNotifyRolesForQueryType(args.queryType), {
        title: "New query received",
        body: `${queryCode} is ready for contracting and operations head review.`,
        entityType: "query",
        entityId: id,
      }),
      notifyRoles(ctx, ["Contracting Head", "Operations Head"], {
        title: "Query ready for assignment",
        body: `${queryCode} was raised by Sales. Review and assign contracting and ticketing teams.`,
        entityType: "query",
        entityId: id,
      }),
    ]);

    if (args.contractingStaffId || args.ticketingScope) {
      await applyQueryTeamAssignments(ctx, access, {
        queryId: id,
        contractingStaffId: args.contractingStaffId,
        ticketingScope: args.ticketingScope,
      });
    }

    return { id, queryCode };
  },
});

export const update = mutation({
  args: {
    queryId: v.string(),
    clientName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    queryType: v.optional(queryTypeValidator),
    travelType: v.optional(travelTypeValidator),
    budgetAmount: v.optional(v.number()),
    source: v.optional(querySourceValidator),
    salesOwnerName: v.optional(v.string()),
    travelInBatches: v.optional(v.boolean()),
    batchingNotes: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      "Travel end date",
    );

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.clientName !== undefined) patch.clientName = args.clientName.trim();
    if (args.contactPerson !== undefined) patch.contactPerson = args.contactPerson.trim();
    if (args.contactMobile !== undefined) patch.contactMobile = args.contactMobile.trim();
    if (args.destination !== undefined) patch.destination = args.destination.trim();
    if (args.paxCount !== undefined) patch.paxCount = args.paxCount;
    if (args.travelStartDate !== undefined) patch.travelStartDate = args.travelStartDate;
    if (args.travelEndDate !== undefined) patch.travelEndDate = args.travelEndDate;
    if (args.queryType !== undefined) patch.queryType = args.queryType;
    if (args.travelType !== undefined) patch.travelType = args.travelType;
    if (args.budgetAmount !== undefined) patch.budgetAmount = Math.max(args.budgetAmount, 0);
    if (args.source !== undefined) patch.source = args.source;
    if (args.salesOwnerName !== undefined) patch.salesOwnerName = args.salesOwnerName.trim();
    if (args.travelInBatches !== undefined) patch.travelInBatches = args.travelInBatches;
    if (args.batchingNotes !== undefined) patch.batchingNotes = args.batchingNotes.trim();
    if (args.notes !== undefined) patch.notes = args.notes.trim();

    await ctx.db.patch(queryId, patch);
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "updated",
      message: `${current.queryCode} updated`,
    });
    return { id: queryId };
  },
});

export const assignContracting = mutation({
  args: { queryId: v.string(), staffId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Contracting Head", "Operations Head"]);
    return await applyQueryTeamAssignments(ctx, access, {
      queryId: args.queryId,
      contractingStaffId: args.staffId,
    });
  },
});

export const assignQueryTicketing = mutation({
  args: { queryId: v.string(), staffId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, [
      "Contracting Head",
      "Operations Head",
      "Head of Ticketing",
    ]);
    return await applyQueryTeamAssignments(ctx, access, {
      queryId: args.queryId,
      ticketingStaffId: args.staffId,
    });
  },
});

export const assignQueryTeams = mutation({
  args: {
    queryId: v.string(),
    contractingStaffId: v.optional(v.string()),
    ticketingStaffId: v.optional(v.string()),
    ticketingScope: v.optional(ticketingScopeValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    return await applyQueryTeamAssignments(ctx, access, args);
  },
});

export const assignJobCardCreator = mutation({
  args: {
    queryId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
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
        jobCardCreatorStaffId: staffId,
        jobCardCreatorName: staff.name.trim(),
        updatedAt: now,
      }),
      createActivity(ctx, access, {
        entityType: "query",
        entityId: queryId,
        action: "assigned_job_card_creator",
        message: `${query.queryCode} Job Card creator assigned to ${staff.name.trim()}`,
      }),
      notifyStaffMember(ctx, staffId, {
        title: "Job Card assigned",
        body: `${query.queryCode} is assigned to you for Job Card creation.`,
        entityType: "query",
        entityId: queryId,
      }),
    ]);
    return { id: queryId };
  },
});

export const submitToContracting = mutation({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
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
    await Promise.all([
      createActivity(ctx, access, {
        entityType: "query",
        entityId: queryId,
        action: "submitted_to_contracting",
        message: `${current.queryCode} submitted to Contracting`,
      }),
      notifyRoles(ctx, ["Contracting Head", "Operations Head"], {
        title: "Query ready for assignment",
        body: `${current.queryCode} was submitted by Sales. Review and assign contracting and ticketing teams.`,
        entityType: "query",
        entityId: queryId,
      }),
      notifyRoles(ctx, ["Contracting", "Contracting Head", "Operations Head", "Directors"], {
        title: "Query submitted to Contracting",
        body: `${current.queryCode} is ready for assignment and proposal work.`,
        entityType: "query",
        entityId: queryId,
      }),
    ]);
    return { id: queryId };
  },
});

export const updateStatus = mutation({
  args: {
    queryId: v.string(),
    salesStatus: v.optional(salesStatusValidator),
    leadStage: v.optional(leadStageValidator),
    contractingStatus: v.optional(contractingStatusValidator),
    lostReason: v.optional(lostReasonValidator),
    lostReasonOther: v.optional(v.string()),
    contractingLandCost: v.optional(v.number()),
    contractingAirlinesCost: v.optional(v.number()),
    contractingVisaCost: v.optional(v.number()),
    approxMargin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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
        throw new ConvexError(
          "Approximate margin can only be entered after the query is confirmed",
        );
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
      current,
      args,
      wasConfirmed,
      isNewlyConfirmed,
    });

    await Promise.all([
      createActivity(ctx, access, {
        entityType: "query",
        entityId: queryId,
        action: isNewlyConfirmed ? "confirmed" : isLost ? "lost" : "status_updated",
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
          title: notification.title,
          body: notification.body,
          entityType: "query",
          entityId: queryId,
        }),
      ),
      ...notificationPlan.ownerNotifications.map((notification) =>
        notifyQueryOwner(ctx, notification.ownerId, {
          title: notification.title,
          body: notification.body,
          entityType: "query",
          entityId: queryId,
        }),
      ),
    ]);

    return { id: queryId };
  },
});

export const remove = mutation({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
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

    const [legacyProposals, proposalLinksForQuery, jobCards] = await Promise.all([
      ctx.db
        .query("proposals")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
      ctx.db
        .query("proposalQueryLinks")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
      ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
    ]);
    const linkedRecordTypes: string[] = [];
    if (legacyProposals.length > 0 || proposalLinksForQuery.length > 0) {
      linkedRecordTypes.push("proposals");
    }
    if (jobCards.length > 0) {
      linkedRecordTypes.push("job cards");
    }
    if (linkedRecordTypes.length > 0) {
      const linkedSummary =
        linkedRecordTypes.length === 1
          ? linkedRecordTypes[0]
          : `${linkedRecordTypes.slice(0, -1).join(", ")} and ${
              linkedRecordTypes[linkedRecordTypes.length - 1]
            }`;
      throw new ConvexError(
        `Cannot delete ${current.queryCode} because it has linked ${linkedSummary}. Delete or unlink those records first.`,
      );
    }

    const assignments = await ctx.db
      .query("contractingAssignments")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    await Promise.all(assignments.map((assignment) => ctx.db.delete(assignment._id)));

    const { storageIds } = await ctx.runMutation(internal.crm.queryAttachments.deleteAllForQuery, {
      queryId,
    });
    await Promise.all(
      storageIds.map(async (storageId: Id<"_storage">) => {
        try {
          await ctx.storage.delete(storageId);
        } catch (err) {
          console.error("Failed to delete query attachment file:", err);
        }
      }),
    );

    await Promise.all([
      createActivity(ctx, access, {
        entityType: "query",
        entityId: queryId,
        action: "deleted",
        message: `${current.queryCode} deleted`,
      }),
      deleteEntityNotifications(ctx, "query", queryId),
      ctx.db.delete(queryId),
    ]);
    return { id: queryId };
  },
});
