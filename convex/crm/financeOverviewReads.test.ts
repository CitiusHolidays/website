import { describe, expect, test } from "bun:test";
import {
  buildFinanceOverviewFromMetrics,
  handleListFinanceOutstanding,
} from "./financeOverviewReads";

describe("Bounded finance overview", () => {
  test("Builds complete all-time totals from aggregate values rather than a detail page", () => {
    const overview = buildFinanceOverviewFromMetrics({
      "expenseEntries.approved": 3_750_000,
      "expenseEntries.pendingApproval": 125_000,
      "expenseEntries.pendingReimbursement": 250_000,
      "invoices.advancePipeline": 8_100_000,
      "invoices.expected": 12_000_000,
      "invoices.outstanding": 4_500_000,
    });

    expect(overview).toEqual({
      fundProjections: {
        advancePipeline: 8_100_000,
        expectedCollections: 4_500_000,
        pendingExpenseApprovals: 125_000,
        pendingReimbursements: 250_000,
      },
      summary: {
        approvedExpenses: 3_750_000,
        clientOutstanding: 4_500_000,
        totalRevenue: 12_000_000,
      },
    });
  });

  test("Returns a 135-row outstanding dataset through three stable cursor pages", async () => {
    const invoices = Array.from({ length: 135 }, (_, index) => ({
      _id: `invoice-${index + 1}`,
      balanceAmount: 1000 + index,
      createdAt: 10_000 - index,
      dueDate: "2026-09-01",
      jobCardId: `job-${index + 1}`,
    }));
    const jobs = new Map(
      invoices.map((invoice, index) => [
        invoice.jobCardId,
        {
          _id: invoice.jobCardId,
          clientName: `Client ${index + 1}`,
          jobCode: `JC-${index + 1}`,
        },
      ])
    );
    const staff = {
      _id: "staff-finance",
      active: true,
      authUserId: "auth-finance",
      email: "finance@example.com",
      name: "Finance User",
      roles: ["Finance"],
    };
    const ctx = {
      auth: {
        getUserIdentity: () => ({ email: staff.email, subject: staff.authUserId }),
      },
      db: {
        get: (_table: string, id: string) => jobs.get(id) ?? null,
        query: (table: string) => {
          if (table === "staffUsers") {
            return {
              withIndex: () => ({ take: () => [staff] }),
            };
          }
          if (table === "invoiceOutstandingProjectionReadiness") {
            return {
              withIndex: () => ({ unique: () => null }),
            };
          }
          if (table !== "invoices") {
            throw new Error(`Unexpected table ${table}`);
          }
          const builder = {
            filter: () => builder,
            order: () => builder,
            paginate: ({
              cursor: pageCursor,
              numItems,
            }: {
              cursor: string | null;
              numItems: number;
            }) => {
              const offset = pageCursor ? Number(pageCursor) : 0;
              const page = invoices.slice(offset, offset + numItems);
              const nextOffset = offset + page.length;
              return {
                continueCursor: String(nextOffset),
                isDone: nextOffset >= invoices.length,
                page,
              };
            },
            withIndex: () => builder,
          };
          return builder;
        },
      },
    };

    const pages: Array<{ id: string }> = [];
    let cursor: string | null = null;
    for (const expectedLength of [50, 50, 35]) {
      // biome-ignore lint/performance/noAwaitInLoops: each cursor depends on the preceding page
      const page = await handleListFinanceOutstanding(ctx, {
        paginationOpts: { cursor, numItems: 50 },
        referenceDate: "2026-08-13",
      });
      expect(page.page).toHaveLength(expectedLength);
      pages.push(...page.page);
      cursor = page.continueCursor;
    }

    expect(pages).toHaveLength(135);
    expect(pages.map((row) => row.id)).toEqual(invoices.map((invoice) => invoice._id));
  });
});
