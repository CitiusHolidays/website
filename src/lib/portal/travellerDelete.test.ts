import { describe, expect, test } from "bun:test";
import { deleteNotificationPage } from "../../../convex/crm/notificationCleanup";
import { continueTravellerCleanup, deleteTravellerRecord } from "../../../convex/crm/travellers";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;
  const deletedStorageIds: string[] = [];

  const ctx = {
    db: {
      delete: async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
        }
      },
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
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        tables[tableName] = [...(tables[tableName] ?? []), { _id: id, ...doc }];
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
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          take: async (count: number) => rows.slice(0, count),
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
    scheduler: {
      runAfter: async (
        _delay: number,
        _functionReference: unknown,
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

    await deleteTravellerRecord(ctx as never, access as never, travellerId as never);

    expect(deletedStorageIds).toEqual(["passport_storage_1"]);
    expect(tables.passportDetails).toEqual([]);
    expect(tables.travellers).toEqual([]);
  });
});
