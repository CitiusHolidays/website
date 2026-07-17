import {
  filterRecordsByDateRange,
  isDefined,
  PERMISSIONS,
  type PortalDateRange,
  requireStaff,
} from "./lib";
import { canSeeJobCardRecord } from "./lib/recordScope";

const FINANCE_OVERVIEW_ROW_LIMIT = 2000;

export async function handleGetFinanceOverview(ctx: any, args: { dateRange?: PortalDateRange }) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
  const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
  const [invoiceRows, expenseRows, jobCardRows] = await Promise.all([
    ctx.db.query("invoices").withIndex("by_createdAt").order("desc").take(FINANCE_OVERVIEW_ROW_LIMIT),
    ctx.db.query("expenseEntries").withIndex("by_createdAt").order("desc").take(FINANCE_OVERVIEW_ROW_LIMIT),
    ctx.db.query("jobCards").withIndex("by_createdAt").order("desc").take(FINANCE_OVERVIEW_ROW_LIMIT),
  ]);
  const invoices = filterRecordsByDateRange(invoiceRows, dateRange);
  const expenses = filterRecordsByDateRange(expenseRows, dateRange);
  const allJobCards = filterRecordsByDateRange(jobCardRows, dateRange);
  const jobCards = (
    await Promise.all(
      allJobCards.map(async (job: any) => {
        const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
        return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
      })
    )
  ).filter(isDefined);
  const visibleJobIds = new Set(jobCards.map((job: any) => job._id));
  const visibleInvoices = invoices.filter((invoice: any) => visibleJobIds.has(invoice.jobCardId));
  const visibleExpenses = expenses.filter((expense: any) =>
    expense.jobCardId ? visibleJobIds.has(expense.jobCardId) : true
  );
  const rows = [];
  for (const job of jobCards.sort((a: any, b: any) => b.createdAt - a.createdAt)) {
    const jobInvoices = visibleInvoices.filter((invoice: any) => invoice.jobCardId === job._id);
    const jobExpenses = visibleExpenses.filter(
      (expense: any) => expense.jobCardId === job._id && expense.approvalStatus === "Approved"
    );
    const revenue = jobInvoices.reduce(
      (sum: number, invoice: any) => sum + invoice.expectedAmount,
      0
    );
    const expenseTotal = jobExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
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
      (expense: any) =>
        expense.approvalStatus === "Approved" && expense.reimbursementStatus === "Pending"
    )
    .reduce((sum: number, expense: any) => sum + (expense.amount ?? 0), 0);
  const pendingExpenseApprovals = visibleExpenses
    .filter((expense: any) => expense.approvalStatus === "Pending")
    .reduce((sum: number, expense: any) => sum + (expense.amount ?? 0), 0);
  const expectedCollections = visibleInvoices.reduce(
    (sum: number, invoice: any) => sum + Math.max(invoice.balanceAmount ?? 0, 0),
    0
  );
  const advancePipeline = jobCards
    .filter((job: any) => job.status !== "Closed")
    .reduce((sum: number, job: any) => {
      const jobInvoices = visibleInvoices.filter((invoice: any) => invoice.jobCardId === job._id);
      const revenue = jobInvoices.reduce(
        (total: number, invoice: any) => total + invoice.expectedAmount,
        0
      );
      const terms = job.paymentTerms as { minAdvancePercent?: number } | null;
      const advancePercent = terms?.minAdvancePercent ?? 70;
      return sum + Math.round((revenue * advancePercent) / 100);
    }, 0);

  const jobCardsById = new Map(jobCards.map((job: any) => [job._id, job]));
  const outstanding = [];
  for (const invoice of visibleInvoices as any[]) {
    if (invoice.balanceAmount <= 0) {
      continue;
    }
    const job = jobCardsById.get(invoice.jobCardId);
    const status =
      invoice.dueDate && invoice.dueDate < today
        ? ("Overdue" as const)
        : invoice.dueDate === today
          ? ("Upcoming" as const)
          : ("Future" as const);
    outstanding.push({
      clientName: job?.clientName ?? "",
      dueAmount: invoice.balanceAmount,
      dueDate: invoice.dueDate ?? "",
      id: invoice._id,
      jobCode: job?.jobCode ?? "",
      status,
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
        .filter((expense: any) => expense.approvalStatus === "Approved")
        .reduce((sum: number, expense: any) => sum + expense.amount, 0),
      clientOutstanding: visibleInvoices.reduce(
        (sum: number, invoice: any) => sum + invoice.balanceAmount,
        0
      ),
      totalRevenue: visibleInvoices.reduce(
        (sum: number, invoice: any) => sum + invoice.expectedAmount,
        0
      ),
    },
  };
}
