import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import {
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  filterRecordsByCreatedAt,
  isDefined,
  nextCode,
  notifyRoles,
  PERMISSIONS,
  type PortalPeriod,
  portalPeriodValidator,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const expenseCurrencyValidator = v.union(
  v.literal("INR"),
  v.literal("USD"),
  v.literal("AED"),
  v.literal("EUR"),
  v.literal("THB"),
  v.literal("SGD"),
);

async function getVisibleJob(ctx: any, access: any, jobCardId: any) {
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}

function splitTotal(input: { cardAmount?: number; cashAmount?: number; epayAmount?: number }) {
  return (input.cardAmount ?? 0) + (input.cashAmount ?? 0) + (input.epayAmount ?? 0);
}

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_FINANCE),
      ctx.db.query("invoices").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (invoice) => {
          const job = await getVisibleJob(ctx, access, invoice.jobCardId);
          if (!job) return null;
          return {
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
            generatedAt: invoice.generatedAt ? new Date(invoice.generatedAt).toISOString() : null,
          };
        }),
    );
    return result.filter(Boolean);
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
    if (!(await getVisibleJob(ctx, access, jobCardId))) {
      throw new ConvexError("Job Card not found or not assigned to you");
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

export const updateInvoice = mutation({
  args: {
    invoiceId: v.string(),
    invoiceNumber: v.optional(v.string()),
    expectedAmount: v.optional(v.number()),
    receivedAmount: v.optional(v.number()),
    dueDate: v.optional(v.string()),
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
    if (!(await getVisibleJob(ctx, access, invoice.jobCardId))) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.invoiceNumber !== undefined && !args.invoiceNumber.trim()) {
      throw new ConvexError("Invoice number is required");
    }

    const expectedAmount = args.expectedAmount ?? invoice.expectedAmount;
    const receivedAmount = args.receivedAmount ?? invoice.receivedAmount;
    const balanceAmount = Math.max(expectedAmount - receivedAmount, 0);
    const patch: Record<string, unknown> = {
      expectedAmount,
      receivedAmount,
      balanceAmount,
      status:
        balanceAmount === 0
          ? "Paid"
          : receivedAmount > 0
            ? "Part Paid"
            : invoice.status === "Draft"
              ? "Draft"
              : "Generated",
      updatedAt: Date.now(),
    };
    if (args.invoiceNumber !== undefined) patch.invoiceNumber = args.invoiceNumber.trim();
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;

    await ctx.db.patch(invoiceId, patch);
    await createActivity(ctx, access, {
      entityType: "invoice",
      entityId: invoiceId,
      action: "updated",
      message: `${(args.invoiceNumber ?? invoice.invoiceNumber).trim()} invoice updated`,
    });
    return { id: invoiceId };
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
    if (!(await getVisibleJob(ctx, access, invoice.jobCardId))) {
      throw new ConvexError("FORBIDDEN");
    }
    await Promise.all([
      createActivity(ctx, access, {
        entityType: "invoice",
        entityId: invoiceId,
        action: "deleted",
        message: `${invoice.invoiceNumber} invoice deleted`,
      }),
      deleteEntityNotifications(ctx, "invoice", invoiceId),
      ctx.db.delete(invoiceId),
    ]);
    return { id: invoiceId };
  },
});

async function assertExpenseAccess(ctx: any, access: any, expense: { jobCardId?: any }) {
  if (!expense.jobCardId) {
    return;
  }
  if (!(await getVisibleJob(ctx, access, expense.jobCardId))) {
    throw new ConvexError("FORBIDDEN");
  }
}

export const listExpenses = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES),
      ctx.db.query("expenseEntries").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (expense) => {
          const [job, proofAttachment] = await Promise.all([
            expense.jobCardId ? getVisibleJob(ctx, access, expense.jobCardId) : null,
            expense.proofAttachmentId ? ctx.db.get(expense.proofAttachmentId) : null,
          ]);
          if (expense.jobCardId && !job) return null;
          return {
            id: expense._id,
            jobCardId: expense.jobCardId ?? null,
            jobCode: job?.jobCode ?? "Office",
            clientName: job?.clientName ?? "",
            tourManagerName: expense.tourManagerName ?? "",
            category: expense.category,
            expenseDate: expense.expenseDate ?? "",
            particulars: expense.particulars ?? "",
            currency: expense.currency ?? "INR",
            cardAmount: expense.cardAmount ?? 0,
            cashAmount: expense.cashAmount ?? 0,
            epayAmount: expense.epayAmount ?? 0,
            amount: expense.amount,
            paidBy: expense.paidBy,
            proofAttachment: proofAttachment
              ? {
                  id: proofAttachment._id,
                  fileName: proofAttachment.fileName,
                  mimeType: proofAttachment.mimeType ?? "",
                  createdAt: new Date(proofAttachment.createdAt).toISOString(),
                }
              : null,
            approvalStatus: expense.approvalStatus,
            reimbursementStatus: expense.reimbursementStatus,
            notes: expense.notes ?? "",
            submittedForApprovalAt: expense.submittedForApprovalAt
              ? new Date(expense.submittedForApprovalAt).toISOString()
              : null,
            createdAt: new Date(expense.createdAt).toISOString(),
          };
        }),
    );
    return result.filter(Boolean);
  },
});

export const createExpense = mutation({
  args: {
    jobCardId: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
    category: v.string(),
    expenseDate: v.optional(v.string()),
    particulars: v.optional(v.string()),
    currency: v.optional(expenseCurrencyValidator),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    epayAmount: v.optional(v.number()),
    amount: v.optional(v.number()),
    paidBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_EXPENSES);
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
    const now = Date.now();
    const hasSplit =
      args.cardAmount !== undefined ||
      args.cashAmount !== undefined ||
      args.epayAmount !== undefined;
    const amount = hasSplit ? splitTotal(args) : (args.amount ?? 0);
    const id = await ctx.db.insert("expenseEntries", {
      jobCardId: jobCardId ?? undefined,
      tourManagerName: args.tourManagerName?.trim() || access.name,
      category: args.category.trim(),
      expenseDate: args.expenseDate || new Date(now).toISOString().slice(0, 10),
      particulars: args.particulars?.trim() || args.notes?.trim() || "",
      currency: args.currency ?? "INR",
      cardAmount: args.cardAmount ?? 0,
      cashAmount: args.cashAmount ?? 0,
      epayAmount: args.epayAmount ?? 0,
      amount,
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

export const updateExpense = mutation({
  args: {
    expenseId: v.string(),
    tourManagerName: v.optional(v.string()),
    category: v.optional(v.string()),
    expenseDate: v.optional(v.string()),
    particulars: v.optional(v.string()),
    currency: v.optional(expenseCurrencyValidator),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    epayAmount: v.optional(v.number()),
    amount: v.optional(v.number()),
    paidBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_EXPENSES);
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
    await assertExpenseAccess(ctx, access, expense);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.tourManagerName !== undefined) {
      patch.tourManagerName = args.tourManagerName.trim();
    }
    if (args.category !== undefined) {
      if (!args.category.trim()) {
        throw new ConvexError("Category is required");
      }
      patch.category = args.category.trim();
    }
    if (args.expenseDate !== undefined) patch.expenseDate = args.expenseDate;
    if (args.particulars !== undefined) patch.particulars = args.particulars.trim();
    if (args.currency !== undefined) patch.currency = args.currency;
    if (args.cardAmount !== undefined) patch.cardAmount = args.cardAmount;
    if (args.cashAmount !== undefined) patch.cashAmount = args.cashAmount;
    if (args.epayAmount !== undefined) patch.epayAmount = args.epayAmount;
    if (args.paidBy !== undefined) {
      if (!args.paidBy.trim()) {
        throw new ConvexError("Paid by is required");
      }
      patch.paidBy = args.paidBy.trim();
    }
    if (args.notes !== undefined) patch.notes = args.notes.trim();

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

    await ctx.db.patch(id, patch);
    await createActivity(ctx, access, {
      entityType: "expense",
      entityId: id,
      action: "updated",
      message: `${(args.category ?? expense.category).trim()} expense updated`,
    });
    return { id };
  },
});

export const getFinanceOverview = query({
  args: {
    period: v.optional(portalPeriodValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
    const period = (args.period ?? "all") as PortalPeriod;
    const [invoiceRows, expenseRows, jobCardRows] = await Promise.all([
      ctx.db.query("invoices").collect(),
      ctx.db.query("expenseEntries").collect(),
      ctx.db.query("jobCards").collect(),
    ]);
    const invoices = filterRecordsByCreatedAt(invoiceRows, period);
    const expenses = filterRecordsByCreatedAt(expenseRows, period);
    const allJobCards = filterRecordsByCreatedAt(jobCardRows, period);
    const jobCards = (
      await Promise.all(
        allJobCards.map(async (job) => {
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
        }),
      )
    ).filter(isDefined);
    const visibleJobIds = new Set(jobCards.map((job) => job._id));
    const visibleInvoices = invoices.filter((invoice) => visibleJobIds.has(invoice.jobCardId));
    const visibleExpenses = expenses.filter((expense) =>
      expense.jobCardId ? visibleJobIds.has(expense.jobCardId) : true,
    );
    const rows = [];
    for (const job of jobCards.sort((a, b) => b.createdAt - a.createdAt)) {
      const jobInvoices = visibleInvoices.filter((invoice) => invoice.jobCardId === job._id);
      const jobExpenses = visibleExpenses.filter(
        (expense) => expense.jobCardId === job._id && expense.approvalStatus === "Approved",
      );
      const revenue = jobInvoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
      const expenseTotal = jobExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const profit = revenue - expenseTotal;
      rows.push({
        id: job._id,
        jobCode: job.jobCode,
        clientName: job.clientName,
        revenue,
        expense: expenseTotal,
        profit,
        marginPercent: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const pendingReimbursements = visibleExpenses
      .filter(
        (expense) =>
          expense.approvalStatus === "Approved" && expense.reimbursementStatus === "Pending",
      )
      .reduce((sum, expense) => sum + (expense.amount ?? 0), 0);
    const pendingExpenseApprovals = visibleExpenses
      .filter((expense) => expense.approvalStatus === "Pending")
      .reduce((sum, expense) => sum + (expense.amount ?? 0), 0);
    const expectedCollections = visibleInvoices.reduce(
      (sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0),
      0,
    );
    const advancePipeline = jobCards
      .filter((job) => job.status !== "Closed")
      .reduce((sum, job) => {
        const jobInvoices = visibleInvoices.filter((invoice) => invoice.jobCardId === job._id);
        const revenue = jobInvoices.reduce((total, invoice) => total + invoice.expectedAmount, 0);
        const terms = job.paymentTerms as { minAdvancePercent?: number } | null;
        const advancePercent = terms?.minAdvancePercent ?? 70;
        return sum + Math.round((revenue * advancePercent) / 100);
      }, 0);

    const jobCardsById = new Map(jobCards.map((job) => [job._id, job]));
    const outstanding = [];
    for (const invoice of visibleInvoices) {
      if (invoice.balanceAmount <= 0) {
        continue;
      }
      const job = jobCardsById.get(invoice.jobCardId);
      outstanding.push({
        id: invoice._id,
        clientName: job?.clientName ?? "",
        jobCode: job?.jobCode ?? "",
        dueAmount: invoice.balanceAmount,
        dueDate: invoice.dueDate ?? "",
        status:
          invoice.dueDate && invoice.dueDate < today
            ? "Overdue"
            : invoice.dueDate === today
              ? "Upcoming"
              : "Future",
      });
    }

    return {
      fundProjections: {
        expectedCollections,
        advancePipeline,
        pendingReimbursements,
        pendingExpenseApprovals,
      },
      pnl: rows,
      outstanding,
      summary: {
        totalRevenue: visibleInvoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0),
        clientOutstanding: visibleInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
        approvedExpenses: visibleExpenses
          .filter((expense) => expense.approvalStatus === "Approved")
          .reduce((sum, expense) => sum + expense.amount, 0),
      },
    };
  },
});

export const submitExpenseForApproval = mutation({
  args: {
    expenseId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_EXPENSES);
    const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!expenseId) {
      throw new ConvexError("Invalid expense id");
    }
    const expense = await ctx.db.get(expenseId);
    if (!expense) {
      throw new ConvexError("Expense not found");
    }
    await assertExpenseAccess(ctx, access, expense);
    const existing = await ctx.db
      .query("approvalRequests")
      .withIndex("by_entity", (q) => q.eq("entityType", "expense").eq("entityId", expenseId))
      .collect();
    if (existing.some((approval) => approval.status === "Pending")) {
      return { id: existing.find((approval) => approval.status === "Pending")?._id };
    }
    const now = Date.now();
    const requestCode = await nextCode(ctx, "approvalRequests", "APR");
    const approvalId = await ctx.db.insert("approvalRequests", {
      requestCode,
      type: "Expense",
      entityType: "expense",
      entityId: expenseId,
      requestedBy: access.authUserId ?? "unknown",
      requestedByName: access.name,
      summary: `${expense.category} expense for ${(expense.amount ?? 0).toLocaleString("en-IN")}`,
      amount: expense.amount ?? 0,
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(expenseId, {
      submittedForApprovalAt: now,
      approvalStatus: "Pending",
      reimbursementStatus: "Pending",
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "expense",
      entityId: expenseId,
      action: "submitted_for_approval",
      message: `${requestCode} created for expense approval`,
    });
    await notifyRoles(ctx, ["Finance", "Directors"], {
      title: "Expense approval requested",
      body: `${requestCode}: ${expense.category} expense needs approval.`,
      entityType: "approval",
      entityId: approvalId,
    });
    return { id: approvalId };
  },
});

export const updateExpenseStatus = mutation({
  args: {
    expenseId: v.string(),
    approvalStatus: v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Rejected")),
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
    const expense = await ctx.db.get(id);
    if (!expense) {
      throw new ConvexError("Expense not found");
    }
    await assertExpenseAccess(ctx, access, expense);
    await ctx.db.patch(id, {
      approvalStatus: args.approvalStatus,
      reimbursementStatus: args.reimbursementStatus,
      updatedAt: Date.now(),
    });
    const approvalRows = await ctx.db
      .query("approvalRequests")
      .withIndex("by_entity", (q) => q.eq("entityType", "expense").eq("entityId", id))
      .collect();
    await Promise.all(
      approvalRows.flatMap((approval) => {
        if (approval.status !== "Pending") {
          return [];
        }
        const approvalPatch: Record<string, unknown> = {
          status: args.approvalStatus === "Pending" ? "Pending" : args.approvalStatus,
          updatedAt: Date.now(),
        };
        if (args.approvalStatus !== "Pending") {
          approvalPatch.decidedBy = access.authUserId;
          approvalPatch.decidedByName = access.name;
          approvalPatch.decidedAt = Date.now();
        }
        return [ctx.db.patch(approval._id, approvalPatch)];
      }),
    );
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
    await assertExpenseAccess(ctx, access, expense);
    await createActivity(ctx, access, {
      entityType: "expense",
      entityId: id,
      action: "deleted",
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
  },
});
