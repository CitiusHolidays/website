import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getCommandCenter } from "./jobCards";
import { getAttachmentRecord } from "./proposalAttachments";
import { getFinalizedPdfRecord } from "./proposals";

type Row = { _id: string; [key: string]: any };
type Tables = Record<string, Row[]>;

function makeCommandCenterCtx(staffOverrides: Partial<Row> = {}, tableOverrides: Tables = {}) {
  const staff = {
    _id: "staff_operations" as Id<"staffUsers">,
    authUserId: "auth_operations",
    email: "ops@citius.in",
    emailNormalized: "ops@citius.in",
    name: "Ops Executive",
    roles: ["Operations"],
    active: true,
    ...staffOverrides,
  };
  const tables: Tables = {
    staffUsers: [staff],
    queries: [
      {
        _id: "queries_1",
        queryCode: "Q-0001",
        clientName: "Acme Ltd",
        destination: "Dubai",
        paxCount: 24,
        travelStartDate: "2026-08-01",
        travelEndDate: "2026-08-05",
        queryType: "MICE",
        salesStatus: "Order Confirmed",
        contractingStatus: "Order Confirmed",
        createdBy: "auth_sales",
      },
    ],
    proposals: [
      {
        _id: "proposals_1",
        proposalCode: "P-0001",
        queryId: "queries_1",
        clientName: "Acme Ltd",
        preparedBy: "Contracting SPOC",
        landCostPerPax: 50_000,
        airfarePerPax: 20_000,
        visaCostPerPax: 5_000,
        sellingPrice: 110_000,
        costPrice: 75_000,
        margin: 35_000,
        marginPercent: 31.8,
        taxRate: 5,
        itinerarySummary: "Day 1 arrival, Day 2 conference, Day 3 city tour",
        finalizedPdfStorageId: "storage_final",
        finalizedPdfFileName: "client-final.pdf",
        finalizedPdfUploadedAt: 1_700_000_000_000,
        status: "Accepted",
        createdAt: 100,
        updatedAt: 120,
      },
    ],
    proposalAttachments: [
      {
        _id: "proposalAttachments_1",
        proposalId: "proposals_1",
        storageId: "storage_1",
        fileName: "operational-itinerary.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
        createdAt: 1_700_000_100_000,
      },
    ],
    proposalQueryLinks: [],
    jobCards: [
      {
        _id: "jobCards_1",
        jobCode: "JC-0001-NS",
        queryId: "queries_1",
        proposalId: "proposals_1",
        clientName: "Acme Ltd",
        destination: "Dubai",
        confirmedPax: 24,
        roomCount: 12,
        travelStartDate: "2026-08-01",
        travelEndDate: "2026-08-05",
        queryType: "MICE",
        operationsOwnerId: "staff_operations",
        operationsOwnerName: "Ops Executive",
        contractingOwnerName: "Contracting SPOC",
        ticketingOwnerName: "Ticketing SPOC",
        tourManagerName: "Tour Lead",
        status: "In Operations",
        createdBy: "auth_accounts",
        createdAt: 200,
        updatedAt: 220,
      },
    ],
    travellers: [],
    visaRecords: [],
    tickets: [],
    pnrs: [],
    hotels: [],
    roomingListEntries: [],
    vendors: [],
    itineraries: [],
    eventFlows: [],
    invoices: [],
    expenseEntries: [],
    activityLogs: [],
    checklistTasks: [],
    travelBatches: [],
    ...tableOverrides,
  };

  const getRows = (table: string) => tables[table] ?? [];
  const findById = async (id: string) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((entry) => entry._id === id);
      if (row) return row;
    }
    return null;
  };
  const queryBuilder = (table: string) => {
    let rows = getRows(table);
    const builder = {
      withIndex(_indexName: string, callback: (q: any) => unknown) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push({ field, value });
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value));
        return builder;
      },
      collect: async () => rows.map((row) => ({ ...row })),
      unique: async () => rows[0] ?? null,
      first: async () => rows[0] ?? null,
    };
    return builder;
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({
          subject: staff.authUserId,
          email: staff.email,
          name: staff.name,
        }),
      },
      db: {
        normalizeId: (table: string, id: string | null | undefined) =>
          id && getRows(table).some((row) => row._id === id) ? id : null,
        get: findById,
        query: (table: string) => queryBuilder(table),
      },
    },
  };
}

describe("Job Card command center Operations visibility", () => {
  test("assigned Operations Executive sees operational tour details and uploaded PDF links", async () => {
    const { ctx } = makeCommandCenterCtx();

    const payload = await (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" });

    expect(payload.jobCard).toMatchObject({
      jobCode: "JC-0001-NS",
      clientName: "Acme Ltd",
      destination: "Dubai",
      confirmedPax: 24,
      travelStartDate: "2026-08-01",
      travelEndDate: "2026-08-05",
      proposalId: "proposals_1",
      queryId: "queries_1",
    });
    expect(payload.query).toMatchObject({
      queryCode: "Q-0001",
      clientName: "Acme Ltd",
      destination: "Dubai",
      salesStatus: "Order Confirmed",
      contractingStatus: "Order Confirmed",
    });
    expect(payload.proposal).toMatchObject({
      id: "proposals_1",
      proposalCode: "P-0001",
      status: "Accepted",
      itinerarySummary: "Day 1 arrival, Day 2 conference, Day 3 city tour",
      attachments: [
        expect.objectContaining({
          id: "proposalAttachments_1",
          fileName: "operational-itinerary.pdf",
          mimeType: "application/pdf",
        }),
      ],
      finalizedPdf: {
        fileName: "client-final.pdf",
        uploadedAt: new Date(1_700_000_000_000).toISOString(),
      },
    });
  });

  test("command center proposal summary hides finance-only fields", async () => {
    const { ctx } = makeCommandCenterCtx();

    const payload = await (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" });

    expect(payload.proposal).not.toHaveProperty("costPrice");
    expect(payload.proposal).not.toHaveProperty("sellingPrice");
    expect(payload.proposal).not.toHaveProperty("landCostPerPax");
    expect(payload.proposal).not.toHaveProperty("airfarePerPax");
    expect(payload.proposal).not.toHaveProperty("visaCostPerPax");
    expect(payload.proposal).not.toHaveProperty("taxRate");
    expect(payload.proposal).not.toHaveProperty("margin");
    expect(payload.proposal).not.toHaveProperty("marginPercent");
  });

  test("assigned Operations Executive can resolve proposal PDF records through visible Job Card", async () => {
    const { ctx } = makeCommandCenterCtx();

    await expect(
      (getAttachmentRecord as any)._handler(ctx, { attachmentId: "proposalAttachments_1" }),
    ).resolves.toMatchObject({
      id: "proposalAttachments_1",
      proposalId: "proposals_1",
      storageId: "storage_1",
      fileName: "operational-itinerary.pdf",
      mimeType: "application/pdf",
    });
    await expect(
      (getFinalizedPdfRecord as any)._handler(ctx, { proposalId: "proposals_1" }),
    ).resolves.toMatchObject({
      proposalId: "proposals_1",
      storageId: "storage_final",
      fileName: "client-final.pdf",
    });
  });

  test("collaborating Operations Executive can resolve command center and proposal PDF records", async () => {
    const { ctx } = makeCommandCenterCtx(
      {},
      {
        jobCards: [
          {
            _id: "jobCards_1",
            jobCode: "JC-0001-NS",
            queryId: "queries_1",
            proposalId: "proposals_1",
            clientName: "Acme Ltd",
            destination: "Dubai",
            confirmedPax: 24,
            roomCount: 12,
            travelStartDate: "2026-08-01",
            travelEndDate: "2026-08-05",
            queryType: "MICE",
            operationsOwnerId: "staff_owner",
            operationsOwnerName: "Ops Owner",
            collaboratorStaffIds: ["staff_operations"],
            contractingOwnerName: "Contracting SPOC",
            ticketingOwnerName: "Ticketing SPOC",
            tourManagerName: "Tour Lead",
            status: "In Operations",
            createdBy: "auth_accounts",
            createdAt: 200,
            updatedAt: 220,
          },
        ],
      },
    );

    await expect(
      (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" }),
    ).resolves.toMatchObject({
      jobCard: {
        jobCode: "JC-0001-NS",
        clientName: "Acme Ltd",
        destination: "Dubai",
        confirmedPax: 24,
        proposalId: "proposals_1",
        queryId: "queries_1",
      },
      proposal: {
        id: "proposals_1",
        proposalCode: "P-0001",
        attachments: [expect.objectContaining({ id: "proposalAttachments_1" })],
        finalizedPdf: expect.objectContaining({ fileName: "client-final.pdf" }),
      },
    });
    await expect(
      (getAttachmentRecord as any)._handler(ctx, { attachmentId: "proposalAttachments_1" }),
    ).resolves.toMatchObject({
      id: "proposalAttachments_1",
      proposalId: "proposals_1",
      storageId: "storage_1",
    });
    await expect(
      (getFinalizedPdfRecord as any)._handler(ctx, { proposalId: "proposals_1" }),
    ).resolves.toMatchObject({
      proposalId: "proposals_1",
      storageId: "storage_final",
    });
  });

  test("unassigned Operations Executive cannot see another team's command center", async () => {
    const { ctx } = makeCommandCenterCtx({
      _id: "staff_other" as Id<"staffUsers">,
      authUserId: "auth_other",
      email: "other-ops@citius.in",
      emailNormalized: "other-ops@citius.in",
      name: "Other Operations",
    });

    await expect(
      (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" }),
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
    await expect(
      (getAttachmentRecord as any)._handler(ctx, { attachmentId: "proposalAttachments_1" }),
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
    await expect(
      (getFinalizedPdfRecord as any)._handler(ctx, { proposalId: "proposals_1" }),
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
  });
});
