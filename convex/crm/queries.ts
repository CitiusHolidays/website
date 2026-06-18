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
  deleteJobCardCascade,
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
  await Promise.all(
    staffRows
      .filter(
        (staff) =>
          staff.active &&
          staff.jobCardCreatorEnabled &&
          staff.roles.some((role) => ["Accounts", "Accounts Head"].includes(role)),
      )
      .map((staff) =>
        notifyStaffMember(ctx, staff._id, {
          title: "Order confirmed — open Job Card",
          body: `${query.queryCode} is confirmed. Create the Job Card in Accounts.`,
          entityType: "query",
          entityId: queryId,
        }),
      ),
  );
}

async function notifyProposalRevisionWorkflow(
  ctx: Parameters<typeof notifyRoles>[0],
  query: { queryCode: string; contractingOwnerId?: string; ticketingOwnerId?: string },
  queryId: Id<"queries">,
) {
  const entity = { entityType: "query" as const, entityId: queryId };
  await Promise.all([
    notifyRoles(ctx, ["Contracting", "Contracting Head", "Ticketing", "Head of Ticketing"], {
      title: "Proposal revision required",
      body: `${query.queryCode} needs a date or destination revision. Rework the proposal and return it to Sales.`,
      ...entity,
    }),
    notifyQueryOwner(ctx, query.contractingOwnerId, {
      title: "Revise proposal",
      body: `${query.queryCode} was sent back by Sales for a date or destination change.`,
      ...entity,
    }),
    notifyQueryOwner(ctx, query.ticketingOwnerId, {
      title: "Revise proposal costing",
      body: `${query.queryCode} needs updated ticketing inputs for the revised proposal.`,
      ...entity,
    }),
  ]);
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

    if (args.contractingStatus === "Order Lost") {
      throw new ConvexError("Only Sales can mark an order as lost");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.salesStatus) {
      patch.salesStatus = args.salesStatus;
      if (args.salesStatus === "Order Confirmed") {
        patch.contractingStatus = "Order Confirmed";
        patch.leadStage = "Confirmation";
        patch.confirmedAt = Date.now();
      }
      if (args.salesStatus === "Order Lost") {
        patch.contractingStatus = "Order Lost";
        patch.leadStage = "Lost";
      }
      if (args.salesStatus === "Date/Destination Change Required") {
        patch.contractingStatus = "Proposal in progress";
        patch.leadStage = "Negotiation";
      }
      if (args.salesStatus === "Proposal in discussion") {
        patch.leadStage = "Proposal";
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
        patch.confirmedAt = Date.now();
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

    const willBeConfirmed =
      args.salesStatus === "Order Confirmed" ||
      args.contractingStatus === "Order Confirmed" ||
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
    const isRevisionRequested = args.salesStatus === "Date/Destination Change Required";

    await Promise.all([
      createActivity(ctx, access, {
        entityType: "query",
        entityId: queryId,
        action: isNewlyConfirmed ? "confirmed" : isLost ? "lost" : "status_updated",
        message: `${current.queryCode} status updated`,
        metadata: patch,
      }),
      ...(isNewlyConfirmed
        ? [
            notifyJobCardCreators(ctx, current, queryId),
            notifyOrderConfirmedWorkflow(ctx, current, queryId),
            notifyRoles(ctx, ["Finance"], {
              title: "Order confirmed",
              body: `${current.queryCode} has been confirmed by Sales.`,
              entityType: "query",
              entityId: queryId,
            }),
          ]
        : []),
      ...(isRevisionRequested ? [notifyProposalRevisionWorkflow(ctx, current, queryId)] : []),
      ...(isLost
        ? [
            notifyRoles(ctx, ["Contracting", "Contracting Head"], {
              title: "Order lost",
              body: `${current.queryCode} was marked lost by Sales.`,
              entityType: "query",
              entityId: queryId,
            }),
            notifyQueryOwner(ctx, current.contractingOwnerId, {
              title: "Order lost on your query",
              body: `${current.queryCode} was marked lost by Sales.`,
              entityType: "query",
              entityId: queryId,
            }),
            notifyQueryOwner(ctx, current.ticketingOwnerId, {
              title: "Order lost on your query",
              body: `${current.queryCode} was marked lost by Sales.`,
              entityType: "query",
              entityId: queryId,
            }),
          ]
        : []),
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

    const [legacyProposals, proposalLinksForQuery] = await Promise.all([
      ctx.db
        .query("proposals")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
      ctx.db
        .query("proposalQueryLinks")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
    ]);
    const proposalIds = new Set(legacyProposals.map((proposal) => proposal._id));
    for (const link of proposalLinksForQuery) {
      proposalIds.add(link.proposalId);
    }
    await Promise.all(
      Array.from(proposalIds).map(async (proposalId) => {
        const proposal = await ctx.db.get(proposalId);
        if (!proposal) return;
        const proposalLinks = await ctx.db
          .query("proposalQueryLinks")
          .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
          .collect();
        const linksForDeletedQuery = proposalLinks.filter((link) => link.queryId === queryId);
        const remainingLinks = proposalLinks.filter((link) => link.queryId !== queryId);
        await Promise.all(linksForDeletedQuery.map((link) => ctx.db.delete(link._id)));

        if (remainingLinks.length > 0 || (proposal.queryId && proposal.queryId !== queryId)) {
          if (proposal.queryId === queryId) {
            await ctx.db.patch(proposalId, {
              queryId: remainingLinks[0].queryId,
              updatedAt: Date.now(),
            });
          }
          return;
        }

        const { storageIds } = await ctx.runMutation(
          internal.crm.proposalAttachments.deleteAllForProposal,
          { proposalId },
        );
        if (proposal.finalizedPdfStorageId) {
          storageIds.push(proposal.finalizedPdfStorageId);
        }
        await Promise.all([
          ...storageIds.map((storageId: Id<"_storage">) =>
            ctx.storage.delete(storageId).catch((err) => {
              console.error("Failed to delete proposal attachment file:", err);
            }),
          ),
          deleteEntityNotifications(ctx, "proposal", proposalId),
          ctx.db.delete(proposalId),
        ]);
      }),
    );

    const assignments = await ctx.db
      .query("contractingAssignments")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    await Promise.all(assignments.map((assignment) => ctx.db.delete(assignment._id)));

    const jobCards = await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    await Promise.all(jobCards.map((jobCard) => deleteJobCardCascade(ctx, jobCard._id)));

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
