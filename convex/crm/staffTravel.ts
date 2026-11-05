import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { checkedTravelDates, staffTravelOutputValidator } from "../lib/teamTravelValidators";
import { getVisibleJob } from "./jobCardVisibility";
import { createActivity } from "./lib/activity";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { PERMISSIONS } from "./lib/rolePolicy";
import { isDirectorOrAdmin, type PortalAccess, requireStaff } from "./lib/staffAccess";
import { boundedPaginationOptions, mapInBoundedBatches } from "./paginationPolicy";

function canManageOthers(access: PortalAccess) {
  return (
    isDirectorOrAdmin(access) ||
    access.roles.includes("HR") ||
    access.roles.includes("Operations Head")
  );
}

async function travelOutput(
  ctx: QueryCtx,
  access: PortalAccess,
  row: Doc<"staffTravelPlans">,
  referenceDate: string
) {
  const staff = await ctx.db.get("staffUsers", row.staffId);
  if (!staff?.active) {
    return null;
  }
  const job =
    row.jobCardId && access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)
      ? await getVisibleJob(ctx, access, row.jobCardId)
      : null;
  return {
    canManage: row.staffId === access.staffId || canManageOthers(access),
    createdAt: row.createdAt,
    destination: row.destination,
    endDate: row.endDate,
    id: row._id,
    isCurrent:
      row.status === "planned" && row.startDate <= referenceDate && row.endDate >= referenceDate,
    jobCardId: job?._id ?? null,
    jobCode: job?.jobCode ?? "",
    personName: staff.name,
    staffId: row.staffId,
    startDate: row.startDate,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

export const getAccess = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    return { canManageOthers: canManageOthers(access), staffId: access.staffId ?? null };
  },
  returns: v.object({
    canManageOthers: v.boolean(),
    staffId: v.union(v.id("staffUsers"), v.null()),
  }),
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, referenceDate: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    checkedTravelDates(args.referenceDate, args.referenceDate);
    const result = await ctx.db
      .query("staffTravelPlans")
      .withIndex("by_status_and_endDate", (q) =>
        q.eq("status", "planned").gte("endDate", args.referenceDate)
      )
      .order("asc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const page = await mapInBoundedBatches(result.page, (row) =>
      travelOutput(ctx, access, row, args.referenceDate)
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
  returns: paginationResultValidator(staffTravelOutputValidator),
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator, referenceDate: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    checkedTravelDates(args.referenceDate, args.referenceDate);
    if (!access.staffId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const { staffId } = access;
    const result = await ctx.db
      .query("staffTravelPlans")
      .withIndex("by_staffId_and_createdAt", (q) => q.eq("staffId", staffId))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const page = await mapInBoundedBatches(result.page, (row) =>
      travelOutput(ctx, access, row, args.referenceDate)
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
  returns: paginationResultValidator(staffTravelOutputValidator),
});

export const listPeople = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    if (!canManageOthers(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const result = await ctx.db
      .query("staffUsers")
      .withIndex("by_active_and_createdAt", (q) => q.eq("active", true))
      .paginate(boundedPaginationOptions(args.paginationOpts));
    return { ...result, page: result.page.map((staff) => ({ id: staff._id, name: staff.name })) };
  },
  returns: paginationResultValidator(v.object({ id: v.id("staffUsers"), name: v.string() })),
});

export const listJobOptions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    if (!access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const result = await ctx.db
      .query("jobCards")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const page = await mapInBoundedBatches(result.page, async (row) => {
      const job = await getVisibleJob(ctx, access, row._id);
      return job
        ? { destination: job.destination ?? "", jobCardId: job._id, jobCode: job.jobCode }
        : null;
    });
    return { ...result, page: page.filter((row) => row !== null) };
  },
  returns: paginationResultValidator(
    v.object({ destination: v.string(), jobCardId: v.id("jobCards"), jobCode: v.string() })
  ),
});

function checkedDestination(value: string) {
  const destination = value.trim();
  if (!destination || destination.length > 160) {
    throw new ConvexError("Enter a destination of 1 to 160 characters");
  }
  return destination;
}

async function checkedJob(
  ctx: MutationCtx,
  access: PortalAccess,
  rawId: string | undefined,
  existing?: Id<"jobCards">
) {
  if (rawId === undefined) {
    return existing;
  }
  if (!rawId) {
    return;
  }
  if (rawId === existing) {
    return existing;
  }
  const id = ctx.db.normalizeId("jobCards", rawId);
  if (
    !(
      id &&
      access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS) &&
      (await getVisibleJob(ctx, access, id))
    )
  ) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  return id;
}

async function editableTravel(ctx: MutationCtx, travelId: Id<"staffTravelPlans">) {
  const access = await requireStaff(ctx);
  const record = await ctx.db.get("staffTravelPlans", travelId);
  if (!record) {
    throw new ConvexError("Travel plan not found");
  }
  if (record.staffId !== access.staffId && !canManageOthers(access)) {
    throw new ConvexError("FORBIDDEN");
  }
  return { access, record };
}

const travelFields = {
  destination: v.string(),
  endDate: v.string(),
  jobCardId: v.optional(v.string()),
  startDate: v.string(),
};

export const create = mutation({
  args: { ...travelFields, staffId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const staffId = args.staffId ? ctx.db.normalizeId("staffUsers", args.staffId) : access.staffId;
    if (!staffId || (staffId !== access.staffId && !canManageOthers(access))) {
      throw new ConvexError("FORBIDDEN");
    }
    const staff = await ctx.db.get("staffUsers", staffId);
    if (!staff?.active) {
      throw new ConvexError("Active staff member not found");
    }
    checkedTravelDates(args.startDate, args.endDate);
    const jobCardId = await checkedJob(ctx, access, args.jobCardId);
    const actor = access.authUserId ?? "system";
    const now = Date.now();
    const id = await insertWithE2eOwnership(
      ctx,
      "staffTravelPlans",
      {
        createdAt: now,
        createdBy: actor,
        destination: checkedDestination(args.destination),
        endDate: args.endDate,
        jobCardId,
        staffId,
        startDate: args.startDate,
        status: "planned",
        updatedAt: now,
        updatedBy: actor,
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "staffTravel",
      message: `Travel plan recorded for ${staff.name}`,
    });
    return { id };
  },
  returns: v.object({ id: v.id("staffTravelPlans") }),
});

export const update = mutation({
  args: { ...travelFields, travelId: v.id("staffTravelPlans") },
  handler: async (ctx, args) => {
    const { access, record } = await editableTravel(ctx, args.travelId);
    if (record.status === "cancelled") {
      throw new ConvexError("This travel plan is cancelled. Record a new plan instead.");
    }
    checkedTravelDates(args.startDate, args.endDate);
    await patchWithE2eOwnership(
      ctx,
      "staffTravelPlans",
      record._id,
      {
        destination: checkedDestination(args.destination),
        endDate: args.endDate,
        jobCardId: await checkedJob(ctx, access, args.jobCardId, record.jobCardId),
        startDate: args.startDate,
        updatedAt: Date.now(),
        updatedBy: access.authUserId ?? "system",
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "updated",
      entityId: record._id,
      entityType: "staffTravel",
      message: "Travel plan updated",
    });
    return { id: record._id };
  },
  returns: v.object({ id: v.id("staffTravelPlans") }),
});

export const cancel = mutation({
  args: { travelId: v.id("staffTravelPlans") },
  handler: async (ctx, args) => {
    const { access, record } = await editableTravel(ctx, args.travelId);
    if (record.status !== "cancelled") {
      await patchWithE2eOwnership(
        ctx,
        "staffTravelPlans",
        record._id,
        { status: "cancelled", updatedAt: Date.now(), updatedBy: access.authUserId ?? "system" },
        { authUserId: access.authUserId }
      );
      await createActivity(ctx, access, {
        action: "cancelled",
        entityId: record._id,
        entityType: "staffTravel",
        message: "Travel plan cancelled",
      });
    }
    return { id: record._id };
  },
  returns: v.object({ id: v.id("staffTravelPlans") }),
});
