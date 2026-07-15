import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  canApproveLeaveAsHead,
  getLeaveApprovalActionsForApprover,
  notifyLeaveReadyForFinalAuthority,
  notifyLeaveReadyForHr,
  notifyLeaveRequestSubmitted,
  primaryHeadRoleForStaff,
  resolveLeaveFinalAuthorityId,
  resolveLeaveHeadApproverId,
  resolveLeaveHrCopyStaffId,
} from "./leaveApprovers";
import {
  calculateLeaveDecision,
  fiscalYearForDate,
  inclusiveLeaveDays,
  initialBalanceRows,
  LEAVE_TYPES,
  type LeaveType,
} from "./leavePolicy";
import {
  assertDateRangeOrder,
  canHeadReview,
  createActivity,
  getHeadReviewerRolesForStaff,
  isDefined,
  isHrReviewer,
  PERMISSIONS,
  requireAnyPermission,
  requireStaff,
} from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import {
  leaveBalanceListResultValidator,
  leaveIdResultValidator,
  leaveListPageResultValidator,
} from "./peopleWorkflowReturnContracts";

const leaveStatusValidator = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected")
);

const leaveTypeValidator = v.union(
  v.literal("Privilege"),
  v.literal("Casual"),
  v.literal("Sick"),
  v.literal("Maternity"),
  v.literal("Paternity"),
  v.literal("Bereavement"),
  v.literal("Marriage"),
  v.literal("Leave Without Pay")
);

function ensureLeaveType(value: string): LeaveType {
  if ((LEAVE_TYPES as readonly string[]).includes(value)) {
    return value as LeaveType;
  }
  return "Casual";
}

async function balanceMapForStaff(ctx: any, staff: any, fiscalYear: string, startDate: string) {
  const balances = await ctx.db
    .query("staffLeaveBalances")
    .withIndex("by_staffId_and_fiscalYear", (q: any) =>
      q.eq("staffId", staff._id).eq("fiscalYear", fiscalYear)
    )
    .collect();
  const map: Record<string, number> = {};
  for (const row of initialBalanceRows(staff._id, staff, fiscalYear)) {
    map[row.leaveType] = row.availableDays;
  }
  for (const row of balances) {
    map[row.leaveType] = row.availableDays;
  }
  const ledger = await ctx.db
    .query("staffLeaveLedger")
    .withIndex("by_staffId_and_fiscalYear", (q: any) =>
      q.eq("staffId", staff._id).eq("fiscalYear", fiscalYear)
    )
    .collect();
  const debitEntryTypes = new Set(["usage", "lapse", "encashment"]);
  if (balances.length === 0 && ledger.length > 0) {
    for (const row of ledger) {
      const current = map[row.leaveType] ?? 0;
      const sign = debitEntryTypes.has(row.entryType) ? -1 : 1;
      map[row.leaveType] = current + row.days * sign;
    }
  }
  for (const leaveType of LEAVE_TYPES) {
    if (leaveType === "Leave Without Pay") {
      continue;
    }
    if (map[leaveType] === undefined) {
      const decision = calculateLeaveDecision({
        balances: {},
        endDate: startDate,
        leaveType,
        staff,
        startDate,
      });
      map[leaveType] = decision.allowed ? decision.balanceAfter + 1 : 0;
    }
  }
  return map;
}

async function upsertLeaveBalance(
  ctx: any,
  staff: any,
  fiscalYear: string,
  leaveType: LeaveType,
  deltaUsedDays: number
) {
  if (leaveType === "Leave Without Pay") {
    return;
  }
  const existing = await ctx.db
    .query("staffLeaveBalances")
    .withIndex("by_staffId_and_fiscalYear_and_leaveType", (q: any) =>
      q.eq("staffId", staff._id).eq("fiscalYear", fiscalYear).eq("leaveType", leaveType)
    )
    .first();
  const base =
    existing ??
    initialBalanceRows(staff._id, staff, fiscalYear).find((row) => row.leaveType === leaveType);
  if (!base) {
    return;
  }
  const now = Date.now();
  const usedDays = Math.max((base.usedDays ?? 0) + deltaUsedDays, 0);
  const availableDays = Math.max(
    (base.openingDays ?? 0) +
      (base.accruedDays ?? 0) +
      (base.carriedForwardDays ?? 0) -
      usedDays -
      (base.encashableDays ?? 0),
    0
  );
  const patch = {
    accruedDays: base.accruedDays ?? 0,
    availableDays,
    carriedForwardDays: base.carriedForwardDays ?? 0,
    encashableDays: base.encashableDays ?? 0,
    openingDays: base.openingDays ?? 0,
    updatedAt: now,
    usedDays,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  await ctx.db.insert("staffLeaveBalances", {
    fiscalYear,
    leaveType,
    staffId: staff._id,
    ...patch,
  });
}

async function ledgerUsageForApprovedLeave(ctx: any, access: any, leave: any, staff: any) {
  const leaveType = ensureLeaveType(leave.leaveType ?? "Casual");
  const fiscalYear = fiscalYearForDate(leave.startDate);
  const existing = await ctx.db
    .query("staffLeaveLedger")
    .withIndex("by_leaveRecordId", (q: any) => q.eq("leaveRecordId", leave._id))
    .collect();
  if (existing.some((entry: any) => entry.entryType === "usage")) {
    return;
  }
  const days = inclusiveLeaveDays(leave.startDate, leave.endDate);
  await ctx.db.insert("staffLeaveLedger", {
    createdAt: Date.now(),
    createdBy: access.authUserId ?? "system",
    days,
    entryType: "usage",
    fiscalYear,
    leaveRecordId: leave._id,
    leaveType,
    note: `Approved leave: ${leave.reason || ""}`.trim(),
    staffId: staff._id,
  });
  await upsertLeaveBalance(ctx, staff, fiscalYear, leaveType, days);
}

async function canSeeLeave(
  ctx: any,
  access: any,
  leave: any,
  staff: any,
  staffRows: any[],
  approverCache: Map<string, any>
) {
  if (isHrReviewer(access)) {
    return true;
  }
  if (access.staffId && leave.staffId === access.staffId) {
    return true;
  }
  const cacheKey = String(staff._id);
  let resolvedApproverId = approverCache.get(cacheKey);
  if (resolvedApproverId === undefined) {
    resolvedApproverId = await resolveLeaveHeadApproverId(ctx, staff, staffRows);
    approverCache.set(cacheKey, resolvedApproverId);
  }
  if (resolvedApproverId && access.staffId && access.staffId === resolvedApproverId) {
    return true;
  }
  const finalAuthorityId = await resolveLeaveFinalAuthorityId(
    ctx,
    staff,
    resolvedApproverId,
    staffRows
  );
  if (finalAuthorityId && access.staffId && access.staffId === finalAuthorityId) {
    return true;
  }
  const reviewerRole = leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR";
  return canHeadReview(access, reviewerRole);
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    staffId: v.optional(v.string()),
    status: v.optional(leaveStatusValidator),
  },
  handler: async (ctx, args) => {
    const [access, staffRows, page] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_LEAVE),
      ctx.db.query("staffUsers").withIndex("by_name").take(500),
      applyCrmCursorFilters(
        ctx.db.query("staffLeaveRecords").withIndex("by_createdAt").order("desc"),
        { equals: { staffId: args.staffId, status: args.status } }
      ).paginate(boundedPaginationOptions(args.paginationOpts)),
    ]);
    const approverCache = new Map<string, any>();

    const result = await mapInBoundedBatches(page.page, async (leave) => {
      const staff = await ctx.db.get(leave.staffId);
      if (!(staff && (await canSeeLeave(ctx, access, leave, staff, staffRows, approverCache)))) {
        return null;
      }
      const resolvedApproverId = await resolveLeaveHeadApproverId(ctx, staff, staffRows);
      const headApproverId = leave.headApproverStaffId ?? resolvedApproverId ?? undefined;
      const finalAuthorityId =
        leave.finalAuthorityStaffId ??
        (await resolveLeaveFinalAuthorityId(ctx, staff, resolvedApproverId, staffRows)) ??
        undefined;
      const hrCopyStaffId =
        leave.hrCopyStaffId ??
        (await resolveLeaveHrCopyStaffId(ctx, staff, staffRows)) ??
        undefined;
      const headApprover = headApproverId ? await ctx.db.get(headApproverId) : null;
      const finalAuthority = finalAuthorityId ? await ctx.db.get(finalAuthorityId) : null;
      const hrCopyStaff = hrCopyStaffId ? await ctx.db.get(hrCopyStaffId) : null;
      return {
        days: inclusiveLeaveDays(leave.startDate, leave.endDate),
        decisionNote: leave.decisionNote ?? "",
        department: staff.department || "General",
        endDate: leave.endDate,
        finalAuthorityName:
          leave.finalAuthorityName ??
          finalAuthority?.name ??
          (finalAuthorityId ? "Not assigned" : ""),
        finalAuthorityStaffId: finalAuthorityId,
        finalDecisionNote: leave.finalDecisionNote ?? "",
        finalReviewedByName: leave.finalReviewedByName ?? "",
        finalReviewStatus: finalAuthorityId
          ? (leave.finalReviewStatus ?? "Pending")
          : (leave.finalReviewStatus ?? "Approved"),
        fiscalYear: fiscalYearForDate(leave.startDate),
        headApproverName: leave.headApproverName ?? headApprover?.name ?? "Not assigned",
        headApproverStaffId: headApproverId,
        headDecisionNote: leave.headDecisionNote ?? "",
        headReviewedByName: leave.headReviewedByName ?? "",
        headReviewerRole: leave.headReviewerRole ?? primaryHeadRoleForStaff(staff),
        headReviewStatus: leave.headReviewStatus ?? "Pending",
        hrCopyName: leave.hrCopyName ?? hrCopyStaff?.name ?? "",
        hrCopyStaffId,
        hrReviewedByName: leave.hrReviewedByName ?? "",
        hrReviewStatus: leave.hrReviewStatus ?? "Pending",
        id: leave._id,
        leaveType: leave.leaveType ?? "Casual",
        reason: leave.reason,
        staffEmail: staff.email,
        staffId: leave.staffId,
        staffName: staff.name,
        startDate: leave.startDate,
        status: leave.status ?? "Pending",
        ...getLeaveApprovalActionsForApprover(
          access,
          leave,
          staff,
          resolvedApproverId,
          finalAuthorityId ?? null,
          isHrReviewer
        ),
        createdAt: new Date(leave.createdAt).toISOString(),
      };
    });

    return { ...page, page: compactPageItems(result.filter(isDefined)) };
  },
  returns: leaveListPageResultValidator,
});

type CreateLeaveArgs = {
  staffId?: string;
  leaveType?: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status?: "Pending" | "Approved" | "Rejected";
};

export async function createLeaveRequest(ctx: MutationCtx, args: CreateLeaveArgs) {
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

  const [staff, staffRows] = await Promise.all([
    ctx.db.get(staffId),
    ctx.db.query("staffUsers").collect(),
  ]);
  if (!staff) {
    throw new ConvexError("Staff member not found");
  }

  const now = Date.now();
  const headApproverId = await resolveLeaveHeadApproverId(ctx, staff, staffRows);
  const [finalAuthorityId, hrCopyStaffId] = await Promise.all([
    resolveLeaveFinalAuthorityId(ctx, staff, headApproverId, staffRows),
    resolveLeaveHrCopyStaffId(ctx, staff, staffRows),
  ]);
  const leaveType = ensureLeaveType(args.leaveType ?? "Casual");
  assertDateRangeOrder(args.startDate, args.endDate, "Leave start date", "Leave end date");
  const fiscalYear = fiscalYearForDate(args.startDate);
  const [headApprover, finalAuthority, hrCopyStaff, balances] = await Promise.all([
    headApproverId ? ctx.db.get(headApproverId) : Promise.resolve(null),
    finalAuthorityId ? ctx.db.get(finalAuthorityId) : Promise.resolve(null),
    hrCopyStaffId ? ctx.db.get(hrCopyStaffId) : Promise.resolve(null),
    balanceMapForStaff(ctx, staff, fiscalYear, args.startDate),
  ]);
  const headReviewerRole = headApprover
    ? primaryHeadRoleForStaff(headApprover)
    : primaryHeadRoleForStaff(staff);
  const decision = calculateLeaveDecision({
    balances,
    endDate: args.endDate,
    leaveType,
    staff,
    startDate: args.startDate,
  });
  if (!decision.allowed) {
    throw new ConvexError(decision.reason);
  }

  const id = await ctx.db.insert("staffLeaveRecords", {
    createdAt: now,
    createdBy: access.authUserId || "system",
    endDate: args.endDate,
    finalAuthorityName: finalAuthority?.name ?? "",
    finalAuthorityStaffId: finalAuthorityId ?? undefined,
    finalReviewStatus: finalAuthorityId ? "Pending" : "Approved",
    headApproverName: headApprover?.name ?? "",
    headApproverStaffId: headApproverId ?? undefined,
    headReviewerRole: headReviewerRole as any,
    headReviewStatus: "Pending",
    hrCopyName: hrCopyStaff?.name ?? "",
    hrCopyStaffId: hrCopyStaffId ?? undefined,
    hrReviewStatus: "Pending",
    leaveType,
    reason: args.reason.trim(),
    staffId,
    startDate: args.startDate,
    status: "Pending",
    updatedAt: now,
  });

  await Promise.all([
    createActivity(ctx, access, {
      action: "requested",
      entityId: id,
      entityType: "leave",
      message: `Leave requested for ${staff.name}: ${args.startDate} to ${args.endDate}`,
    }),
    notifyLeaveRequestSubmitted(ctx, {
      endDate: args.endDate,
      headApproverId,
      hrCopyStaffId,
      leaveId: id,
      leaveType: args.leaveType ?? "Casual",
      staff,
      startDate: args.startDate,
    }),
  ]);

  return { id };
}

export const create = mutation({
  args: {
    endDate: v.string(),
    leaveType: v.optional(leaveTypeValidator),
    reason: v.string(),
    staffId: v.optional(v.string()),
    startDate: v.string(),
    status: v.optional(leaveStatusValidator),
  },
  handler: createLeaveRequest,
  returns: leaveIdResultValidator,
});

type DecideLeaveArgs = {
  leaveId: string;
  status: "Pending" | "Approved" | "Rejected";
  decisionNote?: string;
};

export async function decideLeaveRequest(ctx: MutationCtx, args: DecideLeaveArgs) {
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
  const staffRows = await ctx.db.query("staffUsers").collect();
  const resolvedApproverId =
    leave.headApproverStaffId ?? (await resolveLeaveHeadApproverId(ctx, staff, staffRows));
  const finalAuthorityId =
    leave.finalAuthorityStaffId ??
    (await resolveLeaveFinalAuthorityId(ctx, staff, resolvedApproverId, staffRows));
  const hrCopyStaffId =
    leave.hrCopyStaffId ?? (await resolveLeaveHrCopyStaffId(ctx, staff, staffRows));
  const headStatus = leave.headReviewStatus ?? "Pending";
  const finalStatus = finalAuthorityId ? (leave.finalReviewStatus ?? "Pending") : "Approved";
  const hrStatus = leave.hrReviewStatus ?? "Pending";
  const overallStatus = leave.status ?? "Pending";
  const note = args.decisionNote?.trim() || "";

  if (overallStatus !== "Pending") {
    throw new ConvexError("This leave request has already been decided");
  }

  const actions = getLeaveApprovalActionsForApprover(
    access,
    leave,
    staff,
    resolvedApproverId,
    finalAuthorityId,
    isHrReviewer
  );
  const patch: Record<string, unknown> = { updatedAt: now };
  let stage = "hr_reviewed";

  if (headStatus !== "Approved") {
    if (args.status === "Approved" && !actions.canApproveHead) {
      throw new ConvexError("Department head approval is required before HR review");
    }
    if (args.status === "Rejected" && !actions.canReject) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canApproveLeaveAsHead(access, leave, staff, resolvedApproverId)) {
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
      patch.finalReviewStatus = "Rejected";
      patch.hrReviewStatus = "Rejected";
      patch.decisionNote = note;
    } else {
      patch.status = "Pending";
      patch.finalReviewStatus = finalAuthorityId ? "Pending" : "Approved";
      patch.hrReviewStatus = "Pending";
    }
  } else if (finalAuthorityId && finalStatus !== "Approved") {
    if (args.status === "Approved" && !actions.canApproveFinal) {
      throw new ConvexError("Final authority approval is required before HR review");
    }
    if (args.status === "Rejected" && !actions.canReject) {
      throw new ConvexError("FORBIDDEN");
    }
    if (finalStatus !== "Pending") {
      throw new ConvexError("Final authority review has already been completed");
    }

    stage = "final_reviewed";
    patch.finalReviewStatus = args.status;
    patch.finalReviewedBy = access.authUserId;
    patch.finalReviewedByName = access.name;
    patch.finalReviewedAt = now;
    patch.finalDecisionNote = note;
    if (args.status === "Rejected") {
      patch.status = "Rejected";
      patch.hrReviewStatus = "Rejected";
      patch.decisionNote = note;
    } else {
      patch.status = "Pending";
      patch.hrReviewStatus = "Pending";
    }
  } else {
    if (finalAuthorityId && finalStatus !== "Approved") {
      throw new ConvexError("Final authority approval is required before HR review");
    }
    if (!(actions.canApproveHr || actions.canReject)) {
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
    if (args.status === "Approved") {
      const leaveType = ensureLeaveType(leave.leaveType ?? "Casual");
      const fiscalYear = fiscalYearForDate(leave.startDate);
      const balances = await balanceMapForStaff(ctx, staff, fiscalYear, leave.startDate);
      const decision = calculateLeaveDecision({
        balances,
        endDate: leave.endDate,
        leaveType,
        staff,
        startDate: leave.startDate,
      });
      if (!decision.allowed) {
        throw new ConvexError(decision.reason);
      }
    }
  }

  await ctx.db.patch(leaveId, patch);
  const patchedLeave = await ctx.db.get(leaveId);
  if (patchedLeave && patch.status === "Approved") {
    await ledgerUsageForApprovedLeave(ctx, access, patchedLeave, staff);
  }
  await createActivity(ctx, access, {
    action: stage,
    entityId: leaveId,
    entityType: "leave",
    message: `Leave for ${staff.name} ${args.status.toLowerCase()} at ${
      stage === "head_reviewed"
        ? "head review"
        : stage === "final_reviewed"
          ? "final authority review"
          : "HR final review"
    }`,
    metadata: patch,
  });

  if (stage === "head_reviewed" && args.status === "Approved") {
    if (finalAuthorityId) {
      await notifyLeaveReadyForFinalAuthority(ctx, {
        finalAuthorityId,
        leaveId,
        staff,
      });
    } else {
      await notifyLeaveReadyForHr(ctx, {
        hrCopyStaffId,
        leaveId,
        staff,
      });
    }
  }

  if (stage === "final_reviewed" && args.status === "Approved") {
    await notifyLeaveReadyForHr(ctx, {
      hrCopyStaffId,
      leaveId,
      staff,
    });
  }

  return { id: leaveId };
}

export const decide = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    leaveId: v.string(),
    status: leaveStatusValidator,
  },
  handler: decideLeaveRequest,
  returns: leaveIdResultValidator,
});

export const balances = query({
  args: {
    fiscalYear: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_LEAVE);
    const fiscalYear = args.fiscalYear ?? fiscalYearForDate(new Date().toISOString().slice(0, 10));
    let staffId = access.staffId;
    if (args.staffId && isHrReviewer(access)) {
      const normalized = ctx.db.normalizeId("staffUsers", args.staffId);
      if (!normalized) {
        throw new ConvexError("Invalid staff member ID");
      }
      staffId = normalized;
    }
    if (!staffId) {
      return [];
    }
    const staff = await ctx.db.get(staffId);
    if (!staff) {
      return [];
    }
    const seeded = initialBalanceRows(staff._id, staff, fiscalYear);
    const existing = await ctx.db
      .query("staffLeaveBalances")
      .withIndex("by_staffId_and_fiscalYear", (q) =>
        q.eq("staffId", staff._id).eq("fiscalYear", fiscalYear)
      )
      .collect();
    const byType = new Map<string, any>(seeded.map((row) => [row.leaveType, row]));
    for (const row of existing) {
      byType.set(row.leaveType, row);
    }
    return Array.from(byType.values()).map((row: any) => ({
      accruedDays: row.accruedDays,
      availableDays: row.availableDays,
      carriedForwardDays: row.carriedForwardDays,
      encashableDays: row.encashableDays,
      fiscalYear,
      leaveType: row.leaveType,
      openingDays: row.openingDays,
      staffId: staff._id,
      staffName: staff.name,
      usedDays: row.usedDays,
    }));
  },
  returns: leaveBalanceListResultValidator,
});

export const update = mutation({
  args: {
    endDate: v.optional(v.string()),
    leaveId: v.string(),
    leaveType: v.optional(leaveTypeValidator),
    reason: v.optional(v.string()),
    startDate: v.optional(v.string()),
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
    assertDateRangeOrder(
      args.startDate ?? leave.startDate,
      args.endDate ?? leave.endDate,
      "Leave start date",
      "Leave end date"
    );
    const patch: Record<string, string | number> = { updatedAt: Date.now() };
    if (args.leaveType !== undefined) {
      patch.leaveType = args.leaveType;
    }
    if (args.startDate !== undefined) {
      patch.startDate = args.startDate;
    }
    if (args.endDate !== undefined) {
      patch.endDate = args.endDate;
    }
    if (args.reason !== undefined) {
      patch.reason = args.reason.trim();
    }
    await ctx.db.patch(leaveId, patch);
    await createActivity(ctx, access, {
      action: "updated",
      entityId: leaveId,
      entityType: "leave",
      message: `Leave record updated for ${leave.staffId}`,
    });
    return { id: leaveId };
  },
  returns: leaveIdResultValidator,
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

    const [staff] = await Promise.all([ctx.db.get(leave.staffId), ctx.db.delete(leaveId)]);

    await createActivity(ctx, access, {
      action: "deleted",
      entityId: leaveId,
      entityType: "leave",
      message: `Leave record deleted for ${staff?.name || "unknown staff"}`,
    });

    return { id: leaveId };
  },
  returns: leaveIdResultValidator,
});
