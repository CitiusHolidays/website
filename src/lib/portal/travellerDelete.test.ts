import { describe, expect, test } from "bun:test";
import { deleteTravellerRecord } from "../../../convex/crm/travellers";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;
  const deletedStorageIds: string[] = [];

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
          collect: async () => [...rows],
        };
      },
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) return row;
        }
        return null;
      },
      delete: async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
        }
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        tables[tableName] = [...(tables[tableName] ?? []), { _id: id, ...doc }];
        return id;
      },
      patch: async () => {},
    },
    storage: {
      delete: async (storageId: string) => {
        deletedStorageIds.push(storageId);
      },
    },
  };

  return { ctx, tables, deletedStorageIds };
}

describe("deleteTravellerRecord", () => {
  test("deletes passport storage before removing passport details", async () => {
    const travellerId = "traveller_1";
    const jobCardId = "job_1";
    const { ctx, tables, deletedStorageIds } = makeCtx({
      travellers: [{ _id: travellerId, jobCardId, fullName: "Alex Guest" }],
      jobCards: [{ _id: jobCardId, queryId: null, createdBy: "user_1" }],
      passportDetails: [
        {
          _id: "passport_1",
          travellerId,
          storageId: "passport_storage_1",
        },
      ],
      visaRecords: [],
      tickets: [],
      seatAllocations: [],
      mealPreferences: [],
      roomingListEntries: [],
      notifications: [],
    });

    const access = {
      authUserId: "user_1",
      roles: ["Directors"],
      name: "Director",
      email: "director@example.com",
      allowed: true,
      permissions: ["manage:travellers"],
      staffId: "staff_1",
    };

    await deleteTravellerRecord(ctx as never, access as never, travellerId as never);

    expect(deletedStorageIds).toEqual(["passport_storage_1"]);
    expect(tables.passportDetails).toEqual([]);
    expect(tables.travellers).toEqual([]);
  });
});
