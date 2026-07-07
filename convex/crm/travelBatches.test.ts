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
    active: true,
    authUserId: "auth_ops_head",
    email: "ops-head@example.com",
    emailNormalized: "ops-head@example.com",
    name: "Ops Head",
    roles: ["Operations Head"],
  };
  const tables = {
    activityLogs: [],
    staffUsers: [staff],
    travelBatches: [],
    ...Object.fromEntries(
      Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
    ),
  } as Tables;

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

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "ops-head@example.com",
        name: "Ops Head",
        subject: "auth_ops_head",
      }),
    },
    db: {
      get: findById,
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query: (table: string) => queryBuilder(table),
    },
  };

  return { ctx, tables };
}

const baseJobCard = {
  _id: "jobCards_1",
  clientName: "Acme Ltd",
  confirmedPax: 24,
  contractingOwnerId: "staff_contracting",
  contractingOwnerName: "Contracting SPOC",
  createdAt: 1000,
  createdBy: "auth_accounts",
  destination: "Dubai",
  jobCode: "JC-0001-NS",
  operationsOwnerId: "staff_ops",
  operationsOwnerName: "Ops SPOC",
  paymentTerms: { advance: 50 },
  preDepartureChecklist: [{ done: false, key: "handover" }],
  queryType: "MICE",
  roomCount: 12,
  status: "Open",
  ticketingOwnerId: "staff_ticketing",
  ticketingOwnerName: "Ticketing SPOC",
  tourManagerName: "Tour Lead",
  travelEndDate: "2026-08-05",
  travelStartDate: "2026-08-01",
  updatedAt: 1000,
};

describe("Travel Batches on Job Cards", () => {
  test("generates compact Travel Batch identity from Job Card code", () => {
    expect(formatTravelBatchCode(1)).toBe("B01");
    expect(formatTravelBatchCode(12)).toBe("B12");
    expect(buildTravelBatchReference("JC-0001-NS", "B01")).toBe("JC-0001-NS / B01");
    expect(
      nextTravelBatchIdentity("JC-0001-NS", [{ batchCode: "B01" }, { batchCode: "B03" }])
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
      batchCode: "B01",
      batchReference: "JC-0001-NS / B01",
      id: "travelBatches_1",
    });
    expect(tables.travelBatches[0]).toMatchObject({
      batchCode: "B01",
      batchReference: "JC-0001-NS / B01",
      confirmedPax: 24,
      contractingOwnerId: "staff_contracting",
      contractingOwnerName: "Contracting SPOC",
      destination: "Dubai",
      jobCardId: "jobCards_1",
      operationsOwnerId: "staff_ops",
      operationsOwnerName: "Ops SPOC",
      paymentTerms: { advance: 50 },
      preDepartureChecklist: [{ done: false, key: "handover" }],
      queryType: "MICE",
      roomCount: 12,
      status: "Open",
      ticketingOwnerId: "staff_ticketing",
      ticketingOwnerName: "Ticketing SPOC",
      tourManagerName: "Tour Lead",
      travelEndDate: "2026-08-05",
      travelStartDate: "2026-08-01",
    });
    expect(tables.activityLogs[0]).toMatchObject({
      action: "travel_batch_created",
      entityId: "jobCards_1",
      entityType: "jobCard",
      message: "JC-0001-NS / B01 created",
    });
  });

  test("supports zero or more Travel Batches per Job Card", async () => {
    const { ctx } = makeTravelBatchCtx({
      jobCards: [baseJobCard],
      travelBatches: [],
    });

    await expect(
      (listTravelBatches as any)._handler(ctx, { jobCardId: "jobCards_1" })
    ).resolves.toEqual([]);

    await (createTravelBatch as any)._handler(ctx, {
      confirmedPax: 12,
      jobCardId: "jobCards_1",
    });
    await (createTravelBatch as any)._handler(ctx, {
      confirmedPax: 12,
      jobCardId: "jobCards_1",
      travelEndDate: "2026-08-10",
      travelStartDate: "2026-08-06",
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
          batchCode: "B02",
          batchReference: "JC-0001-NS / B02",
          confirmedPax: 10,
          createdAt: 2000,
          createdBy: "auth_ops_head",
          destination: "Dubai",
          jobCardId: "jobCards_1",
          status: "Open",
          updatedAt: 2000,
        },
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001-NS / B01",
          confirmedPax: 14,
          createdAt: 1000,
          createdBy: "auth_ops_head",
          destination: "Dubai",
          jobCardId: "jobCards_1",
          status: "In Operations",
          updatedAt: 1000,
        },
        {
          _id: "travelBatches_other",
          batchCode: "B01",
          batchReference: "JC-0002-NS / B01",
          confirmedPax: 8,
          createdAt: 1000,
          createdBy: "auth_ops_head",
          destination: "Bali",
          jobCardId: "jobCards_2",
          status: "Open",
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
      confirmedPax: 14,
      id: "travelBatches_1",
      jobCardId: "jobCards_1",
      status: "In Operations",
    });
  });

  test("updates Travel Batch operational fields without changing identity", async () => {
    const { ctx, tables } = makeTravelBatchCtx({
      jobCards: [baseJobCard],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001-NS / B01",
          confirmedPax: 24,
          createdAt: 1000,
          createdBy: "auth_ops_head",
          destination: "Dubai",
          jobCardId: "jobCards_1",
          roomCount: 12,
          status: "Open",
          tourManagerName: "Tour Lead",
          travelEndDate: "2026-08-05",
          travelStartDate: "2026-08-01",
          updatedAt: 1000,
        },
      ],
    });

    await (updateTravelBatch as any)._handler(ctx, {
      confirmedPax: 18,
      destination: "Abu Dhabi",
      roomCount: 9,
      status: "In Operations",
      tourManagerName: "New Lead",
      travelBatchId: "travelBatches_1",
      travelEndDate: "2026-08-07",
      travelStartDate: "2026-08-03",
    });

    expect(tables.travelBatches[0]).toMatchObject({
      batchCode: "B01",
      batchReference: "JC-0001-NS / B01",
      confirmedPax: 18,
      destination: "Abu Dhabi",
      lastEditedBy: "auth_ops_head",
      lastEditedByName: "Ops Head",
      roomCount: 9,
      status: "In Operations",
      tourManagerName: "New Lead",
      travelEndDate: "2026-08-07",
      travelStartDate: "2026-08-03",
    });
    expect(tables.activityLogs[0]).toMatchObject({
      action: "travel_batch_updated",
      entityId: "jobCards_1",
      entityType: "jobCard",
      message: "JC-0001-NS / B01 updated",
    });
  });
});
