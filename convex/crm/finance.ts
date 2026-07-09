import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import {
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  filterRecordsByDateRange,
  isDefined,
  isDirectorOrAdmin,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  type PortalDateRange,
  portalDateRangeValidator,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const expenseCurrencyValidator = v.union(
  v.literal("INR"),
  v.literal("USD"),
  v.literal("AED"),
  v.literal("EUR"),
  v.literal("THB"),
  v.literal("SGD")
);

const expenseDecisionValidator = v.union(v.literal("Approved"), v.literal("Rejected"));

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
          if (!job) {
            return null;
          }
          return {
            balanceAmount: invoice.balanceAmount,
            clientName: job?.clientName ?? "",
            dueDate: invoice.dueDate ?? "",
            expectedAmount: invoice.expectedAmount,
            generatedAt: invoice.generatedAt ? new Date(invoice.generatedAt).toISOString() : null,
            id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            jobCardId: invoice.jobCardId,
            jobCode: job?.jobCode ?? "",
            receivedAmount: invoice.receivedAmount,
            status: invoice.status,
          };
        })
    );
    return result.filter(Boolean);
  },
});

export const createInvoice = mutation({
  args: {
    dueDate: v.optional(v.string()),
    expectedAmount: v.number(),
    invoiceNumber: v.string(),
    jobCardId: v.string(),
    receivedAmount: v.optional(v.number()),
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
      balanceAmount,
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
      dueDate: args.dueDate || "",
      expectedAmount: args.expectedAmount,
      generatedAt: now,
      invoiceNumber: args.invoiceNumber.trim(),
      jobCardId,
      receivedAmount,
      status: balanceAmount === 0 ? "Paid" : receivedAmount > 0 ? "Part Paid" : "Generated",
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "invoice",
      message: `${args.invoiceNumber.trim()} invoice generated`,
    });
    return { id };
  },
});

export const updateInvoice = mutation({
  args: {
    dueDate: v.optional(v.string()),
    expectedAmount: v.optional(v.number()),
    invoiceId: v.string(),
    invoiceNumber: v.optional(v.string()),
    receivedAmount: v.optional(v.number()),
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
      balanceAmount,
      expectedAmount,
      receivedAmount,
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
    if (args.invoiceNumber !== undefined) {
      patch.invoiceNumber = args.invoiceNumber.trim();
    }
    if (args.dueDate !== undefined) {
      patch.dueDate = args.dueDate;
    }

    await ctx.db.patch(invoiceId, patch);
    await createActivity(ctx, access, {
      action: "updated",
      entityId: invoiceId,
      entityType: "invoice",
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
        action: "deleted",
        entityId: invoiceId,
        entityType: "invoice",
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

async function staffByAuthUserId(ctx: any, authUserId?: string) {
  if (!authUserId) {
    return null;
  }
  return await ctx.db
    .query("staffUsers")
    .withIndex("by_authUserId", (q: any) => q.eq("authUserId", authUserId))
    .unique();
}

async function resolveExpenseSubmitterAndManager(ctx: any, access: any, expense: any) {
  const submitter =
    (await staffByAuthUserId(ctx, expense.createdBy)) ??
    (access.staffId ? await ctx.db.get(access.staffId) : null);
  const managerId = submitter?.reportingManagerStaffId ?? null;
  const manager = managerId ? await ctx.db.get(managerId) : null;
  if (!submitter) {
    throw new ConvexError("Expense submitter staff record not found");
  }
  if (!manager?.active) {
    if (isDirectorOrAdmin(access)) {
      return { manager: null, submitter };
    }
    throw new ConvexError("Reporting manager is not configured for this expense submitter");
  }
  return { manager, submitter };
}

function canApproveExpenseAsManager(access: any, expense: any) {
  return (
    isDirectorOrAdmin(access) ||
    Boolean(
      expense.managerApproverStaffId &&
        access.staffId &&
        String(expense.managerApproverStaffId) === String(access.staffId)
    )
  );
}

async function notifyExpenseSubmitter(
  ctx: any,
  expense: any,
  input: Parameters<typeof notifyRoles>[2]
) {
  const submitter = await staffByAuthUserId(ctx, expense.createdBy);
  if (submitter?._id) {
    await notifyStaffMember(ctx, submitter._id, input);
  }
}

export const listExpenses = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES),
      ctx.db.query("expenseEntries").collect(),
    ]);
    const permissionSet = new Set(access.permissions);
    const canApproveFinancePermission =
      permissionSet.has(PERMISSIONS.APPROVE_EXPENSES) ||
      permissionSet.has(PERMISSIONS.MANAGE_FINANCE);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (expense) => {
          const [job, proofAttachment] = await Promise.all([
            expense.jobCardId ? getVisibleJob(ctx, access, expense.jobCardId) : null,
            expense.proofAttachmentId ? ctx.db.get(expense.proofAttachmentId) : null,
          ]);
          if (expense.jobCardId && !job) {
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
        })
    );
    return result.filter(Boolean);
  },
});

export const createExpense = mutation({
  args: {
    amount: v.optional(v.number()),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    category: v.string(),
    currency: v.optional(expenseCurrencyValidator),
    epayAmount: v.optional(v.number()),
    expenseDate: v.optional(v.string()),
    jobCardId: v.optional(v.string()),
    notes: v.optional(v.string()),
    paidBy: v.string(),
    particulars: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      args.cardAmount !== undefined ||
      args.cashAmount !== undefined ||
      args.epayAmount !== undefined;
    const amount = hasSplit ? splitTotal(args) : (args.amount ?? 0);
    const id = await ctx.db.insert("expenseEntries", {
      amount,
      approvalStatus: "Pending",
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
  },
});

export const updateExpense = mutation({
  args: {
    amount: v.optional(v.number()),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    category: v.optional(v.string()),
    currency: v.optional(expenseCurrencyValidator),
    epayAmount: v.optional(v.number()),
    expenseDate: v.optional(v.string()),
    expenseId: v.string(),
    notes: v.optional(v.string()),
    paidBy: v.optional(v.string()),
    particulars: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
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

    await ctx.db.patch(id, patch);
    await createActivity(ctx, access, {
      action: "updated",
      entityId: id,
      entityType: "expense",
      message: `${(args.category ?? expense.category).trim()} expense updated`,
    });
    return { id };
  },
});

export const getFinanceOverview = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
    const [invoiceRows, expenseRows, jobCardRows] = await Promise.all([
      ctx.db.query("invoices").collect(),
      ctx.db.query("expenseEntries").collect(),
      ctx.db.query("jobCards").collect(),
    ]);
    const invoices = filterRecordsByDateRange(invoiceRows, dateRange);
    const expenses = filterRecordsByDateRange(expenseRows, dateRange);
    const allJobCards = filterRecordsByDateRange(jobCardRows, dateRange);
    const jobCards = (
      await Promise.all(
        allJobCards.map(async (job) => {
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
        })
      )
    ).filter(isDefined);
    const visibleJobIds = new Set(jobCards.map((job) => job._id));
    const visibleInvoices = invoices.filter((invoice) => visibleJobIds.has(invoice.jobCardId));
    const visibleExpenses = expenses.filter((expense) =>
      expense.jobCardId ? visibleJobIds.has(expense.jobCardId) : true
    );
    const rows = [];
    for (const job of jobCards.sort((a, b) => b.createdAt - a.createdAt)) {
      const jobInvoices = visibleInvoices.filter((invoice) => invoice.jobCardId === job._id);
      const jobExpenses = visibleExpenses.filter(
        (expense) => expense.jobCardId === job._id && expense.approvalStatus === "Approved"
      );
      const revenue = jobInvoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
      const expenseTotal = jobExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const profit = revenue - expenseTotal;
      rows.push({
        clientName: job.clientName,
        expense: expenseTotal,
        id: job._id,
        jobCode: job.jobCode,
        marginPercent: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
        profit,
        revenue,
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const pendingReimbursements = visibleExpenses
      .filter(
        (expense) =>
          expense.approvalStatus === "Approved" && expense.reimbursementStatus === "Pending"
      )
      .reduce((sum, expense) => sum + (expense.amount ?? 0), 0);
    const pendingExpenseApprovals = visibleExpenses
      .filter((expense) => expense.approvalStatus === "Pending")
      .reduce((sum, expense) => sum + (expense.amount ?? 0), 0);
    const expectedCollections = visibleInvoices.reduce(
      (sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0),
      0
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
        clientName: job?.clientName ?? "",
        dueAmount: invoice.balanceAmount,
        dueDate: invoice.dueDate ?? "",
        id: invoice._id,
        jobCode: job?.jobCode ?? "",
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
        advancePipeline,
        expectedCollections,
        pendingExpenseApprovals,
        pendingReimbursements,
      },
      outstanding,
      pnl: rows,
      summary: {
        approvedExpenses: visibleExpenses
          .filter((expense) => expense.approvalStatus === "Approved")
          .reduce((sum, expense) => sum + expense.amount, 0),
        clientOutstanding: visibleInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
        totalRevenue: visibleInvoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0),
      },
    };
  },
});

async function createFinanceExpenseApproval(ctx: any, access: any, expenseId: any, expense: any) {
  const existing = await ctx.db
    .query("approvalRequests")
    .withIndex("by_entity", (q: any) => q.eq("entityType", "expense").eq("entityId", expenseId))
    .collect();
  const pending = existing.find((approval: any) => approval.status === "Pending");
  if (pending) {
    return { id: pending._id };
  }
  const now = Date.now();
  const requestCode = await nextCode(ctx, "approvalRequests", "APR");
  const approvalId = await ctx.db.insert("approvalRequests", {
    amount: expense.amount ?? 0,
    createdAt: now,
    entityId: expenseId,
    entityType: "expense",
    requestCode,
    requestedBy: expense.createdBy ?? access.authUserId ?? "unknown",
    requestedByName: expense.tourManagerName || access.name,
    status: "Pending",
    summary: `${expense.category} expense for ${(expense.amount ?? 0).toLocaleString("en-IN")}`,
    type: "Expense",
    updatedAt: now,
  });
  await notifyRoles(ctx, ["Finance", "Directors"], {
    body: `${requestCode}: ${expense.category} expense is manager-approved and needs Finance approval.`,
    entityId: approvalId,
    entityType: "approval",
    title: "Expense finance approval requested",
  });
  return { id: approvalId };
}

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
    const alreadyPendingSubmission =
      Boolean(expense.submittedForApprovalAt) &&
      (expense.managerReviewStatus ?? "Pending") === "Pending";
    if (alreadyPendingSubmission) {
      if (expense.jobCardId) {
        await assertExpenseAccess(ctx, access, expense);
      }
      return { id: expenseId };
    }
    await assertExpenseAccess(ctx, access, expense);
    const { manager } = await resolveExpenseSubmitterAndManager(ctx, access, expense);
    const now = Date.now();
    const submitPatch: Record<string, unknown> = {
      approvalStatus: "Pending",
      financeReviewStatus: "Pending",
      managerReviewStatus: manager ? "Pending" : "Approved",
      reimbursementStatus: "Pending",
      submittedForApprovalAt: now,
      updatedAt: now,
    };
    const activityMessage = `${expense.category} expense submitted for manager approval`;
    if (manager?._id) {
      submitPatch.managerApproverStaffId = manager._id;
      await ctx.db.patch(expenseId, submitPatch);
      await Promise.all([
        createActivity(ctx, access, {
          action: "submitted_for_approval",
          entityId: expenseId,
          entityType: "expense",
          message: activityMessage,
        }),
        notifyStaffMember(ctx, manager._id, {
          body: `${expense.category} expense for ${(expense.amount ?? 0).toLocaleString("en-IN")} needs your approval.`,
          entityId: expenseId,
          entityType: "expense",
          title: "Expense manager approval requested",
        }),
      ]);
      return { id: expenseId };
    }
    submitPatch.managerReviewedBy = access.authUserId;
    submitPatch.managerReviewedByName = access.name;
    submitPatch.managerReviewedAt = now;
    await ctx.db.patch(expenseId, submitPatch);
    await createActivity(ctx, access, {
      action: "submitted_for_approval",
      entityId: expenseId,
      entityType: "expense",
      message: activityMessage,
    });
    return await createFinanceExpenseApproval(ctx, access, expenseId, expense);
  },
});

export const decideExpenseManager = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    expenseId: v.string(),
    status: expenseDecisionValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES);
    const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!expenseId) {
      throw new ConvexError("Invalid expense id");
    }
    const expense = await ctx.db.get(expenseId);
    if (!expense) {
      throw new ConvexError("Expense not found");
    }
    if ((expense.managerReviewStatus ?? "Pending") !== "Pending") {
      throw new ConvexError("Manager review is already complete");
    }
    if (!canApproveExpenseAsManager(access, expense)) {
      throw new ConvexError("Only the reporting manager can approve this expense stage");
    }
    await assertExpenseAccess(ctx, access, expense);
    const now = Date.now();
    const patch: Record<string, unknown> = {
      managerReviewedAt: now,
      managerReviewedBy: access.authUserId ?? "unknown",
      managerReviewedByName: access.name,
      managerReviewStatus: args.status,
      updatedAt: now,
    };
    if (args.status === "Rejected") {
      patch.approvalStatus = "Rejected";
      patch.reimbursementStatus = "Not Submitted";
    }
    await ctx.db.patch(expenseId, patch);
    await createActivity(ctx, access, {
      action: `manager_${args.status.toLowerCase()}`,
      entityId: expenseId,
      entityType: "expense",
      message: `Expense manager review ${args.status.toLowerCase()}`,
      metadata: { decisionNote: args.decisionNote?.trim() || "" },
    });
    if (args.status === "Approved") {
      await createFinanceExpenseApproval(ctx, access, expenseId, expense);
    } else {
      await notifyExpenseSubmitter(ctx, expense, {
        body: `${expense.category} expense was rejected by your reporting manager.`,
        entityId: expenseId,
        entityType: "expense",
        title: "Expense rejected by manager",
      });
    }
    return { id: expenseId };
  },
});

export const decideExpenseFinance = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    expenseId: v.string(),
    reimbursementStatus: v.optional(
      v.union(v.literal("Not Submitted"), v.literal("Pending"), v.literal("Reimbursed"))
    ),
    status: expenseDecisionValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!expenseId) {
      throw new ConvexError("Invalid expense id");
    }
    const expense = await ctx.db.get(expenseId);
    if (!expense) {
      throw new ConvexError("Expense not found");
    }
    if ((expense.managerReviewStatus ?? "Pending") !== "Approved") {
      throw new ConvexError("Manager approval is required before Finance approval");
    }
    await assertExpenseAccess(ctx, access, expense);
    const now = Date.now();
    await ctx.db.patch(expenseId, {
      approvalStatus: args.status,
      financeReviewedAt: now,
      financeReviewedBy: access.authUserId ?? "unknown",
      financeReviewedByName: access.name,
      financeReviewStatus: args.status,
      reimbursementStatus:
        args.reimbursementStatus ?? (args.status === "Approved" ? "Pending" : "Not Submitted"),
      updatedAt: now,
    });
    const approvalRows = await ctx.db
      .query("approvalRequests")
      .withIndex("by_entity", (q) => q.eq("entityType", "expense").eq("entityId", expenseId))
      .collect();
    await Promise.all(
      approvalRows.flatMap((approval) =>
        approval.status === "Pending"
          ? [
              ctx.db.patch(approval._id, {
                decidedAt: now,
                decidedBy: access.authUserId ?? "unknown",
                decidedByName: access.name,
                decisionNote: args.decisionNote?.trim() || "",
                status: args.status,
                updatedAt: now,
              }),
            ]
          : []
      )
    );
    await createActivity(ctx, access, {
      action: `finance_${args.status.toLowerCase()}`,
      entityId: expenseId,
      entityType: "expense",
      message: `Expense finance review ${args.status.toLowerCase()}`,
    });
    await notifyExpenseSubmitter(ctx, expense, {
      body: `${expense.category} expense was ${args.status.toLowerCase()} by Finance.`,
      entityId: expenseId,
      entityType: "expense",
      title: `Expense ${args.status}`,
    });
    return { id: expenseId };
  },
});

export const updateExpenseStatus = mutation({
  args: {
    approvalStatus: v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Rejected")),
    expenseId: v.string(),
    reimbursementStatus: v.union(
      v.literal("Not Submitted"),
      v.literal("Pending"),
      v.literal("Reimbursed")
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
    if ((expense.managerReviewStatus ?? "Pending") !== "Approved") {
      throw new ConvexError("Manager approval is required before Finance approval");
    }
    await assertExpenseAccess(ctx, access, expense);
    const now = Date.now();
    const expensePatch: Record<string, unknown> = {
      approvalStatus: args.approvalStatus,
      financeReviewStatus: args.approvalStatus === "Pending" ? "Pending" : args.approvalStatus,
      reimbursementStatus: args.reimbursementStatus,
      updatedAt: now,
    };
    if (args.approvalStatus !== "Pending") {
      expensePatch.financeReviewedBy = access.authUserId;
      expensePatch.financeReviewedByName = access.name;
      expensePatch.financeReviewedAt = now;
    }
    await ctx.db.patch(id, expensePatch);
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
          updatedAt: now,
        };
        if (args.approvalStatus !== "Pending") {
          approvalPatch.decidedBy = access.authUserId;
          approvalPatch.decidedByName = access.name;
          approvalPatch.decidedAt = now;
        }
        return [ctx.db.patch(approval._id, approvalPatch)];
      })
    );
    await createActivity(ctx, access, {
      action: "status_updated",
      entityId: id,
      entityType: "expense",
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
  },
});
