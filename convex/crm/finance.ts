import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  createActivity,
  deleteEntityNotifications,
  requireAnyPermission,
  requireStaff,
} from "./lib";

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
    const rows = await ctx.db.query("invoices").collect();
    const result = [];
    for (const invoice of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const job = await ctx.db.get(invoice.jobCardId);
      result.push({
        id: invoice._id,
        jobCardId: invoice.jobCardId,
        jobCode: job?.jobCode ?? "",
        clientName: job?.clientName ?? "",
        invoiceNumber: invoice.invoiceNumber,
        expectedAmount: invoice.expectedAmount,
        receivedAmount: invoice.receivedAmount,
        balanceAmount: invoice.balanceAmount,
        status: invoice.status,
        dueDate: invoice.dueDate ?? "",
        generatedAt: invoice.generatedAt
          ? new Date(invoice.generatedAt).toISOString()
          : null,
      });
    }
    return result;
  },
});

export const createInvoice = mutation({
  args: {
    jobCardId: v.string(),
    invoiceNumber: v.string(),
    expectedAmount: v.number(),
    receivedAmount: v.optional(v.number()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_FINANCE);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const now = Date.now();
    const receivedAmount = args.receivedAmount ?? 0;
    const balanceAmount = Math.max(args.expectedAmount - receivedAmount, 0);
    const id = await ctx.db.insert("invoices", {
      jobCardId,
      invoiceNumber: args.invoiceNumber.trim(),
      expectedAmount: args.expectedAmount,
      receivedAmount,
      balanceAmount,
      status: balanceAmount === 0 ? "Paid" : receivedAmount > 0 ? "Part Paid" : "Generated",
      dueDate: args.dueDate || "",
      generatedAt: now,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "invoice",
      entityId: id,
      action: "created",
      message: `${args.invoiceNumber.trim()} invoice generated`,
    });
    return { id };
  },
});

export const removeInvoice = mutation({
  args: {
    invoiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_FINANCE);
    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);
    if (!invoiceId) {
      throw new ConvexError("Invalid invoice id");
    }
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice) {
      throw new ConvexError("Invoice not found");
    }
    await createActivity(ctx, access, {
      entityType: "invoice",
      entityId: invoiceId,
      action: "deleted",
      message: `${invoice.invoiceNumber} invoice deleted`,
    });
    await deleteEntityNotifications(ctx, "invoice", invoiceId);
    await ctx.db.delete(invoiceId);
    return { id: invoiceId };
  },
});

export const listExpenses = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES);
    const rows = await ctx.db.query("expenseEntries").collect();
    const result = [];
    for (const expense of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const job = await ctx.db.get(expense.jobCardId);
      result.push({
        id: expense._id,
        jobCardId: expense.jobCardId,
        jobCode: job?.jobCode ?? "",
        clientName: job?.clientName ?? "",
        tourManagerName: expense.tourManagerName ?? "",
        category: expense.category,
        amount: expense.amount,
        paidBy: expense.paidBy,
        approvalStatus: expense.approvalStatus,
        reimbursementStatus: expense.reimbursementStatus,
        notes: expense.notes ?? "",
        createdAt: new Date(expense.createdAt).toISOString(),
      });
    }
    return result;
  },
});

export const createExpense = mutation({
  args: {
    jobCardId: v.string(),
    tourManagerName: v.optional(v.string()),
    category: v.string(),
    amount: v.number(),
    paidBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_EXPENSES);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const now = Date.now();
    const id = await ctx.db.insert("expenseEntries", {
      jobCardId,
      tourManagerName: args.tourManagerName?.trim() || access.name,
      category: args.category.trim(),
      amount: args.amount,
      paidBy: args.paidBy.trim(),
      approvalStatus: "Pending",
      reimbursementStatus: "Not Submitted",
      notes: args.notes?.trim() || "",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "expense",
      entityId: id,
      action: "created",
      message: `${args.category.trim()} expense submitted`,
    });
    return { id };
  },
});

export const updateExpenseStatus = mutation({
  args: {
    expenseId: v.string(),
    approvalStatus: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Rejected"),
    ),
    reimbursementStatus: v.union(
      v.literal("Not Submitted"),
      v.literal("Pending"),
      v.literal("Reimbursed"),
    ),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const id = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!id) {
      throw new ConvexError("Invalid expense id");
    }
    await ctx.db.patch(id, {
      approvalStatus: args.approvalStatus,
      reimbursementStatus: args.reimbursementStatus,
      updatedAt: Date.now(),
    });
    await createActivity(ctx, access, {
      entityType: "expense",
      entityId: id,
      action: "status_updated",
      message: `Expense ${args.approvalStatus.toLowerCase()}`,
    });
    return { id };
  },
});

export const removeExpense = mutation({
  args: {
    expenseId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
      PERMISSIONS.APPROVE_EXPENSES,
    ]);
    const id = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!id) {
      throw new ConvexError("Invalid expense id");
    }
    const expense = await ctx.db.get(id);
    if (!expense) {
      throw new ConvexError("Expense not found");
    }
    await createActivity(ctx, access, {
      entityType: "expense",
      entityId: id,
      action: "deleted",
      message: `${expense.category} expense deleted`,
    });
    await deleteEntityNotifications(ctx, "expense", id);
    await ctx.db.delete(id);
    return { id };
  },
});
