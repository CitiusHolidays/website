import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { PERMISSIONS, createActivity, requireStaff } from "./lib";

const leaveStatusValidator = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TEAM);
    const leaves = await ctx.db.query("staffLeaveRecords").collect();

    const result = [];
    for (const leave of leaves) {
      const staff = await ctx.db.get(leave.staffId);
      if (staff) {
        result.push({
          id: leave._id,
          staffId: leave.staffId,
          staffName: staff.name,
          staffEmail: staff.email,
          department: staff.department || "General",
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: leave.reason,
          status: leave.status,
          decisionNote: leave.decisionNote ?? "",
          createdAt: new Date(leave.createdAt).toISOString(),
        });
      }
    }

    return result.sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const create = mutation({
  args: {
    staffId: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.REQUEST_LEAVE);
    const isAdmin = access.permissions.includes(PERMISSIONS.MANAGE_STAFF);

    let staffId = access.staffId;
    let status = "Pending";

    if (isAdmin && args.staffId) {
      const normalizedStaffId = ctx.db.normalizeId("staffUsers", args.staffId);
      if (!normalizedStaffId) {
        throw new ConvexError("Invalid staff member ID");
      }
      staffId = normalizedStaffId;
      status = args.status || "Approved";
    }

    if (!staffId) {
      throw new ConvexError("Staff profile not found for leave request");
    }

    const staff = await ctx.db.get(staffId);
    if (!staff) {
      throw new ConvexError("Staff member not found");
    }

    const now = Date.now();
    const id = await ctx.db.insert("staffLeaveRecords", {
      staffId,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status,
      createdBy: access.authUserId || "system",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: id,
      action: "created",
      message: `Leave ${status === "Pending" ? "requested" : "recorded"} for ${staff.name}: ${args.startDate} to ${args.endDate}`,
    });

    return { id };
  },
});

export const decide = mutation({
  args: {
    leaveId: v.string(),
    status: leaveStatusValidator,
    decisionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const leaveId = ctx.db.normalizeId("staffLeaveRecords", args.leaveId);
    if (!leaveId) {
      throw new ConvexError("Invalid leave ID");
    }
    const leave = await ctx.db.get(leaveId);
    if (!leave) {
      throw new ConvexError("Leave record not found");
    }
    const staff = await ctx.db.get(leave.staffId);
    const now = Date.now();
    await ctx.db.patch(leaveId, {
      status: args.status,
      decisionNote: args.decisionNote?.trim() || "",
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: leaveId,
      action: args.status.toLowerCase(),
      message: `Leave for ${staff?.name || "staff"} ${args.status.toLowerCase()}`,
    });
    return { id: leaveId };
  },
});

export const update = mutation({
  args: {
    leaveId: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.REQUEST_LEAVE);
    const leaveId = ctx.db.normalizeId("staffLeaveRecords", args.leaveId);
    if (!leaveId) {
      throw new ConvexError("Invalid leave ID");
    }
    const leave = await ctx.db.get(leaveId);
    if (!leave) {
      throw new ConvexError("Leave record not found");
    }
    const isAdmin = access.permissions.includes(PERMISSIONS.MANAGE_STAFF);
    if (!isAdmin && leave.staffId !== access.staffId) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!isAdmin && leave.status !== "Pending") {
      throw new ConvexError("Only pending leave requests can be edited");
    }
    const patch: Record<string, string | number> = { updatedAt: Date.now() };
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    if (args.reason !== undefined) patch.reason = args.reason;
    await ctx.db.patch(leaveId, patch);
    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: leaveId,
      action: "updated",
      message: `Leave record updated for ${leave.staffId}`,
    });
    return { id: leaveId };
  },
});

export const remove = mutation({
  args: {
    leaveId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);

    const leaveId = ctx.db.normalizeId("staffLeaveRecords", args.leaveId);
    if (!leaveId) {
      throw new ConvexError("Invalid leave ID");
    }

    const leave = await ctx.db.get(leaveId);
    if (!leave) {
      throw new ConvexError("Leave record not found");
    }

    const staff = await ctx.db.get(leave.staffId);

    await ctx.db.delete(leaveId);

    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: leaveId,
      action: "deleted",
      message: `Leave record deleted for ${staff?.name || "unknown staff"}`,
    });

    return { id: leaveId };
  },
});
