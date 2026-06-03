import { describe, expect, test } from "bun:test";
import {
  buildOverdueInvoices,
  buildPipelineSnapshot,
  buildTicketAttentionQueue,
  buildUrgentActions,
  getPortalSummary,
} from "./dashboard";

function makeCtx(tables: Record<string, any[]>, staffRoles = ["Admin"]) {
  const staff = {
    _id: "staff_1",
    authUserId: "auth_1",
    email: "admin@example.com",
    emailNormalized: "admin@example.com",
    name: "Admin User",
    roles: staffRoles,
    active: true,
  };

  const getRows = (table: string) => (table === "staffUsers" ? [staff] : (tables[table] ?? []));

  return {
    auth: {
      getUserIdentity: async () => ({
        subject: "auth_1",
        email: "admin@example.com",
        name: "Admin User",
      }),
    },
    db: {
      query: (table: string) => ({
        collect: async () => getRows(table),
        withIndex: () => ({
          unique: async () => getRows(table).find((row) => row.active) ?? null,
        }),
      }),
    },
  };
}

describe("buildUrgentActions", () => {
  test("adds entity metadata and hrefs for each urgent action type", () => {
    const actions = buildUrgentActions({
      approvals: [
        {
          _id: "approval_1",
          status: "Pending",
          requestCode: "APR-1",
          summary: "Expense review",
        },
      ],
      invoices: [
        {
          _id: "invoice_1",
          invoiceNumber: "INV-1",
          balanceAmount: 500,
          dueDate: "2026-01-01",
        },
      ],
      queries: [{ _id: "query_1", salesStatus: "Order Confirmed", queryCode: "Q-1" }],
      jobCards: [],
      tickets: [
        {
          _id: "ticket_1",
          ticketNumber: "TKT-1",
          ticketStatus: "Reissue Required",
        },
      ],
      nowDate: "2026-02-01",
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "approval_1",
        type: "approvals",
        entityType: "approval",
        entityId: "approval_1",
        href: "/portal/approvals?open=approval&id=approval_1",
      }),
      expect.objectContaining({
        id: "invoice_1",
        type: "finance",
        entityType: "invoice",
        entityId: "invoice_1",
        href: "/portal/finance",
      }),
      expect.objectContaining({
        id: "query_1",
        type: "accounts",
        entityType: "query",
        entityId: "query_1",
        href: "/portal/accounts/job-cards?open=jobCard&queryId=query_1",
      }),
      expect.objectContaining({
        id: "ticket_1",
        type: "ticketing",
        entityType: "ticket",
        entityId: "ticket_1",
        href: "/portal/tickets?open=ticket&id=ticket_1",
      }),
    ]);
  });

  test("does not ask accounts to create a job card that already exists", () => {
    const actions = buildUrgentActions({
      approvals: [],
      invoices: [],
      queries: [{ _id: "query_1", salesStatus: "Order Confirmed", queryCode: "Q-1" }],
      jobCards: [{ queryId: "query_1" }],
      tickets: [],
      nowDate: "2026-02-01",
    });

    expect(actions).toEqual([]);
  });
});

describe("dashboard summary slices", () => {
  test("builds lead-stage pipeline buckets with missing lead stages counted as Inquiry", () => {
    expect(
      buildPipelineSnapshot([
        { leadStage: "Proposal" },
        { leadStage: "Proposal" },
        { leadStage: "Lost" },
        {},
      ]),
    ).toEqual([
      { stage: "Inquiry", count: 1 },
      { stage: "Proposal", count: 2 },
      { stage: "Negotiation", count: 0 },
      { stage: "Confirmation", count: 0 },
      { stage: "Lost", count: 1 },
    ]);
  });

  test("returns the oldest eight overdue invoices with job-card client names", () => {
    const invoices = Array.from({ length: 10 }, (_, index) => ({
      _id: `invoice_${index}`,
      jobCardId: index % 2 === 0 ? "job_1" : "job_2",
      invoiceNumber: `INV-${index}`,
      balanceAmount: 100 + index,
      dueDate: `2026-01-${String(index + 1).padStart(2, "0")}`,
    }));

    expect(
      buildOverdueInvoices({
        invoices: [
          ...invoices,
          {
            _id: "paid_invoice",
            jobCardId: "job_1",
            invoiceNumber: "INV-PAID",
            balanceAmount: 0,
            dueDate: "2026-01-01",
          },
          {
            _id: "future_invoice",
            jobCardId: "job_1",
            invoiceNumber: "INV-FUTURE",
            balanceAmount: 1000,
            dueDate: "2026-03-01",
          },
        ],
        jobCards: [
          { _id: "job_1", clientName: "Acme" },
          { _id: "job_2", clientName: "Globex" },
        ],
        nowDate: "2026-02-01",
      }),
    ).toEqual(
      invoices.slice(0, 8).map((invoice, index) => ({
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: index % 2 === 0 ? "Acme" : "Globex",
        balanceAmount: invoice.balanceAmount,
        dueDate: invoice.dueDate,
      })),
    );
  });

  test("returns only ticket statuses that need attention", () => {
    expect(
      buildTicketAttentionQueue([
        { _id: "ticket_1", ticketNumber: "TKT-1", ticketStatus: "Issued" },
        { _id: "ticket_2", ticketNumber: "TKT-2", ticketStatus: "Name Change Required" },
        { _id: "ticket_3", ticketStatus: "Refund Pending" },
      ]),
    ).toEqual([
      {
        id: "ticket_2",
        ticketNumber: "TKT-2",
        ticketStatus: "Name Change Required",
      },
      {
        id: "ticket_3",
        ticketNumber: "ticket_3",
        ticketStatus: "Refund Pending",
      },
    ]);
  });
});

describe("getPortalSummary", () => {
  test("returns generatedAt and keeps cement scope on query counts", async () => {
    const summary = await getPortalSummary._handler(
      makeCtx(
        {
          queries: [
            {
              _id: "query_cement",
              queryCode: "Q-C",
              queryType: "Cement",
              salesStatus: "Proposal in discussion",
              contractingStatus: "Query Received",
              leadStage: "Proposal",
              createdBy: "auth_1",
              createdAt: Date.UTC(2026, 0, 1),
            },
            {
              _id: "query_mice",
              queryCode: "Q-M",
              queryType: "MICE",
              salesStatus: "Proposal in discussion",
              contractingStatus: "Query Received",
              leadStage: "Inquiry",
              createdBy: "auth_1",
              createdAt: Date.UTC(2026, 0, 1),
            },
          ],
          proposals: [],
          proposalQueryLinks: [],
          jobCards: [],
          travellers: [],
          tickets: [],
          visaRecords: [],
          invoices: [],
          approvalRequests: [],
          activityLogs: [],
        },
        ["Sales Cement"],
      ) as any,
      { dateRange: null },
    );

    expect(Date.parse(summary.generatedAt)).not.toBeNaN();
    expect(summary.metrics.activeQueries).toBe(1);
    expect(summary.queriesByType).toEqual([
      { type: "Cement", count: 1 },
      { type: "Cement Bidding", count: 0 },
    ]);
    expect(summary.pipelineSnapshot).toEqual([
      { stage: "Inquiry", count: 0 },
      { stage: "Proposal", count: 1 },
      { stage: "Negotiation", count: 0 },
      { stage: "Confirmation", count: 0 },
      { stage: "Lost", count: 0 },
    ]);
  });
});
