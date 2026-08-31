import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import {
  buildHeadAssignmentSlaItems,
  buildOverdueInvoices,
  buildPipelineSnapshot,
  buildTicketAttentionQueue,
  buildUrgentActionCategories,
  buildUrgentActions,
  getPortalDashboardActivity,
  getPortalDashboardCapacity,
  getPortalSummary,
  groupByJobCardId,
  selectUrgentActionPreview,
} from "./dashboard";
import { METRIC_VERSION } from "./metricAggregates";
import { portalSummaryResultValidator } from "./returnContracts";

describe("Ticketing head intake dashboard", () => {
  test("Keeps relevant unassigned queries visible until a Ticketing SPOC is assigned", () => {
    const access = { roles: ["Head of Ticketing"] };
    const query = {
      _id: "queries_1",
      queryCode: "Q-0001",
      salesStatus: "Proposal in discussion",
      ticketingScope: "Both",
    };

    expect(buildHeadAssignmentSlaItems(access, [query], [])).toEqual([
      expect.objectContaining({
        label: "Q-0001 — assign Ticketing SPOC",
      }),
    ]);
    expect(
      buildHeadAssignmentSlaItems(access, [{ ...query, ticketingOwnerId: "staff_ticketing" }], [])
    ).toEqual([]);
    expect(
      buildHeadAssignmentSlaItems(access, [{ ...query, ticketingScope: "Not required" }], [])
    ).toEqual([]);
  });
});

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
  const takeCalls: Array<{ limit: number; table: string }> = [];
  const getRows = (table: string) => (table === "staffUsers" ? [staff] : (tables[table] ?? []));

  const orderedBuilder = (table: string, rows = getRows(table)) => ({
    collect: async () => rows,
    filter: () => orderedBuilder(table, rows),
    first: async () => rows[0] ?? null,
    order: (direction: string) =>
      orderedBuilder(
        table,
        [...rows].sort((left, right) =>
          direction === "desc"
            ? (right.createdAt ?? 0) - (left.createdAt ?? 0)
            : (left.createdAt ?? 0) - (right.createdAt ?? 0)
        )
      ),
    paginate: ({ numItems }: { numItems: number }) => {
      takeCalls.push({ limit: numItems, table });
      return {
        continueCursor: "",
        isDone: rows.length <= numItems,
        page: rows.slice(0, numItems),
      };
    },
    take: (limit: number) => {
      takeCalls.push({ limit, table });
      if (table === "activityLogs") {
        activityTakeCalls.push(limit);
      }
      return rows.slice(0, limit);
    },
    unique: async () => rows.find((row) => row.active) ?? rows[0] ?? null,
    withIndex: (_indexName: string) => orderedBuilder(table, rows),
  });

  const queryBuilder = (table: string) => orderedBuilder(table);

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
      get: (table: string, id: string) =>
        Promise.resolve(getRows(table).find((row) => String(row._id) === String(id)) ?? null),
      normalizeId: (_table: string, id: string) => id,
      query: (table: string) => queryBuilder(table),
    },
    takeCalls,
  };
}

describe("BuildUrgentActions", () => {
  test("Adds entity metadata and hrefs for each urgent action type", () => {
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

  test("Does not ask accounts to create a job card that already exists", () => {
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

  test("Ages Job Card creation from confirmation and never from later Query edits", () => {
    const confirmedAt = Date.UTC(2026, 0, 2);
    const actions = buildUrgentActions({
      approvals: [],
      invoices: [],
      jobCards: [],
      nowDate: "2026-02-01",
      queries: [
        {
          _id: "query_1",
          confirmedAt,
          queryCode: "Q-1",
          salesStatus: "Order Confirmed",
          updatedAt: Date.UTC(2026, 0, 30),
        },
        {
          _id: "query_2",
          queryCode: "Q-2",
          salesStatus: "Order Confirmed",
          updatedAt: Date.UTC(2026, 0, 30),
        },
      ],
      tickets: [],
    });

    expect(actions[0]?.createdAt).toBe(new Date(confirmedAt).toISOString());
    expect(actions[1]?.createdAt).toBeUndefined();
  });

  test("Keeps category totals outside the display bound and exposes partial coverage", () => {
    const approvals = Array.from({ length: 9 }, (_, index) => ({
      _id: `approval_${index}`,
      createdAt: Date.UTC(2026, 0, index + 1),
      requestCode: `APR-${index}`,
      status: "Pending",
      summary: "Review",
    }));
    const actions = buildUrgentActions({
      approvals,
      invoices: [],
      jobCards: [],
      nowDate: "2026-02-01",
      queries: [],
      tickets: [
        {
          _id: "ticket_1",
          ticketNumber: "TKT-1",
          ticketStatus: "Refund Pending",
          updatedAt: Date.UTC(2026, 0, 1),
        },
      ],
    });
    const categories = buildUrgentActionCategories(actions, {
      accounts: true,
      approvals: true,
      finance: false,
      ticketing: false,
    });

    const preview = selectUrgentActionPreview(actions);
    expect(preview).toHaveLength(8);
    expect(preview.some((action) => action.type === "ticketing")).toBe(true);
    expect(categories).toEqual([
      expect.objectContaining({ complete: true, count: 9, type: "approvals" }),
      { complete: false, count: 0, oldestCreatedAt: undefined, type: "finance" },
      { complete: false, count: 1, oldestCreatedAt: undefined, type: "ticketing" },
    ]);
  });

  test("Uses age first with stable domain and id tie-breaking", () => {
    const createdAt = Date.UTC(2026, 0, 3);
    const actions = buildUrgentActions({
      approvals: [
        {
          _id: "approval_b",
          createdAt,
          requestCode: "APR-B",
          status: "Pending",
          summary: "Review",
        },
        {
          _id: "approval_a",
          createdAt,
          requestCode: "APR-A",
          status: "Pending",
          summary: "Review",
        },
      ],
      invoices: [
        {
          _id: "invoice_older",
          balanceAmount: 10,
          dueDate: "2025-12-01",
          invoiceNumber: "INV-1",
          updatedAt: Date.UTC(2025, 11, 1),
        },
      ],
      jobCards: [],
      nowDate: "2026-02-01",
      queries: [],
      tickets: [],
    });

    expect(actions.map((action) => action.id)).toEqual([
      "invoice_older",
      "approval_a",
      "approval_b",
    ]);
  });
});

describe("Dashboard summary slices", () => {
  test("Builds lead-stage pipeline buckets with missing lead stages counted as Inquiry", () => {
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

  test("Returns the oldest eight overdue invoices with job-card client names", () => {
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

  test("Returns only ticket statuses that need attention", () => {
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

describe("GetPortalSummary", () => {
  test("Scopes the raw dashboard response to the Sales caller's authorized records", async () => {
    const { takeCalls, ...ctx } = makeCtx(
      {
        activityLogs: [],
        approvalRequests: [
          {
            _id: "approval_other",
            createdAt: Date.UTC(2026, 0, 1),
            requestCode: "APR-OTHER",
            requestedBy: "auth_2",
            status: "Pending",
            summary: "Private approval",
            type: "Expense",
            updatedAt: Date.UTC(2026, 0, 1),
          },
        ],
        crmMetricBuckets: [
          {
            _id: "bucket_global",
            periodKey: "all",
            periodType: "all",
            scope: "all",
            updatedAt: Date.UTC(2026, 0, 2),
            values: {
              "approvals.pending": 70,
              "jobCards.open": 80,
              "queries.active": 90,
              "queries.stage.Inquiry.count": 40,
              "queries.stage.Proposal.count": 50,
              "queries.total": 90,
            },
          },
        ],
        crmMetricPublications: [
          {
            _id: "publication_global",
            generation: 1,
            key: "global",
            metricVersion: METRIC_VERSION,
            publishedAt: Date.UTC(2026, 0, 2),
          },
        ],
        crmMetricReadiness: [
          {
            _id: "readiness_global",
            completedSourceTypes: ["approvalRequests", "jobCards", "queries"],
            generation: 2,
            key: "global",
            lastCompletedAt: Date.UTC(2026, 0, 2),
            lastCompletedGeneration: 1,
            lastCompletedMetricVersion: METRIC_VERSION,
            metricVersion: METRIC_VERSION,
            startedAt: Date.UTC(2026, 0, 1),
            updatedAt: Date.UTC(2026, 0, 2),
          },
        ],
        invoices: [
          {
            _id: "invoice_other",
            balanceAmount: 500,
            createdAt: Date.UTC(2026, 0, 1),
            dueDate: "2026-01-01",
            expectedAmount: 500,
            invoiceNumber: "INV-OTHER",
            receivedAmount: 0,
            updatedAt: Date.UTC(2026, 0, 1),
          },
        ],
        jobCards: [
          {
            _id: "job_other",
            clientName: "Private Client",
            confirmedPax: 4,
            createdAt: Date.UTC(2026, 0, 1),
            createdBy: "auth_2",
            destination: "Private Destination",
            jobCode: "JC-OTHER",
            status: "Open",
          },
        ],
        proposalQueryLinks: [],
        proposals: [],
        queries: [
          {
            _id: "query_mine",
            contractingStatus: "Query Received",
            createdAt: Date.UTC(2026, 0, 1),
            createdBy: "auth_1",
            leadStage: "Inquiry",
            queryCode: "Q-MINE",
            queryType: "MICE",
            salesStatus: "Proposal in discussion",
          },
          {
            _id: "query_other",
            contractingStatus: "Query Received",
            createdAt: Date.UTC(2026, 0, 1),
            createdBy: "auth_2",
            leadStage: "Proposal",
            queryCode: "Q-OTHER",
            queryType: "MICE",
            salesStatus: "Proposal in discussion",
          },
        ],
        tickets: [
          {
            _id: "ticket_other",
            createdAt: Date.UTC(2026, 0, 1),
            jobCardId: "job_other",
            ticketNumber: "TKT-OTHER",
            ticketStatus: "Refund Pending",
          },
        ],
        travellers: [],
        visaRecords: [],
      },
      ["Sales"]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await getPortalSummary._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
      referenceNow: Date.UTC(2026, 0, 2),
    });

    expect(summary.metrics).toMatchObject({
      activeQueries: 1,
      jobCardsOpen: 0,
      outstandingAmount: 0,
      paymentPending: 0,
      pendingApprovals: 0,
      ticketsPending: 0,
    });
    expect(summary.pipelineSnapshot).toEqual([
      { count: 1, stage: "Inquiry", value: 0, weighted: 0 },
      { count: 0, stage: "Proposal", value: 0, weighted: 0 },
      { count: 0, stage: "Negotiation", value: 0, weighted: 0 },
      { count: 0, stage: "Confirmation", value: 0, weighted: 0 },
      { count: 0, stage: "Lost", value: 0, weighted: 0 },
    ]);
    expect(summary.activeTours).toEqual([]);
    expect(summary.urgentActions).toEqual([]);
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "approvalRequests" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "invoices" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "jobCards" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "tickets" });
  });

  test("Loads only the dashboard collections allowed for each staff role", async () => {
    const cases = [
      { roles: ["Accounts"], tables: ["invoices", "jobCards", "queries"] },
      { roles: ["Sales"], tables: ["proposals", "queries"] },
      { roles: ["HR"], tables: ["approvalRequests"] },
      {
        roles: ["Operations"],
        tables: ["jobCards", "tickets", "travellers", "visaRecords"],
      },
      { roles: ["Finance"], tables: ["approvalRequests", "invoices", "jobCards"] },
      {
        roles: ["Directors"],
        tables: [
          "approvalRequests",
          "invoices",
          "jobCards",
          "proposals",
          "queries",
          "queries",
          "tickets",
          "travellers",
          "visaRecords",
        ],
      },
    ];

    await Promise.all(
      cases.map(async (testCase) => {
        const { takeCalls, ...ctx } = makeCtx(
          {
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
          },
          testCase.roles
        );

        // SAFETY: This test controls the asserted value at the framework boundary below.
        await getPortalSummary._handler(fromAny<any, unknown>(ctx), { dateRange: null });

        expect(
          takeCalls
            .filter((call) => call.limit === 240 && call.table !== "staffUsers")
            .map((call) => call.table)
            .sort((left, right) => left.localeCompare(right))
        ).toEqual(testCase.tables);
      })
    );
  });

  test("Builds the Accounts Job Card queue without broadening query dashboard totals", async () => {
    const confirmedAt = Date.UTC(2026, 0, 3);
    const ctx = makeCtx(
      {
        activityLogs: [],
        approvalRequests: [],
        invoices: [],
        jobCards: [],
        proposalQueryLinks: [],
        proposals: [],
        queries: [
          {
            _id: "query_accounts",
            confirmedAt,
            contractingStatus: "Order Confirmed",
            createdAt: confirmedAt,
            createdBy: "auth_1",
            leadStage: "Confirmation",
            queryCode: "Q-ACCOUNTS",
            queryType: "MICE",
            salesStatus: "Order Confirmed",
          },
          {
            _id: "query_contracting_confirmed",
            confirmedAt: confirmedAt + 1000,
            contractingStatus: "Order Confirmed",
            createdAt: confirmedAt + 1000,
            createdBy: "auth_1",
            leadStage: "Confirmation",
            queryCode: "Q-CONTRACTING",
            queryType: "MICE",
            salesStatus: "Proposal in discussion",
          },
        ],
        tickets: [],
        travellers: [],
        visaRecords: [],
      },
      ["Accounts"]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await getPortalSummary._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
    });

    expect(summary.urgentActionCategories).toEqual([
      {
        complete: true,
        count: 2,
        oldestCreatedAt: new Date(confirmedAt).toISOString(),
        type: "accounts",
      },
    ]);
    expect(summary.urgentActions.map((action) => action.type)).toEqual(["accounts", "accounts"]);
    expect(summary.metrics.confirmedJobs).toBe(0);
  });

  test("Returns generatedAt and keeps cement scope on query counts", async () => {
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
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await getPortalSummary._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
    });

    expect(activityTakeCalls).toEqual([]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await getPortalDashboardActivity._handler(fromAny<any, unknown>(ctx), { dateRange: null });
    expect(activityTakeCalls).toEqual([]);
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

  test("Uses materialized totals beyond the bounded detail window", async () => {
    const queryRows = Array.from({ length: 320 }, (_, index) => ({
      _id: `query_${index}`,
      contractingStatus: "Query Received",
      createdAt: Date.UTC(2026, 0, index + 1),
      createdBy: "auth_1",
      leadStage: "Inquiry",
      queryCode: `Q-${index}`,
      queryType: "MICE",
      salesStatus: "Proposal in discussion",
    }));
    const { takeCalls, ...ctx } = makeCtx({
      activityLogs: [],
      approvalRequests: [],
      crmMetricBuckets: [
        {
          _id: "bucket_1",
          periodKey: "2026-01",
          periodType: "month",
          scope: "all",
          updatedAt: Date.UTC(2026, 1, 1),
          values: {
            "queries.active": 320,
            "queries.stage.Inquiry.count": 320,
            "queries.total": 320,
            "queries.type.MICE.active": 320,
          },
        },
      ],
      crmMetricPublications: [
        {
          _id: "metric_publication",
          generation: 1,
          key: "global",
          metricVersion: METRIC_VERSION,
          publishedAt: Date.UTC(2026, 1, 1),
        },
      ],
      crmMetricReadiness: [
        {
          _id: "metric_readiness",
          completedSourceTypes: ["queries"],
          generation: 2,
          key: "global",
          lastCompletedAt: Date.UTC(2026, 1, 1),
          lastCompletedGeneration: 1,
          lastCompletedMetricVersion: METRIC_VERSION,
          metricVersion: METRIC_VERSION,
          startedAt: Date.UTC(2026, 0, 1),
          updatedAt: Date.UTC(2026, 1, 1),
        },
      ],
      invoices: [],
      jobCards: [],
      proposalQueryLinks: [],
      proposals: [],
      queries: queryRows,
      tickets: [],
      travellers: [],
      visaRecords: [],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await getPortalSummary._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
    });
    expect(summary.metrics.activeQueries).toBe(320);
    expect(summary.queriesByType.find((row) => row.type === "MICE")?.count).toBe(320);
    expect(takeCalls).toContainEqual({ limit: 240, table: "queries" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "proposals" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "travellers" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "visaRecords" });
    expect(takeCalls).not.toContainEqual({ limit: 240, table: "staffUsers" });
    expect(takeCalls).not.toContainEqual({ limit: 8, table: "activityLogs" });
    expect(summary.aggregateCoverage).toMatchObject({ complete: true, detailRowLimit: 240 });
  });

  test("Does not switch to partial aggregate values before reconciliation is complete", async () => {
    const queryRows = Array.from({ length: 320 }, (_, index) => ({
      _id: `query_${index}`,
      contractingStatus: "Query Received",
      createdAt: Date.UTC(2026, 0, index + 1),
      createdBy: "auth_1",
      leadStage: "Inquiry",
      queryCode: `Q-${index}`,
      queryType: "MICE",
      salesStatus: "Proposal in discussion",
    }));
    const ctx = makeCtx({
      activityLogs: [],
      approvalRequests: [],
      crmMetricBuckets: [
        {
          _id: "partial_bucket",
          periodKey: "2026-01",
          periodType: "month",
          scope: "all",
          updatedAt: Date.UTC(2026, 1, 1),
          values: { "queries.active": 1, "queries.total": 1 },
        },
      ],
      crmMetricReadiness: [
        {
          _id: "partial_readiness",
          completedSourceTypes: ["queries"],
          generation: 1,
          key: "global",
          startedAt: Date.UTC(2026, 0, 1),
          updatedAt: Date.UTC(2026, 0, 1),
        },
      ],
      invoices: [],
      jobCards: [],
      proposalQueryLinks: [],
      proposals: [],
      queries: queryRows,
      tickets: [],
      travellers: [],
      visaRecords: [],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await getPortalSummary._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
    });
    expect(summary.aggregateCoverage.complete).toBe(false);
    expect(summary.metrics.activeQueries).toBe(240);
  });
});

describe("GetPortalDashboardCapacity", () => {
  test("Redacts people data for Cement representatives without team permission", async () => {
    const { takeCalls, ...ctx } = makeCtx(
      {
        jobCards: [],
        queries: [
          {
            _id: "query_cement",
            createdAt: 2,
            createdBy: "auth_1",
            queryType: "Cement",
            salesOwnerId: "staff_1",
            salesStatus: "Proposal in discussion",
          },
          {
            _id: "query_mice",
            createdAt: 1,
            createdBy: "auth_1",
            queryType: "MICE",
            salesOwnerId: "staff_1",
            salesStatus: "Proposal in discussion",
          },
        ],
      },
      ["Sales Cement"]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await getPortalDashboardCapacity._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
    });

    expect(result).toEqual({ capacity: [], myTeam: [] });
    expect(takeCalls).toEqual([{ limit: 2, table: "staffUsers" }]);
  });
});

describe("GroupByJobCardId", () => {
  test("Groups travellers by job card id", () => {
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      groupByJobCardId(
        fromAny<any, unknown>([
          { fullName: "A", jobCardId: "job_1" },
          { fullName: "B", jobCardId: "job_2" },
          { fullName: "C", jobCardId: "job_1" },
        ])
      )
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

describe("GetPortalSummary response shape", () => {
  test("Allows head-assignment navigation metadata in owned-work SLA items", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summaryFields = fromAny<any, unknown>(portalSummaryResultValidator.json).value;
    const slaItemFields = summaryFields.ownedWorkSla.fieldType.value.items.fieldType.value.value;

    expect(slaItemFields.entityId).toEqual({
      fieldType: { type: "string" },
      optional: true,
    });
    expect(slaItemFields.entityType).toEqual({
      fieldType: { type: "string" },
      optional: true,
    });
  });

  test("Returns the dashboard top-level keys", async () => {
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

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await getPortalSummary._handler(fromAny<any, unknown>(ctx), {
      dateRange: null,
    });

    expect(Object.keys(summary).sort()).toEqual(
      [
        "activeTours",
        "aggregateCoverage",
        "capacity",
        "closedQueriesByType",
        "confirmedQueriesByType",
        "departmentWorkflow",
        "generatedAt",
        "metricTrends",
        "metrics",
        "myTeam",
        "overdueInvoices",
        "ownedWorkSla",
        "pipelineSnapshot",
        "progress",
        "queriesByType",
        "recentActivity",
        "ticketAttentionQueue",
        "ticketingStats",
        "upcomingDepartures",
        "urgentActionCategories",
        "urgentActions",
      ].sort()
    );
  });
});
