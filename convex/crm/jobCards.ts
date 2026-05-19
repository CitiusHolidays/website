import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  createActivity,
  deleteJobCardCascade,
  nextCode,
  notifyRoles,
  paymentTermsFor,
  publicJobCard,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const DEFAULT_CHECKLIST = [
  { key: "handover", label: "Sales/Contracting handover acknowledged", done: false },
  { key: "masterSheet", label: "Master sheet prepared", done: false },
  { key: "visaDocs", label: "Visa documents verified", done: false },
  { key: "flights", label: "Flights and tickets confirmed", done: false },
  { key: "hotel", label: "Hotel and rooming list confirmed", done: false },
  { key: "tmBriefing", label: "Tour manager briefing completed", done: false },
  { key: "finalKit", label: "Final travel kit shared", done: false },
  { key: "financeClosure", label: "Final invoice and balance closure", done: false },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
    const rows = await ctx.db.query("jobCards").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map(publicJobCard);
  },
});

export const createFromQuery = mutation({
  args: {
    queryId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    destination: v.optional(v.string()),
    confirmedPax: v.number(),
    roomCount: v.optional(v.number()),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS);
    if (args.confirmedPax < 1) {
      throw new ConvexError("Confirmed pax must be greater than zero");
    }

    const queryId = args.queryId ? ctx.db.normalizeId("queries", args.queryId) : null;
    const linkedQuery = queryId ? await ctx.db.get(queryId) : null;
    if (args.queryId && !linkedQuery) {
      throw new ConvexError("Linked query not found");
    }
    if (
      linkedQuery &&
      linkedQuery.salesStatus !== "Order Confirmed" &&
      linkedQuery.contractingStatus !== "Order Confirmed"
    ) {
      throw new ConvexError("Accounts can open a Job Card only after order confirmation");
    }

    const now = Date.now();
    const jobCode = await nextCode(ctx, "jobCards", "JC");
    const queryType = linkedQuery?.queryType;
    const id = await ctx.db.insert("jobCards", {
      jobCode,
      queryId: queryId ?? undefined,
      clientName: linkedQuery?.clientName || args.clientName?.trim() || "Direct Job",
      destination: linkedQuery?.destination || args.destination?.trim() || "",
      confirmedPax: args.confirmedPax,
      roomCount: args.roomCount ?? 0,
      travelStartDate: linkedQuery?.travelStartDate || args.travelStartDate || "",
      travelEndDate: linkedQuery?.travelEndDate || args.travelEndDate || "",
      queryType: queryType as any,
      paymentTerms: queryType ? paymentTermsFor(queryType) : null,
      tourManagerName: args.tourManagerName?.trim() || "",
      status: "Open",
      preDepartureChecklist: DEFAULT_CHECKLIST,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "created",
      message: `${jobCode} opened for ${linkedQuery?.clientName || args.clientName || "client"}`,
    });
    await notifyRoles(ctx, [
      "Sales",
      "Sales Head",
      "Contracting",
      "Contracting Head",
      "Operations Head",
      "Ticketing",
      "Head of Ticketing",
      "Finance",
    ], {
      title: "Job Card opened",
      body: `${jobCode} has been created and is ready for operations.`,
      entityType: "jobCard",
      entityId: id,
    });

    return { id, jobCode };
  },
});

export const updateChecklist = mutation({
  args: {
    jobCardId: v.string(),
    checklist: v.any(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    await ctx.db.patch(id, {
      preDepartureChecklist: args.checklist,
      updatedAt: Date.now(),
    });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "checklist_updated",
      message: `${job.jobCode} checklist updated`,
    });
    return { id };
  },
});

export const updateStatus = mutation({
  args: {
    jobCardId: v.string(),
    status: v.union(
      v.literal("Open"),
      v.literal("In Operations"),
      v.literal("Ready for Departure"),
      v.literal("On Tour"),
      v.literal("Closed"),
    ),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    await ctx.db.patch(id, { status: args.status, updatedAt: Date.now() });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "status_updated",
      message: `${job.jobCode} moved to ${args.status}`,
    });
    return { id };
  },
});

export const remove = mutation({
  args: {
    jobCardId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "deleted",
      message: `${job.jobCode} deleted`,
    });
    await deleteJobCardCascade(ctx, id);
    return { id };
  },
});
