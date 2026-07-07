import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import {
  assertCementQueryTypeAllowed,
  assertDateRangeOrder,
  assertMaxWordCount,
  canSeeQueryRecord,
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
  v.literal("Not required")
);

async function notifyQueryOwner(
  ctx: Parameters<typeof notifyStaffMember>[0],
  ownerId: string | undefined,
  notification: Parameters<typeof notifyStaffMember>[2]
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
  queryId: Id<"queries">
) {
  const entity = { entityId: queryId, entityType: "query" as const };
  await Promise.all([
    notifyRoles(ctx, [...OPS_START_ROLES], {
      body: `${query.queryCode} was confirmed by Sales. Accounts will open a Job Card; contracting, operations, and ticketing can begin traveller master, tickets, passport, visa, and tour manager work.`,
      title: "Order confirmed — prepare operations",
      ...entity,
    }),
    notifyQueryOwner(ctx, query.contractingOwnerId, {
      body: `${query.queryCode} was confirmed. Prepare revised costing if needed and coordinate operations once the Job Card opens.`,
      title: "Order confirmed on your query",
      ...entity,
    }),
    notifyQueryOwner(ctx, query.ticketingOwnerId, {
      body: `${query.queryCode} was confirmed. Prepare ticketing once the Job Card opens.`,
      title: "Order confirmed on your query",
      ...entity,
    }),
  ]);
}

async function notifyJobCardCreators(
  ctx: Parameters<typeof notifyStaffMember>[0],
  query: { queryCode: string },
  queryId: Id<"queries">
) {
  const staffRows = await ctx.db.query("staffUsers").collect();
  const notifications = [];
  for (const staff of staffRows) {
    if (!isJobCardCreatorNotificationTarget(staff)) {
      continue;
    }
    notifications.push(
      notifyStaffMember(ctx, staff._id, {
        body: `${query.queryCode} is confirmed. Create the Job Card in Accounts.`,
        entityId: queryId,
        entityType: "query",
        title: "Order confirmed — open Job Card",
      })
    );
  }
  await Promise.all(notifications);
}

export function isJobCardCreatorNotificationTarget(staff: { active?: boolean; roles?: string[] }) {
  return Boolean(
    staff.active && staff.roles?.some((role) => ["Accounts", "Accounts Head"].includes(role))
  );
}

export function queryAssignmentHeadRoles(query: {
  ticketingOwnerId?: string;
  ticketingScope?: string;
}) {
  const roles = ["Contracting Head", "Operations Head"];
  if (query.ticketingOwnerId || (query.ticketingScope && query.ticketingScope !== "Not required")) {
    roles.push("Head of Ticketing");
  }
  return roles;
}

async function notifyQueryAssignmentHeads(
  ctx: Parameters<typeof notifyRoles>[0],
  query: { ticketingOwnerId?: string; ticketingScope?: string },
  notification: Parameters<typeof notifyRoles>[2]
) {
  const roles = queryAssignmentHeadRoles(query);
  await notifyRoles(ctx, roles, notification, { emailRoles: roles });
}

async function notifyAssignedQueryOwners(
  ctx: Parameters<typeof notifyStaffMember>[0],
  query: { queryCode: string; contractingOwnerId?: string; ticketingOwnerId?: string },
  queryId: Id<"queries">
) {
  const notifications = [];
  if (query.contractingOwnerId) {
    notifications.push(
      notifyQueryOwner(ctx, query.contractingOwnerId, {
        body: `${query.queryCode} was submitted by Sales and is ready for contracting proposal work.`,
        entityId: queryId,
        entityType: "query",
        title: "Query submitted for proposal work",
      })
    );
  }
  if (query.ticketingOwnerId) {
    notifications.push(
      notifyQueryOwner(ctx, query.ticketingOwnerId, {
        body: `${query.queryCode} was submitted by Sales and is ready for ticketing inputs.`,
        entityId: queryId,
        entityType: "query",
        title: "Query submitted for ticketing inputs",
      })
    );
  }
  await Promise.all(notifications);
}

const queryTypeValidator = v.union(
  v.literal("MICE"),
  v.literal("MICE Bidding"),
  v.literal("Cement"),
  v.literal("Cement Bidding"),
  v.literal("FIT"),
  v.literal("Family Group"),
  v.literal("B2B"),
  v.literal("Spiritual")
);

const travelTypeValidator = v.union(
  v.literal("Domestic Travel"),
  v.literal("International Travel")
);

const salesStatusValidator = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

const leadStageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost"),
  v.literal("Closed")
);

const querySourceValidator = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral")
);

const contractingStatusValidator = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

const lostReasonValidator = v.union(
  v.literal("Price"),
  v.literal("Competition"),
  v.literal("Not travelling"),
  v.literal("Other")
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
    notification: Omit<PlannedOwnerNotification, "ownerId">
  ) => {
    if (!ownerId || ownerNotifications.some((entry) => entry.ownerId === ownerId)) {
      return;
    }
    ownerNotifications.push({ ownerId, ...notification });
  };

  if (args.salesStatus === "Date/Destination Change Required") {
    addOwnerNotification(current.contractingOwnerId, {
      body: `${current.queryCode} was sent back by Sales for a date or destination change.`,
      title: "Revise proposal",
    });
    addOwnerNotification(current.ticketingOwnerId, {
      body: `${current.queryCode} needs updated ticketing inputs for the revised proposal.`,
      title: "Revise proposal costing",
    });
  }

  if (args.salesStatus === "Order Lost") {
    roleNotifications.push({
      body: `${current.queryCode} was marked lost by Sales.`,
      roles: ["Contracting", "Contracting Head"],
      title: "Order lost",
    });
    addOwnerNotification(current.contractingOwnerId, {
      body: `${current.queryCode} was marked lost by Sales.`,
      title: "Order lost on your query",
    });
    addOwnerNotification(current.ticketingOwnerId, {
      body: `${current.queryCode} was marked lost by Sales.`,
      title: "Order lost on your query",
    });
  }

  if (isNewlyConfirmed) {
    roleNotifications.push({
      body: `${current.queryCode} has been confirmed by Sales.`,
      roles: ["Finance"],
      title: "Order confirmed",
    });
  }

  return {
    notifyJobCardCreators: isNewlyConfirmed,
    notifyOrderConfirmedWorkflow: isNewlyConfirmed,
    ownerNotifications,
    roleNotifications,
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
    batchingNotes: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    clientName: v.string(),
    contactMobile: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contractingStaffId: v.optional(v.string()),
    destination: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.number(),
    queryType: queryTypeValidator,
    salesOwnerName: v.optional(v.string()),
    source: v.optional(querySourceValidator),
    ticketingScope: v.optional(ticketingScopeValidator),
    travelEndDate: v.optional(v.string()),
    travelInBatches: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
    travelType: travelTypeValidator,
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
    const id = await ctx.db.insert("queries", {
      batchingNotes: args.batchingNotes?.trim() || "",
      budgetAmount: Math.max(args.budgetAmount ?? 0, 0),
      clientId,
      clientName: args.clientName.trim(),
      contactMobile: args.contactMobile?.trim() || "",
      contactPerson: args.contactPerson?.trim() || "",
      contractingStatus: "Query Received",
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
      destination: args.destination?.trim() || "",
      leadStage: "Proposal",
      notes: args.notes?.trim() || "",
      paxCount: args.paxCount,
      queryCode,
      queryType: args.queryType,
      salesOwnerId: access.authUserId,
      salesOwnerName: args.salesOwnerName?.trim() || access.name,
      salesStatus: "Proposal in discussion",
      source: args.source ?? "Client",
      submittedToContractingAt: now,
      travelEndDate: args.travelEndDate || "",
      travelInBatches: Boolean(args.travelInBatches),
      travelStartDate: args.travelStartDate || "",
      travelType: args.travelType,
      updatedAt: now,
    });

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
  },
});

export const update = mutation({
  args: {
    batchingNotes: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    clientName: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    destination: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    queryId: v.string(),
    queryType: v.optional(queryTypeValidator),
    salesOwnerName: v.optional(v.string()),
    source: v.optional(querySourceValidator),
    travelEndDate: v.optional(v.string()),
    travelInBatches: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
    travelType: v.optional(travelTypeValidator),
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

    await ctx.db.patch(queryId, patch);
    await createActivity(ctx, access, {
      action: "updated",
      entityId: queryId,
      entityType: "query",
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
      contractingStaffId: args.staffId,
      queryId: args.queryId,
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
    contractingStaffId: v.optional(v.string()),
    queryId: v.string(),
    ticketingScope: v.optional(ticketingScopeValidator),
    ticketingStaffId: v.optional(v.string()),
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
  },
});

export const updateStatus = mutation({
  args: {
    approxMargin: v.optional(v.number()),
    contractingAirlinesCost: v.optional(v.number()),
    contractingLandCost: v.optional(v.number()),
    contractingStatus: v.optional(contractingStatusValidator),
    contractingVisaCost: v.optional(v.number()),
    leadStage: v.optional(leadStageValidator),
    lostReason: v.optional(lostReasonValidator),
    lostReasonOther: v.optional(v.string()),
    queryId: v.string(),
    salesStatus: v.optional(salesStatusValidator),
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
          "Approximate margin can only be entered after the query is confirmed"
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
        `Cannot delete ${current.queryCode} because it has linked ${linkedSummary}. Delete or unlink those records first.`
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
      })
    );

    await Promise.all([
      createActivity(ctx, access, {
        action: "deleted",
        entityId: queryId,
        entityType: "query",
        message: `${current.queryCode} deleted`,
      }),
      deleteEntityNotifications(ctx, "query", queryId),
      ctx.db.delete(queryId),
    ]);
    return { id: queryId };
  },
});
