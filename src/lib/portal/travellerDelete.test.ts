import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import { deleteNotificationPage } from "../../../convex/crm/notificationCleanup";
import { continueTravellerCleanup, deleteTravellerRecord } from "../../../convex/crm/travellers";
import type { RuntimeObject, RuntimeValue } from "../../../convex/lib/runtimeValues";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
interface Tables {
  [table: string]: Row[];
}

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  );
  const deletedStorageIds: string[] = [];

  const ctx = {
    db: {
      delete: async (tableName: string, id: string) => {
        tables[tableName] = (tables[tableName] ?? []).filter((row) => row._id !== id);
      },
      get: async (tableName: string, id: string) =>
        (tables[tableName] ?? []).find((entry) => entry._id === id) ?? null,
      insert: async (tableName: string, doc: RuntimeObject) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        tables[tableName] = [...(tables[tableName] ?? []), { _id: id, ...doc }];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: async (tableName: string, id: string, patch: RuntimeObject) => {
        const rows = tables[tableName] ?? [];
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) {
          tables[tableName][index] = { ...rows[index], ...patch };
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          take: async (count: number) => rows.slice(0, count),
          unique: async () => rows[0] ?? null,
          withIndex(
            _indexName: string,
            callback: (query: { eq: (field: string, value: RuntimeValue) => object }) => object
          ) {
            const filters: Array<{ field: string; value: RuntimeValue }> = [];
            const q = {
              eq(field: string, value: RuntimeValue) {
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
    scheduler: {
      runAfter: async (
        _delay: number,
        _functionReference: FunctionReference<
          "query" | "mutation" | "action",
          "public" | "internal"
        >,
        args: {
          entityId?: string;
          entityType?: string;
          identities?: Array<{ entityId: string; entityType: string }>;
          mode?: "all" | "private";
          stage?: string;
          travellerId?: string;
        }
      ) => {
        if (args.travellerId && args.stage && args.mode) {
          // SAFETY: This test controls the asserted value at the framework boundary below.
          await (continueTravellerCleanup as any)._handler(ctx, args);
          return;
        }
        const identities =
          args.identities ??
          (args.entityId && args.entityType
            ? [{ entityId: args.entityId, entityType: args.entityType }]
            : []);
        await Promise.all(
          identities.map((identity) =>
            // SAFETY: This test controls the asserted value at the framework boundary below.
            deleteNotificationPage(ctx as never, identity.entityType, identity.entityId)
          )
        );
      },
    },
    storage: {
      delete: async (storageId: string) => {
        deletedStorageIds.push(storageId);
      },
    },
  };

  return { ctx, deletedStorageIds, tables };
}

describe("deleteTravellerRecord", () => {
  test("deletes passport storage before removing passport details", async () => {
    const travellerId = "traveller_1";
    const jobCardId = "job_1";
    const { ctx, tables, deletedStorageIds } = makeCtx({
      jobCards: [{ _id: jobCardId, createdBy: "user_1", queryId: null }],
      mealPreferences: [],
      notifications: [],
      passportDetails: [
        {
          _id: "passport_1",
          storageId: "passport_storage_1",
          travellerId,
        },
      ],
      roomingListEntries: [],
      seatAllocations: [],
      tickets: [],
      travellers: [{ _id: travellerId, fullName: "Alex Guest", jobCardId }],
      visaRecords: [],
    });

    const access = {
      allowed: true,
      authUserId: "user_1",
      email: "director@example.com",
      name: "Director",
      permissions: ["manage:travellers"],
      roles: ["Directors"],
      staffId: "staff_1",
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await deleteTravellerRecord(ctx as never, access as never, travellerId as never);

    expect(deletedStorageIds).toEqual(["passport_storage_1"]);
    expect(tables.passportDetails).toEqual([]);
    expect(tables.travellers).toEqual([]);
  });
});
