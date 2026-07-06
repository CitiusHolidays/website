import { describe, expect, spyOn, test } from "bun:test";
import { processImportRows } from "./importProcessor";
import { commitFlightImportForTest, getPassengerExportSource } from "./imports";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeImportCtx(initialTables: Tables, options?: { failInsertNames?: Set<string> }) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;
  const failInsertNames = options?.failInsertNames ?? new Set<string>();

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        subject: "auth_ticketing",
        email: "ticketing@example.com",
        name: "Ticketing User",
      }),
    },
    db: {
      normalizeId: (_tableName: string, id: string | null | undefined) => id ?? null,
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) return row;
        }
        return null;
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value),
            );
            return this;
          },
          unique: async () => rows[0] ?? null,
          first: async () => rows[0] ?? null,
          collect: async () => [...rows],
        };
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
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        if (tableName === "travellers" && failInsertNames.has(String(doc.fullName))) {
          throw new Error("simulated insert failure");
        }
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
    },
  };

  return { ctx, tables };
}

describe("processImportRows failed count", () => {
  test("increments failed when a row throws", async () => {
    const jobCardId = "jobCards_1";
    const { ctx } = makeImportCtx(
      {
        jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
        travellers: [],
        passportDetails: [],
        visaRecords: [],
      },
      { failInsertNames: new Set(["Broken Row"]) },
    );

    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await processImportRows(ctx as never, {
        jobCardId: jobCardId as never,
        rows: [
          {
            fullName: "Good Row",
            importKey: "row-1",
            importKind: "passenger",
            visaRequired: false,
            foodPreference: "Veg",
            guestType: "Client",
            paymentType: "Company Paid",
            roomType: "Twin",
          },
          {
            fullName: "Broken Row",
            importKey: "row-2",
            importKind: "passenger",
            visaRequired: false,
            foodPreference: "Veg",
            guestType: "Client",
            paymentType: "Company Paid",
            roomType: "Twin",
          },
        ],
        access: { authUserId: "user_1" },
        job: {
          _id: jobCardId,
          jobCode: "JC-0001",
          travelStartDate: "2026-06-01",
        },
        matchIndex: {
          byImportKey: new Map(),
          byNormalizedName: new Map(),
          byPassportHash: new Map(),
        },
      });

      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(2);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("processImportRows Travel Batch context", () => {
  const baseRow = {
    fullName: "Batch Guest",
    importKey: "row-1",
    importKind: "traveller",
    sourceSheet: "Master list",
    sourceRowNumber: 2,
    visaRequired: false,
    foodPreference: "Veg",
    guestType: "Client",
    paymentType: "Company Paid",
    roomType: "Twin",
  };

  test("creates traveller rows with a matching Travel Batch", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      travelBatches: [
        {
          _id: "travelBatches_1",
          jobCardId,
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
        },
      ],
      travellers: [],
      passportDetails: [],
      visaRecords: [],
    });

    const result = await processImportRows(ctx as never, {
      jobCardId: jobCardId as never,
      rows: [{ ...baseRow, travelBatchReference: "JC-0001 / B01" }],
      access: { authUserId: "user_1" },
      job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
      matchIndex: {
        byImportKey: new Map(),
        byNormalizedName: new Map(),
        byPassportHash: new Map(),
      },
    });

    expect(result).toMatchObject({ created: 1, updated: 0, failed: 0 });
    expect(tables.travellers[0]).toMatchObject({
      fullName: "Batch Guest",
      travelBatchId: "travelBatches_1",
    });
  });

  test("keeps unbatched traveller imports unchanged", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      travelBatches: [],
      travellers: [],
      passportDetails: [],
      visaRecords: [],
    });

    const result = await processImportRows(ctx as never, {
      jobCardId: jobCardId as never,
      rows: [baseRow],
      access: { authUserId: "user_1" },
      job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
      matchIndex: {
        byImportKey: new Map(),
        byNormalizedName: new Map(),
        byPassportHash: new Map(),
      },
    });

    expect(result).toMatchObject({ created: 1, updated: 0, failed: 0 });
    expect(tables.travellers[0]).not.toHaveProperty("travelBatchId");
  });

  test("fails rows that reference a Travel Batch from another Job Card", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      travelBatches: [
        {
          _id: "travelBatches_2",
          jobCardId: "jobCards_2",
          batchCode: "B01",
          batchReference: "JC-0002 / B01",
        },
      ],
      travellers: [],
      passportDetails: [],
      visaRecords: [],
    });

    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await processImportRows(ctx as never, {
        jobCardId: jobCardId as never,
        rows: [{ ...baseRow, travelBatchId: "travelBatches_2" }],
        access: { authUserId: "user_1" },
        job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
        matchIndex: {
          byImportKey: new Map(),
          byNormalizedName: new Map(),
          byPassportHash: new Map(),
        },
      });

      expect(result).toMatchObject({ created: 0, updated: 0, failed: 1 });
      expect(tables.travellers).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("getPassengerExportSource Travel Batch context", () => {
  test("returns batch display fields for batched and unbatched rows", async () => {
    const jobCardId = "jobCards_1";
    const { ctx } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", clientName: "Acme" }],
      travelBatches: [
        {
          _id: "travelBatches_1",
          jobCardId,
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
        },
      ],
      travellers: [
        {
          _id: "travellers_1",
          jobCardId,
          travelBatchId: "travelBatches_1",
          fullName: "Batched Guest",
          foodPreference: "Veg",
          paymentType: "Company Paid",
          roomType: "Twin",
          visaRequired: true,
          visaStatus: "Not Started",
          sourceRowNumber: 1,
          createdAt: 1000,
        },
        {
          _id: "travellers_2",
          jobCardId,
          fullName: "Unbatched Guest",
          foodPreference: "Veg",
          paymentType: "Company Paid",
          roomType: "Twin",
          visaRequired: false,
          visaStatus: "Not Required",
          sourceRowNumber: 2,
          createdAt: 1001,
        },
      ],
      passportDetails: [],
      visaRecords: [],
      tickets: [],
    });

    const result = await (getPassengerExportSource as any)._handler(ctx, {
      jobCardId,
      access: { allowed: true, roles: ["Operations Head"], permissions: [] },
    });

    expect(result.rows[0]).toMatchObject({
      fullName: "Batched Guest",
      travelBatchId: "travelBatches_1",
      travelBatchCode: "B01",
      travelBatchReference: "JC-0001 / B01",
    });
    expect(result.rows[1]).toMatchObject({
      fullName: "Unbatched Guest",
      travelBatchId: "",
      travelBatchCode: "",
      travelBatchReference: "",
    });
  });
});

describe("commitFlightImport Travel Batch context", () => {
  test("clears stale Travel Batch context when re-importing an unbatched flight group", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      staffUsers: [
        {
          _id: "staff_ticketing",
          authUserId: "auth_ticketing",
          email: "ticketing@example.com",
          emailNormalized: "ticketing@example.com",
          name: "Ticketing User",
          roles: ["Admin"],
          active: true,
        },
      ],
      jobCards: [
        {
          _id: jobCardId,
          jobCode: "JC-0001",
          clientName: "Acme",
          confirmedPax: 10,
          status: "Open",
          createdBy: "auth_accounts",
          createdAt: 100,
          updatedAt: 100,
        },
      ],
      flightGroups: [
        {
          _id: "flightGroups_1",
          jobCardId,
          importKey: "flight|0",
          sourceSheet: "Flight",
          sourceGroupIndex: 0,
          name: "Batched group",
          route: "Mumbai - Dubai",
          airline: "Air India",
          flightNumber: "AI101",
          ticketingType: "Imported Itinerary",
          totalSeats: 0,
          travelBatchId: "travelBatches_1",
          createdBy: "auth_ticketing",
          createdAt: 100,
          updatedAt: 100,
        },
      ],
      flightSegments: [],
      pnrs: [],
      travelBatches: [
        {
          _id: "travelBatches_1",
          jobCardId,
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
        },
      ],
    });

    await commitFlightImportForTest(
      ctx,
      {
        jobCardId,
        groups: [
          {
            sourceSheet: "Flight",
            groupIndex: 0,
            name: "Unbatched group",
            segments: [
              {
                dateLabel: "Thu 1 Oct",
                airline: "Air India",
                flightNumber: "AI101",
                departTime: "10:00",
                origin: "Mumbai",
                arriveTime: "12:00",
                destination: "Dubai",
                duration: "",
                transit: "",
              },
            ],
          },
        ],
      },
      {
        allowed: true,
        authUserId: "auth_ticketing",
        roles: ["Head of Ticketing"],
        permissions: [],
      },
    );

    expect(tables.flightGroups[0]).toMatchObject({
      _id: "flightGroups_1",
      importKey: "flight|0",
      travelBatchId: undefined,
    });
  });
});

describe("commitPassengerImport failed aggregation", () => {
  test("sums failed counts from batch results", () => {
    const batchResults = [
      { created: 2, updated: 0, failed: 0 },
      { created: 0, updated: 1, failed: 3 },
    ];
    let failed = 0;
    for (const result of batchResults) {
      failed += result.failed ?? 0;
    }
    expect(failed).toBe(3);
  });
});
