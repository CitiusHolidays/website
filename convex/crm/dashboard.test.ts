import { describe, expect, test } from "bun:test";
import {
  buildOverdueInvoices,
  buildPipelineSnapshot,
  buildTicketAttentionQueue,
  buildUrgentActions,
  getPortalSummary,
  groupByJobCardId,
} from "./dashboard";

function makeCtx(tables: Record<string, any[]>, staffRoles = ["Admin"]) {
  const staff = {
    _id: "staff_1",
    active: true,
    authUserId: "auth_1",
    email: "admin@example.com",
    emailNormalized: "admin@example.com",
    name: "Admin User",
    roles: staffRoles,
  };

  const activityTakeCalls: number[] = [];
  const getRows = (table: string) => (table === "staffUsers" ? [staff] : (tables[table] ?? []));

  const queryBuilder = (table: string) => ({
    collect: async () => getRows(table),
    withIndex: (indexName: string) => {
      if (table === "activityLogs" && indexName === "by_createdAt") {
        return {
          order: (_direction: string) => ({
            take: async (limit: number) => {
              activityTakeCalls.push(limit);
              return [...getRows(table)].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
            },
          }),
          unique: async () => getRows(table).find((row) => row.active) ?? null,
        };
      }
      return {
        unique: async () => getRows(table).find((row) => row.active) ?? null,
      };
    },
  });

  return {
    activityTakeCalls,
    auth: {
      getUserIdentity: async () => ({
        email: "admin@example.com",
        name: "Admin User",
        subject: "auth_1",
      }),
    },
    db: {
      query: (table: string) => queryBuilder(table),
    },
  };
}

describe("buildUrgentActions", () => {
  test("adds entity metadata and hrefs for each urgent action type", () => {
    const actions = buildUrgentActions({
      approvals: [
        {
          _id: "approval_1",
          requestCode: "APR-1",
          status: "Pending",
          summary: "Expense review",
        },
      ],
      invoices: [
        {
          _id: "invoice_1",
          balanceAmount: 500,
          dueDate: "2026-01-01",
          invoiceNumber: "INV-1",
        },
      ],
      jobCards: [],
      nowDate: "2026-02-01",
      queries: [{ _id: "query_1", queryCode: "Q-1", salesStatus: "Order Confirmed" }],
      tickets: [
        {
          _id: "ticket_1",
          ticketNumber: "TKT-1",
          ticketStatus: "Reissue Required",
        },
      ],
    });

    expect(actions).toEqual([
      expect.objectContaining({
        entityId: "approval_1",
        entityType: "approval",
        href: "/portal/approvals?open=approval&id=approval_1",
        id: "approval_1",
        type: "approvals",
      }),
      expect.objectContaining({
        entityId: "invoice_1",
        entityType: "invoice",
        href: "/portal/finance",
        id: "invoice_1",
        type: "finance",
      }),
      expect.objectContaining({
        entityId: "query_1",
        entityType: "query",
        href: "/portal/accounts/job-cards?open=jobCard&queryId=query_1",
        id: "query_1",
        type: "accounts",
      }),
      expect.objectContaining({
        entityId: "ticket_1",
        entityType: "ticket",
        href: "/portal/tickets?open=ticket&id=ticket_1",
        id: "ticket_1",
        type: "ticketing",
      }),
    ]);
  });

  test("does not ask accounts to create a job card that already exists", () => {
    const actions = buildUrgentActions({
      approvals: [],
      invoices: [],
      jobCards: [{ queryId: "query_1" }],
      nowDate: "2026-02-01",
      queries: [{ _id: "query_1", queryCode: "Q-1", salesStatus: "Order Confirmed" }],
      tickets: [],
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
      ])
    ).toEqual([
      { count: 1, stage: "Inquiry", value: 0, weighted: 0 },
      { count: 2, stage: "Proposal", value: 0, weighted: 0 },
      { count: 0, stage: "Negotiation", value: 0, weighted: 0 },
      { count: 0, stage: "Confirmation", value: 0, weighted: 0 },
      { count: 1, stage: "Lost", value: 0, weighted: 0 },
    ]);
  });

  test("returns the oldest eight overdue invoices with job-card client names", () => {
    const invoices = Array.from({ length: 10 }, (_, index) => ({
      _id: `invoice_${index}`,
      balanceAmount: 100 + index,
      dueDate: `2026-01-${String(index + 1).padStart(2, "0")}`,
      invoiceNumber: `INV-${index}`,
      jobCardId: index % 2 === 0 ? "job_1" : "job_2",
    }));

    expect(
      buildOverdueInvoices({
        invoices: [
          ...invoices,
          {
            _id: "paid_invoice",
            balanceAmount: 0,
            dueDate: "2026-01-01",
            invoiceNumber: "INV-PAID",
            jobCardId: "job_1",
          },
          {
            _id: "future_invoice",
            balanceAmount: 1000,
            dueDate: "2026-03-01",
            invoiceNumber: "INV-FUTURE",
            jobCardId: "job_1",
          },
        ],
        jobCards: [
          { _id: "job_1", clientName: "Acme" },
          { _id: "job_2", clientName: "Globex" },
        ],
        nowDate: "2026-02-01",
      })
    ).toEqual(
      invoices.slice(0, 8).map((invoice, index) => ({
        balanceAmount: invoice.balanceAmount,
        clientName: index % 2 === 0 ? "Acme" : "Globex",
        dueDate: invoice.dueDate,
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
      }))
    );
  });

  test("returns only ticket statuses that need attention", () => {
    expect(
      buildTicketAttentionQueue([
        { _id: "ticket_1", ticketNumber: "TKT-1", ticketStatus: "Issued" },
        { _id: "ticket_2", ticketNumber: "TKT-2", ticketStatus: "Name Change Required" },
        { _id: "ticket_3", ticketStatus: "Refund Pending" },
      ])
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
    const { activityTakeCalls, ...ctx } = makeCtx(
      {
        activityLogs: [],
        approvalRequests: [],
        invoices: [],
        jobCards: [],
        proposalQueryLinks: [],
        proposals: [],
        queries: [
          {
            _id: "query_cement",
            contractingStatus: "Query Received",
            createdAt: Date.UTC(2026, 0, 1),
            createdBy: "auth_1",
            leadStage: "Proposal",
            queryCode: "Q-C",
            queryType: "Cement",
            salesStatus: "Proposal in discussion",
          },
          {
            _id: "query_mice",
            contractingStatus: "Query Received",
            createdAt: Date.UTC(2026, 0, 1),
            createdBy: "auth_1",
            leadStage: "Inquiry",
            queryCode: "Q-M",
            queryType: "MICE",
            salesStatus: "Proposal in discussion",
          },
        ],
        tickets: [],
        travellers: [],
        visaRecords: [],
      },
      ["Sales Cement"]
    );
    const summary = await getPortalSummary._handler(ctx as any, { dateRange: null });

    expect(activityTakeCalls).toEqual([8]);
    expect(Date.parse(summary.generatedAt)).not.toBeNaN();
    expect(summary.metrics.activeQueries).toBe(1);
    expect(summary.queriesByType).toEqual([
      { count: 1, type: "Cement" },
      { count: 0, type: "Cement Bidding" },
    ]);
    expect(summary.pipelineSnapshot).toEqual([
      { count: 0, stage: "Inquiry", value: 0, weighted: 0 },
      { count: 1, stage: "Proposal", value: 0, weighted: 0 },
      { count: 0, stage: "Negotiation", value: 0, weighted: 0 },
      { count: 0, stage: "Confirmation", value: 0, weighted: 0 },
      { count: 0, stage: "Lost", value: 0, weighted: 0 },
    ]);
  });
});

describe("groupByJobCardId", () => {
  test("groups travellers by job card id", () => {
    expect(
      groupByJobCardId([
        { fullName: "A", jobCardId: "job_1" },
        { fullName: "B", jobCardId: "job_2" },
        { fullName: "C", jobCardId: "job_1" },
      ] as any)
    ).toEqual(
      new Map([
        [
          "job_1",
          [
            { fullName: "A", jobCardId: "job_1" },
            { fullName: "C", jobCardId: "job_1" },
          ],
        ],
        ["job_2", [{ fullName: "B", jobCardId: "job_2" }]],
      ])
    );
  });
});

describe("getPortalSummary response shape", () => {
  test("returns the dashboard top-level keys", async () => {
    const ctx = makeCtx({
      activityLogs: [],
      approvalRequests: [],
      invoices: [],
      jobCards: [],
      proposalQueryLinks: [],
      proposals: [],
      queries: [],
      tickets: [],
      travellers: [],
      visaRecords: [],
    });

    const summary = await getPortalSummary._handler(ctx as any, { dateRange: null });

    expect(Object.keys(summary).sort()).toEqual(
      [
        "activeTours",
        "capacity",
        "closedQueriesByType",
        "confirmedQueriesByType",
        "departmentWorkflow",
        "generatedAt",
        "metricTrends",
        "metrics",
        "myTeam",
        "overdueInvoices",
        "pipelineSnapshot",
        "progress",
        "queriesByType",
        "recentActivity",
        "ticketAttentionQueue",
        "ticketingStats",
        "upcomingDepartures",
        "urgentActions",
      ].sort()
    );
  });
});
