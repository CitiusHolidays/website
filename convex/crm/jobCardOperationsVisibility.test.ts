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
    active: true,
    authUserId: "auth_operations",
    email: "ops@citius.in",
    emailNormalized: "ops@citius.in",
    name: "Ops Executive",
    roles: ["Operations"],
    ...staffOverrides,
  };
  const tables: Tables = {
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
    roomingListEntries: [],
    staffUsers: [staff],
    tickets: [],
    travelBatches: [],
    travellers: [],
    vendors: [],
    visaRecords: [],
    ...tableOverrides,
  };

  const getRows = (table: string) => tables[table] ?? [];
  const findById = async (id: string) => {
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
      unique: async () => rows[0] ?? null,
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
  };
}

describe("Job Card command center Operations visibility", () => {
  test("assigned Operations Executive sees operational tour details and uploaded PDF links", async () => {
    const { ctx } = makeCommandCenterCtx();

    const payload = await (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" });

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
      (getAttachmentRecord as any)._handler(ctx, { attachmentId: "proposalAttachments_1" })
    ).resolves.toMatchObject({
      fileName: "operational-itinerary.pdf",
      id: "proposalAttachments_1",
      mimeType: "application/pdf",
      proposalId: "proposals_1",
      storageId: "storage_1",
    });
    await expect(
      (getFinalizedPdfRecord as any)._handler(ctx, { proposalId: "proposals_1" })
    ).resolves.toMatchObject({
      fileName: "client-final.pdf",
      proposalId: "proposals_1",
      storageId: "storage_final",
    });
  });

  test("collaborating Operations Executive can resolve command center and proposal PDF records", async () => {
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
      (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" })
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
      (getAttachmentRecord as any)._handler(ctx, { attachmentId: "proposalAttachments_1" })
    ).resolves.toMatchObject({
      id: "proposalAttachments_1",
      proposalId: "proposals_1",
      storageId: "storage_1",
    });
    await expect(
      (getFinalizedPdfRecord as any)._handler(ctx, { proposalId: "proposals_1" })
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
      (getCommandCenter as any)._handler(ctx, { jobCardId: "jobCards_1" })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
    await expect(
      (getAttachmentRecord as any)._handler(ctx, { attachmentId: "proposalAttachments_1" })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
    await expect(
      (getFinalizedPdfRecord as any)._handler(ctx, { proposalId: "proposals_1" })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
  });
});
