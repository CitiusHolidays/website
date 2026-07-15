import { canManageAllExpenses } from "./expensePolicy";
import { canApproveExpenseAsManager } from "./expenseScope";
import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

export async function presentExpenseListRow(ctx: any, access: any, expense: any) {
  const permissionSet = new Set(access.permissions);
  const canManageAll = canManageAllExpenses(access);
  const canApproveFinancePermission =
    permissionSet.has(PERMISSIONS.APPROVE_EXPENSES) ||
    permissionSet.has(PERMISSIONS.MANAGE_FINANCE);
  const [job, proofAttachment] = await Promise.all([
    expense.jobCardId ? getVisibleJob(ctx, access, expense.jobCardId) : null,
    expense.proofAttachmentId ? ctx.db.get(expense.proofAttachmentId) : null,
  ]);
  if (expense.jobCardId && !job) {
    return null;
  }
  if (
    !(expense.jobCardId || canManageAll) &&
    expense.createdBy !== access.authUserId &&
    String(expense.managerApproverStaffId ?? "") !== String(access.staffId ?? "")
  ) {
    return null;
  }
  return {
    amount: expense.amount,
    approvalStatus: expense.approvalStatus,
    canApproveFinance:
      (expense.managerReviewStatus ?? "Pending") === "Approved" &&
      (expense.financeReviewStatus ?? "Pending") === "Pending" &&
      canApproveFinancePermission,
    canApproveManager:
      Boolean(expense.submittedForApprovalAt) &&
      (expense.managerReviewStatus ?? "Pending") === "Pending" &&
      canApproveExpenseAsManager(access, expense),
    cardAmount: expense.cardAmount ?? 0,
    cashAmount: expense.cashAmount ?? 0,
    category: expense.category,
    clientName: job?.clientName ?? "",
    createdAt: new Date(expense.createdAt).toISOString(),
    currency: expense.currency ?? "INR",
    epayAmount: expense.epayAmount ?? 0,
    expenseDate: expense.expenseDate ?? "",
    financeReviewedAt: expense.financeReviewedAt
      ? new Date(expense.financeReviewedAt).toISOString()
      : null,
    financeReviewedByName: expense.financeReviewedByName ?? "",
    financeReviewStatus: expense.financeReviewStatus ?? "Pending",
    id: expense._id,
    jobCardId: expense.jobCardId ?? null,
    jobCode: job?.jobCode ?? "Office",
    managerApproverStaffId: expense.managerApproverStaffId ?? "",
    managerReviewedAt: expense.managerReviewedAt
      ? new Date(expense.managerReviewedAt).toISOString()
      : null,
    managerReviewedByName: expense.managerReviewedByName ?? "",
    managerReviewStatus: expense.managerReviewStatus ?? "Pending",
    notes: expense.notes ?? "",
    paidBy: expense.paidBy,
    particulars: expense.particulars ?? "",
    proofAttachment: proofAttachment
      ? {
          createdAt: new Date(proofAttachment.createdAt).toISOString(),
          fileName: proofAttachment.fileName,
          id: proofAttachment._id,
          mimeType: proofAttachment.mimeType ?? "",
        }
      : null,
    reimbursementStatus: expense.reimbursementStatus,
    submittedForApprovalAt: expense.submittedForApprovalAt
      ? new Date(expense.submittedForApprovalAt).toISOString()
      : null,
    tourManagerName: expense.tourManagerName ?? "",
  };
}

export async function handleListExpenses(ctx: any, args: any) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES);
  const page = await applyCrmCursorFilters(
    ctx.db.query("expenseEntries").withIndex("by_createdAt").order("desc"),
    {
      equals: {
        approvalStatus: args.approvalStatus,
        category: args.category,
        jobCardId: args.jobCardId,
        reimbursementStatus: args.reimbursementStatus,
      },
    }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (expense: any) =>
    presentExpenseListRow(ctx, access, expense)
  );
  return { ...page, page: compactPageItems(rows) };
}
