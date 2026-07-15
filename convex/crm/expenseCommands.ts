import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  hasMaterialExpenseChange,
  invalidatePendingExpenseApprovals,
  resetExpenseApprovalPatch,
  splitTotal,
} from "./expenseMaterialIntegrity";
import { assertExpenseAccess } from "./expenseScope";
import { getVisibleJob } from "./jobCardVisibility";
import {
  createActivity,
  deleteEntityNotifications,
  PERMISSIONS,
  requireAnyPermission,
  requireStaff,
} from "./lib";

type ExpenseCurrency = "INR" | "USD" | "AED" | "EUR" | "THB" | "SGD";

export async function handleCreateExpense(
  ctx: any,
  args: {
    amount?: number;
    cardAmount?: number;
    cashAmount?: number;
    category: string;
    currency?: ExpenseCurrency;
    epayAmount?: number;
    expenseDate?: string;
    jobCardId?: string;
    notes?: string;
    paidBy: string;
    particulars?: string;
    tourManagerName?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.CREATE_EXPENSES);
  let jobCardId: Id<"jobCards"> | null | undefined;
  if (args.jobCardId) {
    jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    if (!(await getVisibleJob(ctx, access, jobCardId))) {
      throw new ConvexError("Job Card not found or not assigned to you");
    }
  }
  if (!args.category.trim()) {
    throw new ConvexError("Select a category");
  }
  if (!args.paidBy.trim()) {
    throw new ConvexError("Paid by is required");
  }
  const now = Date.now();
  const hasSplit =
    args.cardAmount !== undefined || args.cashAmount !== undefined || args.epayAmount !== undefined;
  const amount = hasSplit ? splitTotal(args) : (args.amount ?? 0);
  const id = await ctx.db.insert("expenseEntries", {
    amount,
    approvalStatus: "Pending",
    approvalVersion: 1,
    cardAmount: args.cardAmount ?? 0,
    cashAmount: args.cashAmount ?? 0,
    category: args.category.trim(),
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    currency: args.currency ?? "INR",
    epayAmount: args.epayAmount ?? 0,
    expenseDate: args.expenseDate || new Date(now).toISOString().slice(0, 10),
    jobCardId: jobCardId ?? undefined,
    notes: args.notes?.trim() || "",
    paidBy: args.paidBy.trim(),
    particulars: args.particulars?.trim() || args.notes?.trim() || "",
    proofDigest: "",
    reimbursementStatus: "Not Submitted",
    tourManagerName: args.tourManagerName?.trim() || access.name,
    updatedAt: now,
  });
  await createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "expense",
    message: `${args.category.trim()} expense submitted`,
  });
  return { id };
}

export async function handleUpdateExpense(
  ctx: any,
  args: {
    amount?: number;
    cardAmount?: number;
    cashAmount?: number;
    category?: string;
    currency?: ExpenseCurrency;
    epayAmount?: number;
    expenseDate?: string;
    expenseId: string;
    notes?: string;
    paidBy?: string;
    particulars?: string;
    tourManagerName?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.CREATE_EXPENSES,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_ALL_EXPENSES,
  ]);
  const id = ctx.db.normalizeId("expenseEntries", args.expenseId);
  if (!id) {
    throw new ConvexError("Invalid expense id");
  }
  const expense = await ctx.db.get(id);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if (expense.approvalStatus === "Approved") {
    throw new ConvexError("Approved expenses cannot be edited");
  }
  await assertExpenseAccess(ctx, access, expense, "mutate");

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (args.tourManagerName !== undefined) {
    patch.tourManagerName = args.tourManagerName.trim();
  }
  if (args.category !== undefined) {
    if (!args.category.trim()) {
      throw new ConvexError("Select a category");
    }
    patch.category = args.category.trim();
  }
  if (args.expenseDate !== undefined) {
    patch.expenseDate = args.expenseDate;
  }
  if (args.particulars !== undefined) {
    patch.particulars = args.particulars.trim();
  }
  if (args.currency !== undefined) {
    patch.currency = args.currency;
  }
  if (args.cardAmount !== undefined) {
    patch.cardAmount = args.cardAmount;
  }
  if (args.cashAmount !== undefined) {
    patch.cashAmount = args.cashAmount;
  }
  if (args.epayAmount !== undefined) {
    patch.epayAmount = args.epayAmount;
  }
  if (args.paidBy !== undefined) {
    if (!args.paidBy.trim()) {
      throw new ConvexError("Paid by is required");
    }
    patch.paidBy = args.paidBy.trim();
  }
  if (args.notes !== undefined) {
    patch.notes = args.notes.trim();
  }

  if (
    args.amount !== undefined ||
    args.cardAmount !== undefined ||
    args.cashAmount !== undefined ||
    args.epayAmount !== undefined
  ) {
    const cardAmount = args.cardAmount ?? expense.cardAmount ?? 0;
    const cashAmount = args.cashAmount ?? expense.cashAmount ?? 0;
    const epayAmount = args.epayAmount ?? expense.epayAmount ?? 0;
    const nextSplitTotal = cardAmount + cashAmount + epayAmount;
    patch.amount =
      args.cardAmount !== undefined ||
      args.cashAmount !== undefined ||
      args.epayAmount !== undefined
        ? nextSplitTotal
        : args.amount;
  }

  if (hasMaterialExpenseChange(expense, patch)) {
    const now = Date.now();
    Object.assign(patch, resetExpenseApprovalPatch(expense, now));
    await invalidatePendingExpenseApprovals(ctx, id, now);
  }

  await ctx.db.patch(id, patch);
  await createActivity(ctx, access, {
    action: "updated",
    entityId: id,
    entityType: "expense",
    message: `${(args.category ?? expense.category).trim()} expense updated`,
  });
  return { id };
}

export async function handleRemoveExpense(ctx: any, args: { expenseId: string }) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.CREATE_EXPENSES,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_ALL_EXPENSES,
  ]);
  const id = ctx.db.normalizeId("expenseEntries", args.expenseId);
  if (!id) {
    throw new ConvexError("Invalid expense id");
  }
  const expense = await ctx.db.get(id);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  await assertExpenseAccess(ctx, access, expense, "mutate");
  await createActivity(ctx, access, {
    action: "deleted",
    entityId: id,
    entityType: "expense",
    message: `${expense.category} expense deleted`,
  });
  if (expense.proofAttachmentId) {
    const proof = await ctx.db.get(expense.proofAttachmentId);
    if (proof?.storageId) {
      try {
        await ctx.storage.delete(proof.storageId);
      } catch (err) {
        console.error("Failed to delete expense proof from storage:", err);
      }
    }
    if (proof) {
      await ctx.db.delete(proof._id);
    }
  }
  await deleteEntityNotifications(ctx, "expense", id);
  await ctx.db.delete(id);
  return { id };
}
