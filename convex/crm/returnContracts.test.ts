import { describe, expect, test } from "bun:test";
import { getPortalSummary } from "./dashboard";
import { publicJobCard, publicQuery } from "./lib";
import {
  jobCardCommandCenterResultValidator,
  jobCardGetListRowResultValidator,
  jobCardListPageResultValidator,
  portalSummaryResultValidator,
  queryGetListRowResultValidator,
  queryListPageResultValidator,
} from "./returnContracts";
import { assertMatchesReturnContract, expectReturnContractFailure } from "./validateReturnContract";

const ISO = "2026-07-14T12:00:00.000Z";
const QUERY_ID = "queries_1";
const JOB_CARD_ID = "jobCards_1";
const PROPOSAL_ID = "proposals_1";
const ATTACHMENT_ID = "queryAttachments_1";

function buildQueryRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: QUERY_ID,
    attachmentCount: 0,
    attachmentPreview: [],
    batchingNotes: "",
    budgetAmount: 0,
    clientName: "Acme India",
    confirmedAt: undefined,
    contactMobile: "",
    contactPerson: "",
    contractingAirlinesCost: 0,
    contractingLandCost: 0,
    contractingOwnerId: "",
    contractingOwnerName: "",
    contractingStatus: "Query Received",
    contractingVisaCost: 0,
    createdAt: Date.parse(ISO),
    createdBy: "auth_1",
    destination: "",
    jobCardCreatorName: "",
    jobCardCreatorStaffId: "",
    leadStage: "Inquiry",
    lostReason: "",
    notes: "",
    paxCount: 10,
    queryCode: "Q-0001",
    queryType: "MICE",
    salesOwnerName: "",
    salesStatus: "Proposal in discussion",
    source: "",
    submittedToContractingAt: undefined,
    ticketingOwnerId: "",
    ticketingOwnerName: "",
    ticketingScope: "",
    travelEndDate: "",
    travelInBatches: false,
    travelStartDate: "",
    travelType: "International Travel",
    updatedAt: Date.parse(ISO),
    ...overrides,
  };
}

function buildQueryListRow(overrides: Record<string, unknown> = {}) {
  const row = buildQueryRecord(overrides);
  return {
    ...publicQuery(row as never),
    attachmentCount: Number(row.attachmentCount ?? row.attachmentPreview?.length ?? 0),
    attachments: (row.attachmentPreview ?? []).map((attachment: any) => ({
      ...attachment,
      createdAt: new Date(attachment.createdAt).toISOString(),
    })),
    proposalDocument: null,
  };
}

function buildJobCardRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: JOB_CARD_ID,
    clientName: "Acme India",
    collaboratorStaffIds: [],
    confirmedPax: 10,
    contractingOwnerId: "",
    contractingOwnerName: "",
    createdAt: Date.parse(ISO),
    createdBy: "auth_1",
    destination: "Dubai",
    jobCode: "JC-0001-NS",
    operationsOwnerId: "",
    operationsOwnerName: "",
    paymentTerms: null,
    preDepartureChecklist: null,
    proposalId: null,
    queryId: QUERY_ID,
    queryType: "MICE",
    roomCount: 0,
    status: "Open",
    ticketingOwnerId: "",
    ticketingOwnerName: "",
    ticketingRequired: false,
    ticketingScope: "",
    tourManagerName: "",
    travelBatchCount: 0,
    travelEndDate: "",
    travelStartDate: "2026-08-01",
    updatedAt: Date.parse(ISO),
    ...overrides,
  };
}

function buildDashboardCtx(tables: Record<string, any[]>, staffRoles = ["Admin"]) {
  const staff = {
    _id: "staffUsers_1",
    active: true,
    authUserId: "auth_1",
    department: "Sales",
    email: "admin@example.com",
    emailNormalized: "admin@example.com",
    function: "Sales",
    location: "Mumbai",
    name: "Admin User",
    roles: staffRoles,
  };

  const getRows = (table: string) => (table === "staffUsers" ? [staff] : (tables[table] ?? []));
  const orderedBuilder = (table: string, rows = getRows(table)) => ({
    collect: async () => rows,
    order: (direction: string) =>
      orderedBuilder(
        table,
        [...rows].sort((left, right) =>
          direction === "desc"
            ? (right.createdAt ?? 0) - (left.createdAt ?? 0)
            : (left.createdAt ?? 0) - (right.createdAt ?? 0)
        )
      ),
    take: async (limit: number) => rows.slice(0, limit),
    unique: async () => rows.find((row) => row.active) ?? rows[0] ?? null,
    withIndex: (_indexName: string) => orderedBuilder(table, rows),
  });

  return {
    auth: {
      getUserIdentity: async () => ({
        email: "admin@example.com",
        name: "Admin User",
        subject: "auth_1",
      }),
    },
    db: {
      query: (table: string) => orderedBuilder(table),
    },
  };
}

describe("query return contracts", () => {
  test("accepts empty, partial, paginated, and fully populated list payloads", () => {
    assertMatchesReturnContract(queryListPageResultValidator, {
      continueCursor: "",
      isDone: true,
      page: [],
    });

    assertMatchesReturnContract(queryListPageResultValidator, {
      continueCursor: "cursor_2",
      isDone: false,
      page: [buildQueryListRow()],
      pageStatus: null,
      splitCursor: null,
    });

    assertMatchesReturnContract(queryListPageResultValidator, {
      continueCursor: "",
      isDone: true,
      page: [
        buildQueryListRow({
          approxMargin: 12.5,
          attachmentCount: 1,
          attachmentPreview: [
            {
              createdAt: Date.parse(ISO),
              fileName: "itinerary.pdf",
              fileSize: 1024,
              id: ATTACHMENT_ID,
              mimeType: "application/pdf",
            },
          ],
          confirmedAt: Date.parse(ISO),
          destination: "Dubai",
          leadStage: "Closed",
          source: "Email",
          submittedToContractingAt: Date.parse(ISO),
          ticketingScope: "International",
        }),
      ],
    });
  });

  test("accepts null and populated getListRow payloads", () => {
    assertMatchesReturnContract(queryGetListRowResultValidator, null);
    assertMatchesReturnContract(queryGetListRowResultValidator, buildQueryListRow());
  });

  test("rejects malformed query list payloads", () => {
    expect(
      expectReturnContractFailure(queryListPageResultValidator, {
        continueCursor: "",
        isDone: true,
        page: [{ ...buildQueryListRow(), id: 42 }],
      })
    ).toContain("expected Convex id string");

    expect(
      expectReturnContractFailure(queryGetListRowResultValidator, {
        ...buildQueryListRow(),
        salesStatus: "Definitely Lost",
      })
    ).toContain("did not match any union member");
  });
});

describe("job card return contracts", () => {
  test("accepts empty, partial, paginated, and fully populated list payloads", () => {
    assertMatchesReturnContract(jobCardListPageResultValidator, {
      continueCursor: "",
      isDone: true,
      page: [],
    });

    assertMatchesReturnContract(jobCardListPageResultValidator, {
      continueCursor: "cursor_3",
      isDone: false,
      page: [publicJobCard(buildJobCardRecord() as never)],
    });

    assertMatchesReturnContract(jobCardListPageResultValidator, {
      continueCursor: "",
      isDone: true,
      page: [
        publicJobCard(
          buildJobCardRecord({
            collaboratorStaffIds: ["staffUsers_2"],
            lastEditedAt: Date.parse(ISO),
            lastEditedByName: "Nina Shah",
            paymentTerms: {
              label: "70%-100% advance",
              maxAdvancePercent: 100,
              minAdvancePercent: 70,
            },
            preDepartureChecklist: [{ done: false, key: "handover", label: "Handover" }],
            proposalId: PROPOSAL_ID,
            ticketingRequired: true,
            ticketingScope: "Both",
            tourManagerName: "Ravi Kumar",
            travelBatchCount: 2,
          }) as never,
          buildQueryRecord({ ticketingScope: "Both" }) as never
        ),
      ],
    });
  });

  test("accepts null and populated getListRow payloads", () => {
    assertMatchesReturnContract(jobCardGetListRowResultValidator, null);
    assertMatchesReturnContract(
      jobCardGetListRowResultValidator,
      publicJobCard(buildJobCardRecord() as never)
    );
  });

  test("rejects malformed job card list payloads", () => {
    expect(
      expectReturnContractFailure(jobCardListPageResultValidator, {
        continueCursor: "",
        isDone: true,
        page: [{ ...publicJobCard(buildJobCardRecord() as never), status: "Archived" }],
      })
    ).toContain("did not match any union member");
  });

  test("accepts the least-privilege command center payload and rejects raw document leakage", () => {
    const payload = {
      checklistTasks: [
        {
          _id: "checklistTasks_1",
          category: "Operations",
          completed: false,
          title: "Confirm rooming",
        },
      ],
      hotels: [{ id: "hotels_1" }],
      invoices: [{ balanceAmount: 1000, id: "invoices_1" }],
      jobCard: publicJobCard(buildJobCardRecord() as never),
      proposal: null,
      query: null,
      rooming: [{ id: "roomingListEntries_1" }],
      tickets: [{ ticketStatus: "Pending Issue" }],
      travellers: [{ passportStatus: "Received" }],
      visaRecords: [{ status: "Awaiting" }],
    };
    assertMatchesReturnContract(jobCardCommandCenterResultValidator, payload);
    expect(
      expectReturnContractFailure(jobCardCommandCenterResultValidator, {
        ...payload,
        travellers: [
          {
            createdBy: "internal-auth-user",
            passportStatus: "Received",
          },
        ],
      })
    ).toContain("return.travellers[0]");
  });
});

describe("dashboard return contracts", () => {
  test("accepts empty and aggregate-backed portal summary payloads", async () => {
    const emptyCtx = buildDashboardCtx({
      activityLogs: [],
      approvalRequests: [],
      crmMetricBuckets: [],
      crmMetricReadiness: [],
      invoices: [],
      jobCards: [],
      proposalQueryLinks: [],
      proposals: [],
      queries: [],
      tickets: [],
      travellers: [],
      visaRecords: [],
    });
    const emptySummary = await getPortalSummary._handler(emptyCtx as any, { dateRange: null });
    assertMatchesReturnContract(portalSummaryResultValidator, emptySummary);

    const aggregateCtx = buildDashboardCtx({
      activityLogs: [
        {
          _id: "activityLogs_1",
          action: "updated",
          actorName: "Admin User",
          createdAt: Date.parse(ISO),
          entityId: QUERY_ID,
          entityType: "query",
          message: "Updated query",
        },
      ],
      approvalRequests: [],
      crmMetricBuckets: [
        {
          _id: "crmMetricBuckets_1",
          periodKey: "2026-07",
          periodType: "month",
          scope: "all",
          updatedAt: Date.parse(ISO),
          values: {
            "queries.active": 4,
            "queries.confirmed": 1,
            "queries.stage.Inquiry.count": 4,
            "queries.total": 4,
            "queries.type.MICE.active": 4,
          },
        },
      ],
      crmMetricReadiness: [
        {
          _id: "crmMetricReadiness_1",
          completedSourceTypes: ["queries"],
          generation: 2,
          key: "global",
          lastCompletedAt: Date.parse(ISO),
          lastCompletedGeneration: 1,
          lastCompletedMetricVersion: 2,
          metricVersion: 2,
          startedAt: Date.parse(ISO),
          updatedAt: Date.parse(ISO),
        },
      ],
      invoices: [
        {
          _id: "invoices_1",
          balanceAmount: 500,
          createdAt: Date.parse(ISO),
          dueDate: "2026-01-01",
          expectedAmount: 1000,
          invoiceNumber: "INV-1",
          jobCardId: JOB_CARD_ID,
          receivedAmount: 500,
        },
      ],
      jobCards: [
        buildJobCardRecord({
          status: "In Operations",
          tourManagerName: "Ravi Kumar",
        }),
      ],
      proposalQueryLinks: [],
      proposals: [],
      queries: [
        buildQueryRecord({
          leadStage: "Proposal",
          salesStatus: "Proposal in discussion",
        }),
      ],
      tickets: [
        {
          _id: "tickets_1",
          createdAt: Date.parse(ISO),
          ticketNumber: "TKT-1",
          ticketStatus: "Reissue Required",
          updatedAt: Date.parse(ISO),
        },
      ],
      travellers: [
        {
          _id: "travellers_1",
          createdAt: Date.parse(ISO),
          foodPreference: "Veg",
          fullName: "Anshika Agarwal",
          jobCardId: JOB_CARD_ID,
          ticketStatus: "Issued",
          travelHub: "Mumbai",
          visaStatus: "Approved",
        },
      ],
      visaRecords: [
        {
          _id: "visaRecords_1",
          createdAt: Date.parse(ISO),
          status: "Awaiting",
        },
      ],
    });

    const aggregateSummary = await getPortalSummary._handler(aggregateCtx as any, {
      dateRange: null,
    });
    assertMatchesReturnContract(portalSummaryResultValidator, aggregateSummary);
    expect(aggregateSummary.aggregateCoverage.complete).toBe(true);
    expect(aggregateSummary.recentActivity).toHaveLength(1);
    expect(aggregateSummary.ticketAttentionQueue).toHaveLength(1);
  });

  test("rejects malformed dashboard payloads", () => {
    expect(
      expectReturnContractFailure(portalSummaryResultValidator, {
        activeTours: [],
        aggregateCoverage: {
          bucketCount: 0,
          complete: false,
          completedSources: [],
          detailRowLimit: 240,
          errorSummary: null,
          freshnessMinutes: 15,
          generation: 0,
          lastCompletedAt: null,
          state: "pending",
          updatedAt: null,
          version: null,
        },
        capacity: [],
        closedQueriesByType: [],
        confirmedQueriesByType: [],
        departmentWorkflow: [],
        generatedAt: ISO,
        metrics: {
          activeQueries: 0,
          confirmedJobs: 0,
          departures30d: 0,
          jobCardsOpen: 0,
          outstandingAmount: 0,
          paymentPending: 0,
          pendingApprovals: 0,
          proposalsSent: 0,
          revenuePipeline: 0,
          ticketsIssued: 0,
          ticketsPending: 0,
          visaPending: 0,
        },
        metricTrends: {
          activeQueries: { delta: 0, direction: "flat" },
          confirmedJobs: { delta: 0, direction: "flat" },
          departures30d: { delta: 0, direction: "flat" },
          jobCardsOpen: { delta: 0, direction: "flat" },
          proposalsSent: { delta: 0, direction: "sideways" },
        },
        myTeam: [],
        overdueInvoices: [],
        pipelineSnapshot: [],
        progress: {
          guestData: { done: 0, percent: 0, total: 0 },
          passport: { done: 0, percent: 0, total: 0 },
          payment: { done: 0, percent: 0, total: 0 },
          rooming: { done: 0, percent: 0, total: 0 },
          tickets: { done: 0, percent: 0, total: 0 },
          tourManager: { done: 0, percent: 0, total: 0 },
          visas: { done: 0, percent: 0, total: 0 },
        },
        queriesByType: [],
        recentActivity: [],
        ticketAttentionQueue: [],
        ticketingStats: {
          cancelReq: 0,
          onHold: 0,
          reissue: 0,
          upcomingDep: 0,
        },
        upcomingDepartures: [],
        urgentActions: [],
      })
    ).toContain("did not match any union member");
  });
});

describe("pilot API registrations", () => {
  test("declare returns validators on query, job card, and dashboard entry points", async () => {
    const { listPage: queryListPage, getListRow: queryGetListRow } = await import("./queries");
    const { listPage: jobCardListPage, getListRow: jobCardGetListRow } = await import("./jobCards");
    const { getPortalSummary: dashboardSummary } = await import("./dashboard");

    expect(queryListPage.exportReturns()).toContain('"type":"object"');
    expect(queryGetListRow.exportReturns()).toContain('"type":"union"');
    expect(jobCardListPage.exportReturns()).toContain('"type":"object"');
    expect(jobCardGetListRow.exportReturns()).toContain('"type":"union"');
    expect(dashboardSummary.exportReturns()).toContain("aggregateCoverage");
  });

  test("declares explicit returns on every Query and Job Card public export", async () => {
    const queryApi = await import("./queries");
    const jobCardApi = await import("./jobCards");
    const queryFunctions = [
      queryApi.listPage,
      queryApi.getListRow,
      queryApi.create,
      queryApi.update,
      queryApi.assignContracting,
      queryApi.assignQueryTicketing,
      queryApi.assignQueryTeams,
      queryApi.assignJobCardCreator,
      queryApi.submitToContracting,
      queryApi.updateStatus,
      queryApi.remove,
    ];
    const jobCardFunctions = [
      jobCardApi.listPage,
      jobCardApi.getListRow,
      jobCardApi.listTravelBatches,
      jobCardApi.getCommandCenter,
      jobCardApi.createFromQuery,
      jobCardApi.update,
      jobCardApi.createTravelBatch,
      jobCardApi.updateTravelBatch,
      jobCardApi.updateChecklist,
      jobCardApi.updateChecklistTask,
      jobCardApi.createChecklistTask,
      jobCardApi.removeChecklistTask,
      jobCardApi.updateStatus,
      jobCardApi.addCollaborator,
      jobCardApi.removeCollaborator,
      jobCardApi.assignOperationsOwner,
      jobCardApi.assignContractingOwner,
      jobCardApi.remove,
    ];
    for (const registeredFunction of [...queryFunctions, ...jobCardFunctions]) {
      expect(registeredFunction.exportReturns()).not.toBeNull();
      expect(registeredFunction.exportReturns()).not.toContain('"type":"any"');
    }
  });
});
