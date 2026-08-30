import { describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { RuntimeValue } from "../lib/runtimeValues";
import { getCommandCenter } from "./jobCards";
import { getAttachmentRecord } from "./proposalAttachments";
import { getFinalizedPdfRecord } from "./proposals";
import { getAttachmentRecord as getQueryAttachmentRecord } from "./queryAttachments";
import { jobCardCommandCenterResultValidator } from "./returnContracts";
import { assertMatchesReturnContract } from "./validateReturnContract";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
type Tables = Record<string, Row[]>;

function makeCommandCenterCtx(staffOverrides: Partial<Row> = {}, tableOverrides: Tables = {}) {
  const staff = {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    _id: fromPartial<Id<"staffUsers">>("staff_operations"),
    active: true,
    authUserId: "auth_operations",
    email: "ops@citius.in",
    emailNormalized: "ops@citius.in",
    name: "Ops Executive",
    roles: ["Operations"],
    ...staffOverrides,
  };
  const tables = {
    activityLogs: [],
    checklistTasks: [],
    eventFlows: [],
    expenseEntries: [],
    hotels: [],
    invoices: [],
    itineraries: [],
    jobCards: [
      {
        _id: "jobCards_1",
        clientName: "Acme Ltd",
        confirmedPax: 24,
        contractingOwnerName: "Contracting SPOC",
        createdAt: 200,
        createdBy: "auth_accounts",
        destination: "Dubai",
        jobCode: "JC-0001-NS",
        operationsOwnerId: "staff_operations",
        operationsOwnerName: "Ops Executive",
        proposalId: "proposals_1",
        queryId: "queries_1",
        queryType: "MICE",
        roomCount: 12,
        status: "In Operations",
        ticketingOwnerName: "Ticketing SPOC",
        tourManagerName: "Tour Lead",
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
        updatedAt: 220,
      },
    ],
    pnrs: [],
    proposalAttachments: [
      {
        _id: "proposalAttachments_1",
        createdAt: 1_700_000_100_000,
        fileName: "operational-itinerary.pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
        proposalId: "proposals_1",
        storageId: "storage_1",
      },
    ],
    proposalQueryLinks: [],
    proposals: [
      {
        _id: "proposals_1",
        airfarePerPax: 20_000,
        clientName: "Acme Ltd",
        costPrice: 75_000,
        createdAt: 100,
        finalizedPdfFileName: "client-final.pdf",
        finalizedPdfStorageId: "storage_final",
        finalizedPdfUploadedAt: 1_700_000_000_000,
        itinerarySummary: "Day 1 arrival, Day 2 conference, Day 3 city tour",
        landCostPerPax: 50_000,
        margin: 35_000,
        marginPercent: 31.8,
        preparedBy: "Contracting SPOC",
        proposalCode: "P-0001",
        queryId: "queries_1",
        sellingPrice: 110_000,
        status: "Accepted",
        taxRate: 5,
        updatedAt: 120,
        visaCostPerPax: 5000,
      },
    ],
    queries: [
      {
        _id: "queries_1",
        clientName: "Acme Ltd",
        contractingStatus: "Order Confirmed",
        createdBy: "auth_sales",
        destination: "Dubai",
        paxCount: 24,
        queryCode: "Q-0001",
        queryType: "MICE",
        salesStatus: "Order Confirmed",
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
      },
    ],
    queryAttachments: [
      {
        _id: "queryAttachments_1",
        createdAt: 1_700_000_050_000,
        fileName: "sales-sample.xlsx",
        fileSize: 4096,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        queryId: "queries_1",
        storageId: "storage_query_1",
      },
    ],
    roomingListEntries: [],
    staffUsers: [staff],
    tickets: [],
    travelBatches: [],
    travellers: [],
    vendors: [],
    visaRecords: [],
    ...tableOverrides,
  } satisfies Tables;

  const getRows = (table: string) => tables[table] ?? [];
  const findById = (tableOrId: string, explicitId?: string) => {
    if (explicitId) {
      return Promise.resolve(getRows(tableOrId).find((entry) => entry._id === explicitId) ?? null);
    }
    const id = tableOrId;
    for (const rows of Object.values(tables)) {
      const row = rows.find((entry) => entry._id === id);
      if (row) {
        return row;
      }
    }
    return null;
  };
  const queryBuilder = (table: string) => {
    let rows = getRows(table);
    const builder = {
      collect: async () => rows.map((row) => ({ ...row })),
      first: async () => rows[0] ?? null,
      order(direction: string) {
        rows = [...rows].sort((left, right) =>
          direction === "desc"
            ? Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0)
            : Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0)
        );
        return builder;
      },
      take: async (limit: number) => rows.slice(0, limit),
      unique: async () => rows[0] ?? null,
      withIndex(_indexName: string, callback: (q: any) => RuntimeValue) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: RuntimeValue) {
            filters.push({ field, value });
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value));
        return builder;
      },
    };
    return builder;
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({
          email: staff.email,
          name: staff.name,
          subject: staff.authUserId,
        }),
      },
      db: {
        get: findById,
        normalizeId: (table: string, id: string | null | undefined) =>
          id && getRows(table).some((row) => row._id === id) ? id : null,
        query: (table: string) => queryBuilder(table),
      },
    },
    tables,
  };
}

describe("Job Card command center Operations visibility", () => {
  test("Assigned Operations Executive sees operational tour details and uploaded PDF links", async () => {
    const { ctx } = makeCommandCenterCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const payload = await fromAny<any, unknown>(getCommandCenter)._handler(ctx, {
      jobCardId: "jobCards_1",
    });

    assertMatchesReturnContract(jobCardCommandCenterResultValidator, payload);

    expect(payload.checklistTasks[0]).toMatchObject({
      legacyKey: "legacy-jobCards_1-handover",
    });
    expect(payload.checklistTasks[0]).not.toHaveProperty("_id");

    expect(payload.jobCard).toMatchObject({
      clientName: "Acme Ltd",
      confirmedPax: 24,
      destination: "Dubai",
      jobCode: "JC-0001-NS",
      proposalId: "proposals_1",
      queryId: "queries_1",
      travelEndDate: "2026-08-05",
      travelStartDate: "2026-08-01",
    });
    expect(payload.query).toMatchObject({
      clientName: "Acme Ltd",
      contractingStatus: "Order Confirmed",
      destination: "Dubai",
      queryCode: "Q-0001",
      salesStatus: "Order Confirmed",
    });
    expect(payload.proposal).toMatchObject({
      attachments: [
        expect.objectContaining({
          fileName: "operational-itinerary.pdf",
          id: "proposalAttachments_1",
          mimeType: "application/pdf",
        }),
      ],
      finalizedPdf: {
        fileName: "client-final.pdf",
        uploadedAt: new Date(1_700_000_000_000).toISOString(),
      },
      id: "proposals_1",
      itinerarySummary: "Day 1 arrival, Day 2 conference, Day 3 city tour",
      proposalCode: "P-0001",
      status: "Accepted",
    });
    expect(payload.commercialFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "sales-sample.xlsx",
          sourceLabel: "Query Q-0001",
          sourceType: "query",
        }),
      ])
    );
  });

  test("Command center proposal summary hides finance-only fields", async () => {
    const { ctx } = makeCommandCenterCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const payload = await fromAny<any, unknown>(getCommandCenter)._handler(ctx, {
      jobCardId: "jobCards_1",
    });

    expect(payload.proposal).not.toHaveProperty("costPrice");
    expect(payload.proposal).not.toHaveProperty("sellingPrice");
    expect(payload.proposal).not.toHaveProperty("landCostPerPax");
    expect(payload.proposal).not.toHaveProperty("airfarePerPax");
    expect(payload.proposal).not.toHaveProperty("visaCostPerPax");
    expect(payload.proposal).not.toHaveProperty("taxRate");
    expect(payload.proposal).not.toHaveProperty("margin");
    expect(payload.proposal).not.toHaveProperty("marginPercent");
  });

  test("Operations receives coarse payment readiness without invoice identity or exact totals", async () => {
    const { ctx, tables } = makeCommandCenterCtx();
    tables.invoices.push({
      _id: "invoices_sensitive",
      balanceAmount: 80_000,
      createdAt: 200,
      createdBy: "auth_finance",
      expectedAmount: 100_000,
      invoiceNumber: "INV-SENSITIVE-001",
      jobCardId: "jobCards_1",
      receivedAmount: 20_000,
      status: "Part Paid",
      updatedAt: 220,
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const payload = await fromAny<any, unknown>(getCommandCenter)._handler(ctx, {
      jobCardId: "jobCards_1",
    });
    const serializedMoney = JSON.stringify(payload.money);

    expect(payload.money).toEqual({ exact: null, readiness: "partially_outstanding" });
    expect(serializedMoney).not.toContain("invoices_sensitive");
    expect(serializedMoney).not.toContain("INV-SENSITIVE-001");
    expect(serializedMoney).not.toContain("80000");
    expect(payload).not.toHaveProperty("hotels");
    expect(payload).not.toHaveProperty("rooming");
    expect(payload).not.toHaveProperty("tickets");
    expect(payload).not.toHaveProperty("travellers");
    expect(payload).not.toHaveProperty("visaRecords");
    expect(payload.actions.find((action) => action.sectionKey === "finance")).toMatchObject({
      href: null,
      owner: { kind: "role", label: "Finance", staffId: null },
      status: "owned_elsewhere",
    });
  });

  test("propagates bounded Traveller coverage to every traveller-denominated section", async () => {
    const { ctx, tables } = makeCommandCenterCtx();
    tables.travellers.push(
      ...Array.from({ length: 201 }, (_, index) => ({
        _id: `travellers_${index}`,
        jobCardId: "jobCards_1",
        passportStatus: "Received",
      }))
    );
    tables.tickets.push(
      ...Array.from({ length: 200 }, (_, index) => ({
        _id: `tickets_${index}`,
        jobCardId: "jobCards_1",
        ticketStatus: "Issued",
      }))
    );
    tables.visaRecords.push(
      ...Array.from({ length: 200 }, (_, index) => ({
        _id: `visaRecords_${index}`,
        jobCardId: "jobCards_1",
        status: "Approved",
      }))
    );
    tables.hotels.push(
      ...Array.from({ length: 200 }, (_, index) => ({
        _id: `hotels_${index}`,
        jobCardId: "jobCards_1",
      }))
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const payload = await fromAny<any, unknown>(getCommandCenter)._handler(ctx, {
      jobCardId: "jobCards_1",
    });

    for (const key of ["hotels", "tickets", "visas"]) {
      expect(payload.readiness.find((section) => section.key === key)).toMatchObject({
        complete: false,
        coverage: "partial",
      });
    }
  });

  test("Finance receives exact Job Card-indexed invoice and opening commercial rows", async () => {
    const { ctx, tables } = makeCommandCenterCtx({
      _id: "staff_finance",
      authUserId: "auth_finance",
      email: "finance@citius.in",
      emailNormalized: "finance@citius.in",
      name: "Finance User",
      roles: ["Finance"],
    });
    tables.invoices.push({
      _id: "invoices_sensitive",
      balanceAmount: 0,
      createdAt: 200,
      createdBy: "auth_finance",
      expectedAmount: 100_000,
      invoiceNumber: "INV-SENSITIVE-001",
      jobCardId: "jobCards_1",
      receivedAmount: 100_000,
      status: "Paid",
      updatedAt: 220,
    });
    tables.jobCards[0].openingSnapshot = {
      authority: {
        confirmedOfferId: "confirmedOffers_1",
        proposalId: "proposals_1",
        proposalQueryHandoffId: "proposalQueryHandoffs_1",
        proposalRevision: 1,
        queryId: "queries_1",
      },
      commercial: {
        airfarePerPax: 20_000,
        landCostPerPax: 45_000,
        profitPerPax: 30_000,
        sellingPricePerPax: 100_000,
        visaCostPerPax: 5000,
      },
      effective: {
        clientName: "Acme Ltd",
        confirmedPax: 24,
        destination: "Dubai",
        roomCount: 12,
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
      },
      openedAt: 200,
      openedByStaffId: "staff_accounts",
      source: {
        clientName: "Acme Ltd",
        confirmedPax: 24,
        destination: "Dubai",
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
      },
      variances: [],
      version: 1,
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const payload = await fromAny<any, unknown>(getCommandCenter)._handler(ctx, {
      jobCardId: "jobCards_1",
    });

    expect(payload.money).toMatchObject({
      exact: {
        invoices: [
          {
            balanceAmount: 0,
            expectedAmount: 100_000,
            id: "invoices_sensitive",
            invoiceNumber: "INV-SENSITIVE-001",
            receivedAmount: 100_000,
          },
        ],
      },
      readiness: "ready",
    });
    expect(payload.openingEvidence.commercial).toMatchObject({ sellingPricePerPax: 100_000 });
    expect(payload.actions.find((action) => action.sectionKey === "finance")).toBeUndefined();
  });

  test("Assigned Operations Executive can resolve proposal PDF records through visible Job Card", async () => {
    const { ctx } = makeCommandCenterCtx();

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getAttachmentRecord)._handler(ctx, {
        attachmentId: "proposalAttachments_1",
      })
    ).resolves.toMatchObject({
      fileName: "operational-itinerary.pdf",
      id: "proposalAttachments_1",
      mimeType: "application/pdf",
      proposalId: "proposals_1",
      storageId: "storage_1",
    });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getFinalizedPdfRecord)._handler(ctx, { proposalId: "proposals_1" })
    ).resolves.toMatchObject({
      fileName: "client-final.pdf",
      proposalId: "proposals_1",
      storageId: "storage_final",
    });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getQueryAttachmentRecord)._handler(ctx, {
        attachmentId: "queryAttachments_1",
      })
    ).resolves.toMatchObject({
      id: "queryAttachments_1",
      queryId: "queries_1",
      storageId: "storage_query_1",
    });
  });

  test("Collaborating Operations Executive can resolve command center and proposal PDF records", async () => {
    const { ctx } = makeCommandCenterCtx(
      {},
      {
        jobCards: [
          {
            _id: "jobCards_1",
            clientName: "Acme Ltd",
            collaboratorStaffIds: ["staff_operations"],
            confirmedPax: 24,
            contractingOwnerName: "Contracting SPOC",
            createdAt: 200,
            createdBy: "auth_accounts",
            destination: "Dubai",
            jobCode: "JC-0001-NS",
            operationsOwnerId: "staff_owner",
            operationsOwnerName: "Ops Owner",
            proposalId: "proposals_1",
            queryId: "queries_1",
            queryType: "MICE",
            roomCount: 12,
            status: "In Operations",
            ticketingOwnerName: "Ticketing SPOC",
            tourManagerName: "Tour Lead",
            travelEndDate: "2026-08-05",
            travelStartDate: "2026-08-01",
            updatedAt: 220,
          },
        ],
      }
    );

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getCommandCenter)._handler(ctx, { jobCardId: "jobCards_1" })
    ).resolves.toMatchObject({
      jobCard: {
        clientName: "Acme Ltd",
        confirmedPax: 24,
        destination: "Dubai",
        jobCode: "JC-0001-NS",
        proposalId: "proposals_1",
        queryId: "queries_1",
      },
      proposal: {
        attachments: [expect.objectContaining({ id: "proposalAttachments_1" })],
        finalizedPdf: expect.objectContaining({ fileName: "client-final.pdf" }),
        id: "proposals_1",
        proposalCode: "P-0001",
      },
    });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getAttachmentRecord)._handler(ctx, {
        attachmentId: "proposalAttachments_1",
      })
    ).resolves.toMatchObject({
      id: "proposalAttachments_1",
      proposalId: "proposals_1",
      storageId: "storage_1",
    });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getFinalizedPdfRecord)._handler(ctx, { proposalId: "proposals_1" })
    ).resolves.toMatchObject({
      proposalId: "proposals_1",
      storageId: "storage_final",
    });
  });

  test("Unassigned Operations Executive cannot see another team's command center", async () => {
    const { ctx } = makeCommandCenterCtx({
      // SAFETY: This test controls the asserted value at the framework boundary below.
      _id: fromPartial<Id<"staffUsers">>("staff_other"),
      authUserId: "auth_other",
      email: "other-ops@citius.in",
      emailNormalized: "other-ops@citius.in",
      name: "Other Operations",
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getCommandCenter)._handler(ctx, { jobCardId: "jobCards_1" })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getAttachmentRecord)._handler(ctx, {
        attachmentId: "proposalAttachments_1",
      })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(getFinalizedPdfRecord)._handler(ctx, { proposalId: "proposals_1" })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
  });
});
