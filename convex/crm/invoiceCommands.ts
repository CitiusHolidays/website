import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { scheduleFinanceMetricSync } from "./financeMetricSync";
import { hasOutstandingInvoiceBalance } from "./invoiceOutstandingPolicy";
import { getVisibleJob } from "./jobCardVisibility";
import { createActivity, deleteEntityNotifications, PERMISSIONS, requireStaff } from "./lib";

function invoicePaymentStatus(
  balanceAmount: number,
  receivedAmount: number,
  previousStatus?: string
) {
  if (balanceAmount === 0) {
    return "Paid";
  }
  if (receivedAmount > 0) {
    return "Part Paid";
  }
  if (previousStatus === "Draft") {
    return "Draft";
  }
  return "Generated";
}

export async function handleCreateInvoice(
  ctx: MutationCtx,
  args: {
    dueDate?: string;
    expectedAmount: number;
    invoiceNumber: string;
    jobCardId: string;
    receivedAmount?: number;
  }
) {
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
    hasOutstandingBalance: hasOutstandingInvoiceBalance(balanceAmount),
    invoiceNumber: args.invoiceNumber.trim(),
    jobCardId,
    receivedAmount,
    status: invoicePaymentStatus(balanceAmount, receivedAmount),
    updatedAt: now,
  });
  await Promise.all([
    createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "invoice",
      message: `${args.invoiceNumber.trim()} invoice generated`,
    }),
    scheduleFinanceMetricSync(ctx, "invoices", id),
  ]);
  return { id };
}

export async function handleUpdateInvoice(
  ctx: MutationCtx,
  args: {
    dueDate?: string;
    expectedAmount?: number;
    invoiceId: string;
    invoiceNumber?: string;
    receivedAmount?: number;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_FINANCE);
  const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);
  if (!invoiceId) {
    throw new ConvexError("Invalid invoice id");
  }
  const invoice = await ctx.db.get("invoices", invoiceId);
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
  const patch: RuntimeObject = {
    balanceAmount,
    expectedAmount,
    hasOutstandingBalance: hasOutstandingInvoiceBalance(balanceAmount),
    receivedAmount,
    status: invoicePaymentStatus(balanceAmount, receivedAmount, invoice.status),
    updatedAt: Date.now(),
  };
  if (args.invoiceNumber !== undefined) {
    patch.invoiceNumber = args.invoiceNumber.trim();
  }
  if (args.dueDate !== undefined) {
    patch.dueDate = args.dueDate;
  }

  await ctx.db.patch("invoices", invoiceId, patch);
  await Promise.all([
    createActivity(ctx, access, {
      action: "updated",
      entityId: invoiceId,
      entityType: "invoice",
      message: `${(args.invoiceNumber ?? invoice.invoiceNumber).trim()} invoice updated`,
    }),
    scheduleFinanceMetricSync(ctx, "invoices", invoiceId),
  ]);
  return { id: invoiceId };
}

export async function handleRemoveInvoice(ctx: MutationCtx, args: { invoiceId: string }) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_FINANCE);
  const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);
  if (!invoiceId) {
    throw new ConvexError("Invalid invoice id");
  }
  const invoice = await ctx.db.get("invoices", invoiceId);
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
    ctx.db.delete("invoices", invoiceId),
    scheduleFinanceMetricSync(ctx, "invoices", invoiceId),
  ]);
  return { id: invoiceId };
}
