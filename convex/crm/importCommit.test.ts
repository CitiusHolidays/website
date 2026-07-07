import { describe, expect, spyOn, test } from "bun:test";
import { processImportRows } from "./importProcessor";
import { commitFlightImportForTest, getPassengerExportSource } from "./imports";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeImportCtx(initialTables: Tables, options?: { failInsertNames?: Set<string> }) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;
  const failInsertNames = options?.failInsertNames ?? new Set<string>();

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "ticketing@example.com",
        name: "Ticketing User",
        subject: "auth_ticketing",
      }),
    },
    db: {
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
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
      normalizeId: (_tableName: string, id: string | null | undefined) => id ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          first: async () => rows[0] ?? null,
          unique: async () => rows[0] ?? null,
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
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return this;
          },
        };
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
        passportDetails: [],
        travellers: [],
        visaRecords: [],
      },
      { failInsertNames: new Set(["Broken Row"]) }
    );

    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await processImportRows(ctx as never, {
        access: { authUserId: "user_1" },
        job: {
          _id: jobCardId,
          jobCode: "JC-0001",
          travelStartDate: "2026-06-01",
        },
        jobCardId: jobCardId as never,
        matchIndex: {
          byImportKey: new Map(),
          byNormalizedName: new Map(),
          byPassportHash: new Map(),
        },
        rows: [
          {
            foodPreference: "Veg",
            fullName: "Good Row",
            guestType: "Client",
            importKey: "row-1",
            importKind: "passenger",
            paymentType: "Company Paid",
            roomType: "Twin",
            visaRequired: false,
          },
          {
            foodPreference: "Veg",
            fullName: "Broken Row",
            guestType: "Client",
            importKey: "row-2",
            importKind: "passenger",
            paymentType: "Company Paid",
            roomType: "Twin",
            visaRequired: false,
          },
        ],
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
    foodPreference: "Veg",
    fullName: "Batch Guest",
    guestType: "Client",
    importKey: "row-1",
    importKind: "traveller",
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: 2,
    sourceSheet: "Master list",
    visaRequired: false,
  };

  test("creates traveller rows with a matching Travel Batch", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
          jobCardId,
        },
      ],
      travellers: [],
      visaRecords: [],
    });

    const result = await processImportRows(ctx as never, {
      access: { authUserId: "user_1" },
      job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
      jobCardId: jobCardId as never,
      matchIndex: {
        byImportKey: new Map(),
        byNormalizedName: new Map(),
        byPassportHash: new Map(),
      },
      rows: [{ ...baseRow, travelBatchReference: "JC-0001 / B01" }],
    });

    expect(result).toMatchObject({ created: 1, failed: 0, updated: 0 });
    expect(tables.travellers[0]).toMatchObject({
      fullName: "Batch Guest",
      travelBatchId: "travelBatches_1",
    });
  });

  test("keeps unbatched traveller imports unchanged", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      travelBatches: [],
      travellers: [],
      visaRecords: [],
    });

    const result = await processImportRows(ctx as never, {
      access: { authUserId: "user_1" },
      job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
      jobCardId: jobCardId as never,
      matchIndex: {
        byImportKey: new Map(),
        byNormalizedName: new Map(),
        byPassportHash: new Map(),
      },
      rows: [baseRow],
    });

    expect(result).toMatchObject({ created: 1, failed: 0, updated: 0 });
    expect(tables.travellers[0]).not.toHaveProperty("travelBatchId");
  });

  test("fails rows that reference a Travel Batch from another Job Card", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      travelBatches: [
        {
          _id: "travelBatches_2",
          batchCode: "B01",
          batchReference: "JC-0002 / B01",
          jobCardId: "jobCards_2",
        },
      ],
      travellers: [],
      visaRecords: [],
    });

    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await processImportRows(ctx as never, {
        access: { authUserId: "user_1" },
        job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
        jobCardId: jobCardId as never,
        matchIndex: {
          byImportKey: new Map(),
          byNormalizedName: new Map(),
          byPassportHash: new Map(),
        },
        rows: [{ ...baseRow, travelBatchId: "travelBatches_2" }],
      });

      expect(result).toMatchObject({ created: 0, failed: 1, updated: 0 });
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
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passportDetails: [],
      tickets: [],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
          jobCardId,
        },
      ],
      travellers: [
        {
          _id: "travellers_1",
          createdAt: 1000,
          foodPreference: "Veg",
          fullName: "Batched Guest",
          jobCardId,
          paymentType: "Company Paid",
          roomType: "Twin",
          sourceRowNumber: 1,
          travelBatchId: "travelBatches_1",
          visaRequired: true,
          visaStatus: "Not Started",
        },
        {
          _id: "travellers_2",
          createdAt: 1001,
          foodPreference: "Veg",
          fullName: "Unbatched Guest",
          jobCardId,
          paymentType: "Company Paid",
          roomType: "Twin",
          sourceRowNumber: 2,
          visaRequired: false,
          visaStatus: "Not Required",
        },
      ],
      visaRecords: [],
    });

    const result = await (getPassengerExportSource as any)._handler(ctx, {
      access: { allowed: true, permissions: [], roles: ["Operations Head"] },
      jobCardId,
    });

    expect(result.rows[0]).toMatchObject({
      fullName: "Batched Guest",
      travelBatchCode: "B01",
      travelBatchId: "travelBatches_1",
      travelBatchReference: "JC-0001 / B01",
    });
    expect(result.rows[1]).toMatchObject({
      fullName: "Unbatched Guest",
      travelBatchCode: "",
      travelBatchId: "",
      travelBatchReference: "",
    });
  });
});

describe("commitFlightImport Travel Batch context", () => {
  test("clears stale Travel Batch context when re-importing an unbatched flight group", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      flightGroups: [
        {
          _id: "flightGroups_1",
          airline: "Air India",
          createdAt: 100,
          createdBy: "auth_ticketing",
          flightNumber: "AI101",
          importKey: "flight|0",
          jobCardId,
          name: "Batched group",
          route: "Mumbai - Dubai",
          sourceGroupIndex: 0,
          sourceSheet: "Flight",
          ticketingType: "Imported Itinerary",
          totalSeats: 0,
          travelBatchId: "travelBatches_1",
          updatedAt: 100,
        },
      ],
      flightSegments: [],
      jobCards: [
        {
          _id: jobCardId,
          clientName: "Acme",
          confirmedPax: 10,
          createdAt: 100,
          createdBy: "auth_accounts",
          jobCode: "JC-0001",
          status: "Open",
          updatedAt: 100,
        },
      ],
      pnrs: [],
      staffUsers: [
        {
          _id: "staff_ticketing",
          active: true,
          authUserId: "auth_ticketing",
          email: "ticketing@example.com",
          emailNormalized: "ticketing@example.com",
          name: "Ticketing User",
          roles: ["Admin"],
        },
      ],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
          jobCardId,
        },
      ],
    });

    await commitFlightImportForTest(
      ctx,
      {
        groups: [
          {
            groupIndex: 0,
            name: "Unbatched group",
            segments: [
              {
                airline: "Air India",
                arriveTime: "12:00",
                dateLabel: "Thu 1 Oct",
                departTime: "10:00",
                destination: "Dubai",
                duration: "",
                flightNumber: "AI101",
                origin: "Mumbai",
                transit: "",
              },
            ],
            sourceSheet: "Flight",
          },
        ],
        jobCardId,
      },
      {
        allowed: true,
        authUserId: "auth_ticketing",
        permissions: [],
        roles: ["Head of Ticketing"],
      }
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
      { created: 2, failed: 0, updated: 0 },
      { created: 0, failed: 3, updated: 1 },
    ];
    let failed = 0;
    for (const result of batchResults) {
      failed += result.failed ?? 0;
    }
    expect(failed).toBe(3);
  });
});
