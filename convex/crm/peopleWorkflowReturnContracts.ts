import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

const isoDateTimeValidator = v.string();
const reviewStatusValidator = v.union(
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

const approvalOutputValidator = v.object({
  amount: v.number(),
  createdAt: isoDateTimeValidator,
  decidedAt: v.union(isoDateTimeValidator, v.null()),
  decidedByName: v.string(),
  decisionNote: v.string(),
  entityId: v.string(),
  entityType: v.string(),
  id: v.id("approvalRequests"),
  requestCode: v.string(),
  requestedByName: v.string(),
  status: v.union(
    v.literal("Pending"),
    v.literal("Approved"),
    v.literal("Rejected"),
    v.literal("Needs Info")
  ),
  summary: v.string(),
  type: v.string(),
});
export const approvalListResultValidator = v.array(approvalOutputValidator);
export const approvalListPageResultValidator = paginationResultValidator(approvalOutputValidator);
export const approvalListRowResultValidator = v.union(approvalOutputValidator, v.null());
export const approvalIdResultValidator = v.object({ id: v.id("approvalRequests") });
export const countResultValidator = v.number();

const leaveOutputValidator = v.object({
  canApproveFinal: v.boolean(),
  canApproveHead: v.boolean(),
  canApproveHr: v.boolean(),
  canReject: v.boolean(),
  createdAt: isoDateTimeValidator,
  days: v.number(),
  decisionNote: v.string(),
  department: v.string(),
  endDate: v.string(),
  finalAuthorityName: v.string(),
  finalAuthorityStaffId: v.optional(v.id("staffUsers")),
  finalDecisionNote: v.string(),
  finalReviewedByName: v.string(),
  finalReviewStatus: reviewStatusValidator,
  fiscalYear: v.string(),
  headApproverName: v.string(),
  headApproverStaffId: v.optional(v.id("staffUsers")),
  headDecisionNote: v.string(),
  headReviewedByName: v.string(),
  headReviewerRole: v.string(),
  headReviewStatus: reviewStatusValidator,
  hrCopyName: v.string(),
  hrCopyStaffId: v.optional(v.id("staffUsers")),
  hrReviewedByName: v.string(),
  hrReviewStatus: reviewStatusValidator,
  id: v.id("staffLeaveRecords"),
  leaveType: leaveTypeValidator,
  reason: v.string(),
  staffEmail: v.string(),
  staffId: v.id("staffUsers"),
  staffName: v.string(),
  startDate: v.string(),
  status: reviewStatusValidator,
});
export const leaveListResultValidator = v.array(leaveOutputValidator);
export const leaveListPageResultValidator = paginationResultValidator(leaveOutputValidator);
export const leaveIdResultValidator = v.object({ id: v.id("staffLeaveRecords") });
export const leaveBalanceListResultValidator = v.array(
  v.object({
    accruedDays: v.number(),
    availableDays: v.number(),
    carriedForwardDays: v.number(),
    encashableDays: v.number(),
    fiscalYear: v.string(),
    leaveType: leaveTypeValidator,
    openingDays: v.number(),
    staffId: v.id("staffUsers"),
    staffName: v.string(),
    usedDays: v.number(),
  })
);

const activityOutputValidator = v.object({
  action: v.string(),
  actorName: v.string(),
  createdAt: isoDateTimeValidator,
  entityId: v.string(),
  entityType: v.string(),
  id: v.id("activityLogs"),
  message: v.string(),
});
export const activityListResultValidator = v.array(activityOutputValidator);
export const activityListPageResultValidator = paginationResultValidator(activityOutputValidator);
export const notificationListResultValidator = v.array(
  v.object({
    body: v.string(),
    createdAt: isoDateTimeValidator,
    entityId: v.string(),
    entityType: v.string(),
    id: v.id("notifications"),
    readAt: v.union(isoDateTimeValidator, v.null()),
    title: v.string(),
  })
);
export const notificationSummaryResultValidator = v.object({
  hasMoreUnread: v.optional(v.literal(true)),
  unreadCount: v.number(),
});
export const nullableNotificationIdResultValidator = v.union(
  v.null(),
  v.object({ id: v.id("notifications") })
);
export const notificationIdResultValidator = v.object({ id: v.id("notifications") });
export const markedNotificationsResultValidator = v.object({ marked: v.number() });
