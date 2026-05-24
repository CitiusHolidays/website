import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  canActAsLeaveHeadReviewer,
  canHeadReview,
  createActivity,
  getHeadReviewerRolesForStaff,
  getLeaveApprovalActions,
  isHrReviewer,
  notifyRoles,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const leaveStatusValidator = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected"),
);

const leaveTypeValidator = v.union(
  v.literal("Casual"),
  v.literal("Sick"),
  v.literal("Privilege"),
  v.literal("Leave Without Pay"),
);

function canSeeLeave(access: any, leave: any, staff: any) {
  if (isHrReviewer(access)) {
    return true;
  }
  if (access.staffId && leave.staffId === access.staffId) {
    return true;
  }
  const reviewerRole =
    leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR";
  return canHeadReview(access, reviewerRole);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_LEAVE);
    const leaves = await ctx.db.query("staffLeaveRecords").collect();

    const result = [];
    for (const leave of leaves) {
      const staff = await ctx.db.get(leave.staffId);
      if (!staff || !canSeeLeave(access, leave, staff)) {
        continue;
      }
      result.push({
        id: leave._id,
        staffId: leave.staffId,
        staffName: staff.name,
        staffEmail: staff.email,
        department: staff.department || "General",
        leaveType: leave.leaveType ?? "Casual",
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        status: leave.status ?? "Pending",
        headReviewStatus: leave.headReviewStatus ?? "Pending",
        headReviewerRole:
          leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR",
        headReviewedByName: leave.headReviewedByName ?? "",
        headDecisionNote: leave.headDecisionNote ?? "",
        hrReviewStatus: leave.hrReviewStatus ?? "Pending",
        hrReviewedByName: leave.hrReviewedByName ?? "",
        decisionNote: leave.decisionNote ?? "",
        ...getLeaveApprovalActions(access, leave, staff),
        createdAt: new Date(leave.createdAt).toISOString(),
      });
    }

    return result.sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const create = mutation({
  args: {
    staffId: v.optional(v.string()),
    leaveType: v.optional(leaveTypeValidator),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
    status: v.optional(leaveStatusValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.REQUEST_LEAVE);
    const canRecordForOthers = isHrReviewer(access);

    let staffId = access.staffId;
    if (canRecordForOthers && args.staffId) {
      const normalizedStaffId = ctx.db.normalizeId("staffUsers", args.staffId);
      if (!normalizedStaffId) {
        throw new ConvexError("Invalid staff member ID");
      }
      staffId = normalizedStaffId;
    }

    if (!staffId) {
      throw new ConvexError("Staff profile not found for leave request");
    }

    const staff = await ctx.db.get(staffId);
    if (!staff) {
      throw new ConvexError("Staff member not found");
    }

    const now = Date.now();
    const reviewerRoles = getHeadReviewerRolesForStaff(staff);
    const headReviewerRole = reviewerRoles[0] ?? "HR";
    const directApproval =
      canRecordForOthers && args.status && args.status !== "Pending";
    const status = directApproval ? args.status! : "Pending";

    const id = await ctx.db.insert("staffLeaveRecords", {
      staffId,
      leaveType: args.leaveType ?? "Casual",
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason.trim(),
      status,
      headReviewStatus: directApproval ? status : "Pending",
      headReviewerRole: headReviewerRole as any,
      headReviewedBy: directApproval ? access.authUserId : undefined,
      headReviewedByName: directApproval ? access.name : undefined,
      headReviewedAt: directApproval ? now : undefined,
      hrReviewStatus: directApproval ? status : "Pending",
      hrReviewedBy: directApproval ? access.authUserId : undefined,
      hrReviewedByName: directApproval ? access.name : undefined,
      hrReviewedAt: directApproval ? now : undefined,
      createdBy: access.authUserId || "system",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: id,
      action: directApproval ? status.toLowerCase() : "requested",
      message: `Leave ${directApproval ? status.toLowerCase() : "requested"} for ${staff.name}: ${args.startDate} to ${args.endDate}`,
    });

    if (!directApproval) {
      await notifyRoles(ctx, Array.from(new Set([...reviewerRoles, "HR"])), {
        title: "Leave request pending",
        body: `${staff.name} requested ${args.leaveType ?? "Casual"} leave from ${args.startDate} to ${args.endDate}.`,
        entityType: "leave",
        entityId: id,
      });
    }

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
    if (args.status === "Pending") {
      throw new ConvexError("Choose Approved or Rejected");
    }
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.APPROVE_LEAVE,
      PERMISSIONS.MANAGE_LEAVE,
    ]);
    const leaveId = ctx.db.normalizeId("staffLeaveRecords", args.leaveId);
    if (!leaveId) {
      throw new ConvexError("Invalid leave ID");
    }
    const leave = await ctx.db.get(leaveId);
    if (!leave) {
      throw new ConvexError("Leave record not found");
    }
    const staff = await ctx.db.get(leave.staffId);
    if (!staff) {
      throw new ConvexError("Staff member not found");
    }

    const now = Date.now();
    const reviewerRole =
      leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR";
    const headStatus = leave.headReviewStatus ?? "Pending";
    const hrStatus = leave.hrReviewStatus ?? "Pending";
    const overallStatus = leave.status ?? "Pending";
    const note = args.decisionNote?.trim() || "";

    if (overallStatus !== "Pending") {
      throw new ConvexError("This leave request has already been decided");
    }

    const actions = getLeaveApprovalActions(access, leave, staff);
    const patch: Record<string, unknown> = { updatedAt: now };
    let stage = "hr_reviewed";

    if (headStatus !== "Approved") {
      if (args.status === "Approved" && !actions.canApproveHead) {
        throw new ConvexError("Department head approval is required before HR review");
      }
      if (args.status === "Rejected" && !actions.canReject) {
        throw new ConvexError("FORBIDDEN");
      }
      if (!canActAsLeaveHeadReviewer(access, reviewerRole)) {
        throw new ConvexError("FORBIDDEN");
      }
      if (headStatus !== "Pending") {
        throw new ConvexError("Head review has already been completed");
      }

      stage = "head_reviewed";
      patch.headReviewStatus = args.status;
      patch.headReviewedBy = access.authUserId;
      patch.headReviewedByName = access.name;
      patch.headReviewedAt = now;
      patch.headDecisionNote = note;
      if (args.status === "Rejected") {
        patch.status = "Rejected";
        patch.hrReviewStatus = "Rejected";
        patch.decisionNote = note;
      } else if (reviewerRole === "HR") {
        patch.status = "Approved";
        patch.hrReviewStatus = "Approved";
        patch.hrReviewedBy = access.authUserId;
        patch.hrReviewedByName = access.name;
        patch.hrReviewedAt = now;
        patch.decisionNote = note;
      } else {
        patch.status = "Pending";
        patch.hrReviewStatus = "Pending";
      }
    } else {
      if (!actions.canApproveHr && !actions.canReject) {
        throw new ConvexError("HR final approval is required");
      }
      if (hrStatus !== "Pending") {
        throw new ConvexError("HR review has already been completed");
      }
      patch.hrReviewStatus = args.status;
      patch.hrReviewedBy = access.authUserId;
      patch.hrReviewedByName = access.name;
      patch.hrReviewedAt = now;
      patch.status = args.status;
      patch.decisionNote = note;
    }

    await ctx.db.patch(leaveId, patch);
    await createActivity(ctx, access, {
      entityType: "leave",
      entityId: leaveId,
      action: stage,
      message: `Leave for ${staff.name} ${args.status.toLowerCase()} at ${stage === "head_reviewed" ? "head review" : "HR final review"}`,
      metadata: patch,
    });

    if (stage === "head_reviewed" && args.status === "Approved") {
      await notifyRoles(ctx, ["HR"], {
        title: "Leave ready for HR approval",
        body: `${staff.name}'s leave request has department head approval.`,
        entityType: "leave",
        entityId: leaveId,
      });
    }

    return { id: leaveId };
  },
});

export const update = mutation({
  args: {
    leaveId: v.string(),
    leaveType: v.optional(leaveTypeValidator),
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
    const canManage = isHrReviewer(access);
    if (!canManage && leave.staffId !== access.staffId) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canManage && leave.status !== "Pending") {
      throw new ConvexError("Only pending leave requests can be edited");
    }
    const patch: Record<string, string | number> = { updatedAt: Date.now() };
    if (args.leaveType !== undefined) patch.leaveType = args.leaveType;
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    if (args.reason !== undefined) patch.reason = args.reason.trim();
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
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_LEAVE,
      PERMISSIONS.MANAGE_STAFF,
    ]);

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
