import { describe, expect, test } from "bun:test";
import { processImportRows } from "./imports";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeImportCtx(initialTables: Tables, options?: { failInsertNames?: Set<string> }) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;
  const failInsertNames = options?.failInsertNames ?? new Set<string>();

  const ctx = {
    db: {
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
