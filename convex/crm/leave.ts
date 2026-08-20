import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { propertiesWhen } from "../lib/runtimeValues";
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

function leaveReviewLabel(stage: string) {
  if (stage === "head_reviewed") {
    return "head review";
  }
  return stage === "final_reviewed" ? "final authority review" : "HR final review";
}

import {
  assertDateRangeOrder,
  canHeadReview,
  createActivity,
  getHeadReviewerRolesForStaff,
  isDefined,
  isHrReviewer,
  PERMISSIONS,
  type PortalAccess,
  requireAnyPermission,
  requireStaff,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
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
import { assertReferenceDate } from "./referenceTimePolicy";

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
  if (LEAVE_TYPES.some((candidate) => candidate === value)) {
    const leaveType = LEAVE_TYPES.find((candidate) => candidate === value);
    if (!leaveType) {
      throw new ConvexError("Invalid leave type");
    }
    return leaveType;
  }
  return "Casual";
}

async function balanceMapForStaff(
  ctx: QueryCtx,
  staff: Doc<"staffUsers">,
  fiscalYear: string,
  startDate: string
) {
  const balances = await ctx.db
    .query("staffLeaveBalances")
    .withIndex("by_staffId_and_fiscalYear", (q) =>
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
    .withIndex("by_staffId_and_fiscalYear", (q) =>
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
  ctx: MutationCtx,
  staff: Doc<"staffUsers">,
  fiscalYear: string,
  leaveType: LeaveType,
  deltaUsedDays: number
) {
  if (leaveType === "Leave Without Pay") {
    return;
  }
  const existing = await ctx.db
    .query("staffLeaveBalances")
    .withIndex("by_staffId_and_fiscalYear_and_leaveType", (q) =>
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
    await patchWithE2eOwnership(ctx, "staffLeaveBalances", existing._id, patch);
    return;
  }
  await insertWithE2eOwnership(ctx, "staffLeaveBalances", {
    fiscalYear,
    leaveType,
    staffId: staff._id,
    ...patch,
  });
}

async function ledgerUsageForApprovedLeave(
  ctx: MutationCtx,
  access: PortalAccess,
  leave: Doc<"staffLeaveRecords">,
  staff: Doc<"staffUsers">
) {
  const leaveType = ensureLeaveType(leave.leaveType ?? "Casual");
  const fiscalYear = fiscalYearForDate(leave.startDate);
  const existing = await ctx.db
    .query("staffLeaveLedger")
    .withIndex("by_leaveRecordId", (q) => q.eq("leaveRecordId", leave._id))
    .collect();
  if (existing.some((entry) => entry.entryType === "usage")) {
    return;
  }
  const days = inclusiveLeaveDays(leave.startDate, leave.endDate);
  await insertWithE2eOwnership(ctx, "staffLeaveLedger", {
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
  ctx: QueryCtx,
  access: PortalAccess,
  leave: Doc<"staffLeaveRecords">,
  staff: Doc<"staffUsers">,
  staffRows: Doc<"staffUsers">[],
  approverCache: Map<string, Id<"staffUsers"> | null>
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

function firstLeaveValue<Value>(...values: Array<Value | null | undefined>): Value | "" {
  return values.find((value) => value !== undefined && value !== null) ?? "";
}

function leaveFinalReviewStatus(
  leave: Doc<"staffLeaveRecords">,
  finalAuthorityId: Id<"staffUsers"> | ""
) {
  if (leave.finalReviewStatus) {
    return leave.finalReviewStatus;
  }
  return finalAuthorityId ? "Pending" : "Approved";
}

async function loadVisibleLeaveListRow(
  ctx: QueryCtx,
  access: PortalAccess,
  leave: Doc<"staffLeaveRecords">,
  staffRows: Doc<"staffUsers">[],
  approverCache: Map<string, Id<"staffUsers"> | null>
) {
  const staff = await ctx.db.get("staffUsers", leave.staffId);
  if (!(staff && (await canSeeLeave(ctx, access, leave, staff, staffRows, approverCache)))) {
    return null;
  }
  const resolvedApproverId = await resolveLeaveHeadApproverId(ctx, staff, staffRows);
  const headApproverId = firstLeaveValue(leave.headApproverStaffId, resolvedApproverId, undefined);
  const finalAuthorityId = firstLeaveValue(
    leave.finalAuthorityStaffId,
    await resolveLeaveFinalAuthorityId(ctx, staff, resolvedApproverId, staffRows),
    undefined
  );
  const hrCopyStaffId = firstLeaveValue(
    leave.hrCopyStaffId,
    await resolveLeaveHrCopyStaffId(ctx, staff, staffRows),
    undefined
  );
  const [headApprover, finalAuthority, hrCopyStaff] = await Promise.all([
    headApproverId ? ctx.db.get("staffUsers", headApproverId) : null,
    finalAuthorityId ? ctx.db.get("staffUsers", finalAuthorityId) : null,
    hrCopyStaffId ? ctx.db.get("staffUsers", hrCopyStaffId) : null,
  ]);
  return {
    days: inclusiveLeaveDays(leave.startDate, leave.endDate),
    decisionNote: firstLeaveValue(leave.decisionNote),
    department: firstLeaveValue(staff.department, "General"),
    endDate: leave.endDate,
    finalAuthorityName: firstLeaveValue(
      leave.finalAuthorityName,
      finalAuthority?.name,
      finalAuthorityId ? "Not assigned" : ""
    ),
    finalAuthorityStaffId: finalAuthorityId || undefined,
    finalDecisionNote: firstLeaveValue(leave.finalDecisionNote),
    finalReviewedByName: firstLeaveValue(leave.finalReviewedByName),
    finalReviewStatus: leaveFinalReviewStatus(leave, finalAuthorityId),
    fiscalYear: fiscalYearForDate(leave.startDate),
    headApproverName: firstLeaveValue(leave.headApproverName, headApprover?.name, "Not assigned"),
    headApproverStaffId: headApproverId || undefined,
    headDecisionNote: firstLeaveValue(leave.headDecisionNote),
    headReviewedByName: firstLeaveValue(leave.headReviewedByName),
    headReviewerRole: firstLeaveValue(leave.headReviewerRole, primaryHeadRoleForStaff(staff)),
    headReviewStatus: leave.headReviewStatus ?? "Pending",
    hrCopyName: firstLeaveValue(leave.hrCopyName, hrCopyStaff?.name),
    hrCopyStaffId: hrCopyStaffId || undefined,
    hrReviewedByName: firstLeaveValue(leave.hrReviewedByName),
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
      finalAuthorityId || null,
      isHrReviewer
    ),
    createdAt: new Date(leave.createdAt).toISOString(),
  };
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
    const approverCache = new Map<string, Id<"staffUsers"> | null>();

    const result = await mapInBoundedBatches(page.page, (leave) =>
      loadVisibleLeaveListRow(ctx, access, leave, staffRows, approverCache)
    );

    return { ...page, page: compactPageItems(result.filter(isDefined)) };
  },
  returns: leaveListPageResultValidator,
});

interface CreateLeaveArgs {
  endDate: string;
  leaveType?: LeaveType;
  reason: string;
  staffId?: string;
  startDate: string;
  status?: "Pending" | "Approved" | "Rejected";
}

function resolveLeaveRequestStaffId(
  ctx: MutationCtx,
  access: Awaited<ReturnType<typeof requireStaff>>,
  requestedStaffId: string | undefined
) {
  if (!(isHrReviewer(access) && requestedStaffId)) {
    return access.staffId;
  }
  const staffId = ctx.db.normalizeId("staffUsers", requestedStaffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff member ID");
  }
  return staffId;
}

export async function createLeaveRequest(ctx: MutationCtx, args: CreateLeaveArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.REQUEST_LEAVE);
  const staffId = resolveLeaveRequestStaffId(ctx, access, args.staffId);

  if (!staffId) {
    throw new ConvexError("Staff profile not found for leave request");
  }

  const [staff, staffRows] = await Promise.all([
    ctx.db.get("staffUsers", staffId),
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
    headApproverId ? ctx.db.get("staffUsers", headApproverId) : Promise.resolve(null),
    finalAuthorityId ? ctx.db.get("staffUsers", finalAuthorityId) : Promise.resolve(null),
    hrCopyStaffId ? ctx.db.get("staffUsers", hrCopyStaffId) : Promise.resolve(null),
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

  const id = await insertWithE2eOwnership(ctx, "staffLeaveRecords", {
    createdAt: now,
    createdBy: access.authUserId || "system",
    endDate: args.endDate,
    finalAuthorityName: finalAuthority?.name ?? "",
    finalAuthorityStaffId: finalAuthorityId ?? undefined,
    finalReviewStatus: finalAuthorityId ? "Pending" : "Approved",
    headApproverName: headApprover?.name ?? "",
    headApproverStaffId: headApproverId ?? undefined,
    headReviewerRole,
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
  handler: (ctx, args) => createLeaveRequest(ctx, args),
  returns: leaveIdResultValidator,
});

interface DecideLeaveArgs {
  decisionNote?: string;
  leaveId: string;
  status: "Pending" | "Approved" | "Rejected";
}

type LeaveApprovalActions = ReturnType<typeof getLeaveApprovalActionsForApprover>;

interface LeaveDecisionValues {
  access: PortalAccess;
  actions: LeaveApprovalActions;
  args: DecideLeaveArgs;
  finalAuthorityId: Id<"staffUsers"> | null;
  finalStatus: "Approved" | "Pending" | "Rejected";
  headStatus: "Approved" | "Pending" | "Rejected";
  hrStatus: "Approved" | "Pending" | "Rejected";
  leave: Doc<"staffLeaveRecords">;
  note: string;
  now: number;
  resolvedApproverId: Id<"staffUsers"> | null;
  staff: Doc<"staffUsers">;
}

function buildHeadReviewPatch({
  access,
  actions,
  args,
  finalAuthorityId,
  headStatus,
  leave,
  note,
  now,
  resolvedApproverId,
  staff,
}: LeaveDecisionValues) {
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
  const rejected = args.status === "Rejected";
  let finalReviewStatus: "Approved" | "Pending" | "Rejected" = "Approved";
  if (rejected) {
    finalReviewStatus = "Rejected";
  } else if (finalAuthorityId) {
    finalReviewStatus = "Pending";
  }
  const patch: RuntimeObject = {
    ...propertiesWhen(rejected, () => ({ decisionNote: note })),
    finalReviewStatus,
    headDecisionNote: note,
    headReviewedAt: now,
    headReviewedBy: access.authUserId,
    headReviewedByName: access.name,
    headReviewStatus: args.status,
    hrReviewStatus: rejected ? "Rejected" : "Pending",
    status: rejected ? "Rejected" : "Pending",
    updatedAt: now,
  };
  return {
    patch,
    stage: "head_reviewed" as const,
  };
}

function buildFinalAuthorityReviewPatch({
  access,
  actions,
  args,
  finalStatus,
  note,
  now,
}: LeaveDecisionValues) {
  if (args.status === "Approved" && !actions.canApproveFinal) {
    throw new ConvexError("Final authority approval is required before HR review");
  }
  if (args.status === "Rejected" && !actions.canReject) {
    throw new ConvexError("FORBIDDEN");
  }
  if (finalStatus !== "Pending") {
    throw new ConvexError("Final authority review has already been completed");
  }
  const rejected = args.status === "Rejected";
  const patch: RuntimeObject = {
    ...propertiesWhen(rejected, () => ({ decisionNote: note })),
    finalDecisionNote: note,
    finalReviewedAt: now,
    finalReviewedBy: access.authUserId,
    finalReviewedByName: access.name,
    finalReviewStatus: args.status,
    hrReviewStatus: rejected ? "Rejected" : "Pending",
    status: rejected ? "Rejected" : "Pending",
    updatedAt: now,
  };
  return {
    patch,
    stage: "final_reviewed" as const,
  };
}

async function assertLeaveBalanceAllowsApproval(
  ctx: MutationCtx,
  leave: Doc<"staffLeaveRecords">,
  staff: Doc<"staffUsers">
) {
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

async function buildHrReviewPatch(
  ctx: MutationCtx,
  {
    access,
    actions,
    args,
    finalAuthorityId,
    finalStatus,
    hrStatus,
    leave,
    note,
    now,
    staff,
  }: LeaveDecisionValues
) {
  if (finalAuthorityId && finalStatus !== "Approved") {
    throw new ConvexError("Final authority approval is required before HR review");
  }
  if (!(actions.canApproveHr || actions.canReject)) {
    throw new ConvexError("HR final approval is required");
  }
  if (hrStatus !== "Pending") {
    throw new ConvexError("HR review has already been completed");
  }
  if (args.status === "Approved") {
    await assertLeaveBalanceAllowsApproval(ctx, leave, staff);
  }
  const patch: RuntimeObject = {
    decisionNote: note,
    hrReviewedAt: now,
    hrReviewedBy: access.authUserId,
    hrReviewedByName: access.name,
    hrReviewStatus: args.status,
    status: args.status,
    updatedAt: now,
  };
  return {
    patch,
    stage: "hr_reviewed" as const,
  };
}

function buildLeaveDecisionPatch(ctx: MutationCtx, values: LeaveDecisionValues) {
  if (values.headStatus !== "Approved") {
    return buildHeadReviewPatch(values);
  }
  if (values.finalAuthorityId && values.finalStatus !== "Approved") {
    return buildFinalAuthorityReviewPatch(values);
  }
  return buildHrReviewPatch(ctx, values);
}

async function notifyNextLeaveReviewer(
  ctx: MutationCtx,
  {
    args,
    finalAuthorityId,
    hrCopyStaffId,
    leaveId,
    staff,
    stage,
  }: {
    args: DecideLeaveArgs;
    finalAuthorityId: Id<"staffUsers"> | null;
    hrCopyStaffId: Id<"staffUsers"> | null;
    leaveId: Id<"staffLeaveRecords">;
    staff: Doc<"staffUsers">;
    stage: "final_reviewed" | "head_reviewed" | "hr_reviewed";
  }
) {
  if (args.status !== "Approved") {
    return;
  }
  if (stage === "final_reviewed") {
    await notifyLeaveReadyForHr(ctx, { hrCopyStaffId, leaveId, staff });
    return;
  }
  if (stage !== "head_reviewed") {
    return;
  }
  if (finalAuthorityId) {
    await notifyLeaveReadyForFinalAuthority(ctx, { finalAuthorityId, leaveId, staff });
    return;
  }
  await notifyLeaveReadyForHr(ctx, { hrCopyStaffId, leaveId, staff });
}

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
  const leave = await ctx.db.get("staffLeaveRecords", leaveId);
  if (!leave) {
    throw new ConvexError("Leave record not found");
  }
  const staff = await ctx.db.get("staffUsers", leave.staffId);
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
  const { patch, stage } = await buildLeaveDecisionPatch(ctx, {
    access,
    actions,
    args,
    finalAuthorityId,
    finalStatus,
    headStatus,
    hrStatus,
    leave,
    note,
    now,
    resolvedApproverId,
    staff,
  });

  await patchWithE2eOwnership(ctx, "staffLeaveRecords", leaveId, patch);
  const patchedLeave = await ctx.db.get("staffLeaveRecords", leaveId);
  if (patchedLeave && patch.status === "Approved") {
    await ledgerUsageForApprovedLeave(ctx, access, patchedLeave, staff);
  }
  await createActivity(ctx, access, {
    action: stage,
    entityId: leaveId,
    entityType: "leave",
    message: `Leave for ${staff.name} ${args.status.toLowerCase()} at ${leaveReviewLabel(stage)}`,
    metadata: patch,
  });

  await notifyNextLeaveReviewer(ctx, {
    args,
    finalAuthorityId,
    hrCopyStaffId,
    leaveId,
    staff,
    stage,
  });

  return { id: leaveId };
}

export const decide = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    leaveId: v.string(),
    status: leaveStatusValidator,
  },
  handler: (ctx, args) => decideLeaveRequest(ctx, args),
  returns: leaveIdResultValidator,
});

export const balances = query({
  args: {
    fiscalYear: v.optional(v.string()),
    referenceDate: v.string(),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_LEAVE);
    const { staffId: requestedStaffId } = args;
    const fiscalYear =
      args.fiscalYear ?? fiscalYearForDate(assertReferenceDate(args.referenceDate));
    let { staffId } = access;
    if (requestedStaffId && isHrReviewer(access)) {
      const normalized = ctx.db.normalizeId("staffUsers", requestedStaffId);
      if (!normalized) {
        throw new ConvexError("Invalid staff member ID");
      }
      staffId = normalized;
    }
    if (!staffId) {
      return [];
    }
    const staff = await ctx.db.get("staffUsers", staffId);
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
    const byType = new Map<
      string,
      Doc<"staffLeaveBalances"> | ReturnType<typeof initialBalanceRows>[number]
    >(seeded.map((row) => [row.leaveType, row]));
    for (const row of existing) {
      byType.set(row.leaveType, row);
    }
    return Array.from(byType.values()).map((row) => ({
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
    const leave = await ctx.db.get("staffLeaveRecords", leaveId);
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
    const patch: RuntimeObject = {};
    patch.updatedAt = Date.now();
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
    await patchWithE2eOwnership(ctx, "staffLeaveRecords", leaveId, patch);
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

    const leave = await ctx.db.get("staffLeaveRecords", leaveId);
    if (!leave) {
      throw new ConvexError("Leave record not found");
    }

    const [staff] = await Promise.all([
      ctx.db.get("staffUsers", leave.staffId),
      ctx.db.delete("staffLeaveRecords", leaveId),
    ]);

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
