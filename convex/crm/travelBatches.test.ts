import { describe, expect, test } from "bun:test";
import {
  buildTravelBatchReference,
  createTravelBatch,
  formatTravelBatchCode,
  listTravelBatches,
  nextTravelBatchIdentity,
  updateTravelBatch,
} from "./jobCards";

type Row = { _id: string; [key: string]: any };
type Tables = Record<string, Row[]>;

function makeTravelBatchCtx(initialTables: Tables = {}) {
  const staff = {
    _id: "staff_ops_head",
    authUserId: "auth_ops_head",
    email: "ops-head@example.com",
    emailNormalized: "ops-head@example.com",
    name: "Ops Head",
    roles: ["Operations Head"],
    active: true,
  };
  const tables = {
    staffUsers: [staff],
    activityLogs: [],
    travelBatches: [],
    ...Object.fromEntries(
      Object.entries(initialTables).map(([table, rows]) => [
        table,
        rows.map((row) => ({ ...row })),
      ]),
    ),
  } as Tables;

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
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
    };
    return builder;
  };

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        subject: "auth_ops_head",
        email: "ops-head@example.com",
        name: "Ops Head",
      }),
    },
    db: {
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      get: findById,
      query: (table: string) => queryBuilder(table),
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
    },
  };

  return { ctx, tables };
}

const baseJobCard = {
  _id: "jobCards_1",
  jobCode: "JC-0001-NS",
  clientName: "Acme Ltd",
  destination: "Dubai",
  confirmedPax: 24,
  roomCount: 12,
  travelStartDate: "2026-08-01",
  travelEndDate: "2026-08-05",
  queryType: "MICE",
  paymentTerms: { advance: 50 },
  contractingOwnerId: "staff_contracting",
  contractingOwnerName: "Contracting SPOC",
  operationsOwnerId: "staff_ops",
  operationsOwnerName: "Ops SPOC",
  ticketingOwnerId: "staff_ticketing",
  ticketingOwnerName: "Ticketing SPOC",
  tourManagerName: "Tour Lead",
  status: "Open",
  preDepartureChecklist: [{ key: "handover", done: false }],
  createdBy: "auth_accounts",
  createdAt: 1000,
  updatedAt: 1000,
};

describe("Travel Batches on Job Cards", () => {
  test("generates compact Travel Batch identity from Job Card code", () => {
    expect(formatTravelBatchCode(1)).toBe("B01");
    expect(formatTravelBatchCode(12)).toBe("B12");
    expect(buildTravelBatchReference("JC-0001-NS", "B01")).toBe("JC-0001-NS / B01");
    expect(
      nextTravelBatchIdentity("JC-0001-NS", [{ batchCode: "B01" }, { batchCode: "B03" }]),
    ).toEqual({
      batchCode: "B04",
      batchReference: "JC-0001-NS / B04",
    });
  });

  test("creates Travel Batches as full child trip instances with parent operational defaults", async () => {
    const { ctx, tables } = makeTravelBatchCtx({
      jobCards: [baseJobCard],
      travelBatches: [],
    });

    const result = await (createTravelBatch as any)._handler(ctx, {
      jobCardId: "jobCards_1",
    });

    expect(result).toMatchObject({
      id: "travelBatches_1",
      batchCode: "B01",
      batchReference: "JC-0001-NS / B01",
    });
    expect(tables.travelBatches[0]).toMatchObject({
      jobCardId: "jobCards_1",
      batchCode: "B01",
      batchReference: "JC-0001-NS / B01",
      destination: "Dubai",
      confirmedPax: 24,
      roomCount: 12,
      travelStartDate: "2026-08-01",
      travelEndDate: "2026-08-05",
      queryType: "MICE",
      paymentTerms: { advance: 50 },
      contractingOwnerId: "staff_contracting",
      contractingOwnerName: "Contracting SPOC",
      operationsOwnerId: "staff_ops",
      operationsOwnerName: "Ops SPOC",
      ticketingOwnerId: "staff_ticketing",
      ticketingOwnerName: "Ticketing SPOC",
      tourManagerName: "Tour Lead",
      status: "Open",
      preDepartureChecklist: [{ key: "handover", done: false }],
    });
    expect(tables.activityLogs[0]).toMatchObject({
      entityType: "jobCard",
      entityId: "jobCards_1",
      action: "travel_batch_created",
      message: "JC-0001-NS / B01 created",
    });
  });

  test("supports zero or more Travel Batches per Job Card", async () => {
    const { ctx } = makeTravelBatchCtx({
      jobCards: [baseJobCard],
      travelBatches: [],
    });

    await expect(
      (listTravelBatches as any)._handler(ctx, { jobCardId: "jobCards_1" }),
    ).resolves.toEqual([]);

    await (createTravelBatch as any)._handler(ctx, {
      jobCardId: "jobCards_1",
      confirmedPax: 12,
    });
    await (createTravelBatch as any)._handler(ctx, {
      jobCardId: "jobCards_1",
      confirmedPax: 12,
      travelStartDate: "2026-08-06",
      travelEndDate: "2026-08-10",
    });

    const rows = await (listTravelBatches as any)._handler(ctx, { jobCardId: "jobCards_1" });
    expect(rows.map((row: any) => row.batchReference)).toEqual([
      "JC-0001-NS / B01",
      "JC-0001-NS / B02",
    ]);
  });

  test("lists Travel Batches for one Job Card in compact identity order", async () => {
    const { ctx } = makeTravelBatchCtx({
      jobCards: [baseJobCard],
      travelBatches: [
        {
          _id: "travelBatches_2",
          jobCardId: "jobCards_1",
          batchCode: "B02",
          batchReference: "JC-0001-NS / B02",
          destination: "Dubai",
          confirmedPax: 10,
          status: "Open",
          createdBy: "auth_ops_head",
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          _id: "travelBatches_1",
          jobCardId: "jobCards_1",
          batchCode: "B01",
          batchReference: "JC-0001-NS / B01",
          destination: "Dubai",
          confirmedPax: 14,
          status: "In Operations",
          createdBy: "auth_ops_head",
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          _id: "travelBatches_other",
          jobCardId: "jobCards_2",
          batchCode: "B01",
          batchReference: "JC-0002-NS / B01",
          destination: "Bali",
          confirmedPax: 8,
          status: "Open",
          createdBy: "auth_ops_head",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    const rows = await (listTravelBatches as any)._handler(ctx, { jobCardId: "jobCards_1" });

    expect(rows.map((row: any) => row.batchReference)).toEqual([
      "JC-0001-NS / B01",
      "JC-0001-NS / B02",
    ]);
    expect(rows[0]).toMatchObject({
      id: "travelBatches_1",
      jobCardId: "jobCards_1",
      status: "In Operations",
      confirmedPax: 14,
    });
  });

  test("updates Travel Batch operational fields without changing identity", async () => {
    const { ctx, tables } = makeTravelBatchCtx({
      jobCards: [baseJobCard],
      travelBatches: [
        {
          _id: "travelBatches_1",
          jobCardId: "jobCards_1",
          batchCode: "B01",
          batchReference: "JC-0001-NS / B01",
          destination: "Dubai",
          confirmedPax: 24,
          roomCount: 12,
          travelStartDate: "2026-08-01",
          travelEndDate: "2026-08-05",
          status: "Open",
          tourManagerName: "Tour Lead",
          createdBy: "auth_ops_head",
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    await (updateTravelBatch as any)._handler(ctx, {
      travelBatchId: "travelBatches_1",
      destination: "Abu Dhabi",
      confirmedPax: 18,
      roomCount: 9,
      travelStartDate: "2026-08-03",
      travelEndDate: "2026-08-07",
      tourManagerName: "New Lead",
      status: "In Operations",
    });

    expect(tables.travelBatches[0]).toMatchObject({
      batchCode: "B01",
      batchReference: "JC-0001-NS / B01",
      destination: "Abu Dhabi",
      confirmedPax: 18,
      roomCount: 9,
      travelStartDate: "2026-08-03",
      travelEndDate: "2026-08-07",
      tourManagerName: "New Lead",
      status: "In Operations",
      lastEditedBy: "auth_ops_head",
      lastEditedByName: "Ops Head",
    });
    expect(tables.activityLogs[0]).toMatchObject({
      entityType: "jobCard",
      entityId: "jobCards_1",
      action: "travel_batch_updated",
      message: "JC-0001-NS / B01 updated",
    });
  });
});
