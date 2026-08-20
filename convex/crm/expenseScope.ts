import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  canManageAllExpenses,
  canMutateUnlinkedExpense,
  canViewUnlinkedExpense,
} from "./expensePolicy";
import { getVisibleJob } from "./jobCardVisibility";
import {
  canSeeJobCardRecord,
  isDirectorOrAdmin,
  PERMISSIONS,
  type PortalAccess,
  requireAnyPermission,
} from "./lib";

export async function assertExpenseAccess(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  expense: Pick<Doc<"expenseEntries">, "createdBy" | "jobCardId" | "managerApproverStaffId">,
  mode: "mutate" | "view" = "view"
) {
  if (canManageAllExpenses(access)) {
    return;
  }
  if (mode === "mutate" && !canMutateUnlinkedExpense(access, expense)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!expense.jobCardId) {
    const allowed = mode === "mutate" || canViewUnlinkedExpense(access, expense);
    if (!allowed) {
      throw new ConvexError("FORBIDDEN");
    }
    return;
  }
  if (!(await getVisibleJob(ctx, access, expense.jobCardId))) {
    throw new ConvexError("FORBIDDEN");
  }
}

export async function requireVisibleExpense(
  ctx: QueryCtx | MutationCtx,
  expenseId: Id<"expenseEntries">
) {
  const [access, expense] = await Promise.all([
    requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.CREATE_EXPENSES,
      PERMISSIONS.MANAGE_EXPENSES,
      PERMISSIONS.MANAGE_ALL_EXPENSES,
    ]),
    ctx.db.get("expenseEntries", expenseId),
  ]);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if (canManageAllExpenses(access)) {
    return { access, expense, job: null };
  }
  if (expense.jobCardId) {
    const job = await ctx.db.get("jobCards", expense.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    return { access, expense, job };
  }
  if (!canViewUnlinkedExpense(access, expense)) {
    throw new ConvexError("FORBIDDEN");
  }
  return { access, expense, job: null };
}

export async function requireMutableExpenseProof(
  ctx: QueryCtx | MutationCtx,
  expenseId: Id<"expenseEntries">
) {
  const { access, expense } = await requireVisibleExpense(ctx, expenseId);
  if (expense.approvalStatus === "Approved") {
    throw new ConvexError("Approved expenses cannot have their proof changed");
  }
  const canMutate = canMutateUnlinkedExpense(access, expense);
  if (!canMutate) {
    throw new ConvexError("FORBIDDEN");
  }
  return { access, expense };
}

export function canApproveExpenseAsManager(
  access: Pick<PortalAccess, "roles" | "staffId">,
  expense: Pick<Doc<"expenseEntries">, "managerApproverStaffId">
) {
  return (
    isDirectorOrAdmin(access) ||
    Boolean(
      expense.managerApproverStaffId &&
        access.staffId &&
        String(expense.managerApproverStaffId) === String(access.staffId)
    )
  );
}
