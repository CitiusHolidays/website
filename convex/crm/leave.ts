import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { PERMISSIONS, createActivity, requireStaff } from "./lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Requires VIEW_TEAM permission
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
          createdAt: new Date(leave.createdAt).toISOString(),
        });
      }
    }
    
    // Sort by startDate descending (latest first)
    return result.sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const create = mutation({
  args: {
    staffId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Requires MANAGE_STAFF permission (Admin/HR)
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new Error("Invalid staff member ID");
    }
    
    const staff = await ctx.db.get(staffId);
    if (!staff) {
      throw new Error("Staff member not found");
    }
    
    const now = Date.now();
    const id = await ctx.db.insert("staffLeaveRecords", {
      staffId,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status: args.status || "Approved",
      createdBy: access.authUserId || "system",
      createdAt: now,
      updatedAt: now,
    });
    
    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: id,
      action: "created",
      message: `Leave recorded for ${staff.name}: ${args.startDate} to ${args.endDate}`,
    });
    
    return { id };
  },
});

export const remove = mutation({
  args: {
    leaveId: v.string(),
  },
  handler: async (ctx, args) => {
    // Requires MANAGE_STAFF permission
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    
    const leaveId = ctx.db.normalizeId("staffLeaveRecords", args.leaveId);
    if (!leaveId) {
      throw new Error("Invalid leave ID");
    }
    
    const leave = await ctx.db.get(leaveId);
    if (!leave) {
      throw new Error("Leave record not found");
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
