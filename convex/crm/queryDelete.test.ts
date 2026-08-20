import { describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import { remove } from "./queries";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
type Tables = Record<string, Row[]>;
interface QueryRemoveHandler {
  _handler: (
    ctx: ReturnType<typeof makeDeleteCtx>["ctx"],
    args: { queryId: string }
  ) => Promise<RuntimeValue>;
}

// SAFETY: This test controls the asserted value at the framework boundary below.
const removeQuery = fromPartial<typeof remove & QueryRemoveHandler>(remove);

function makeDeleteCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  );

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "admin@citiusholidays.com",
        name: "Admin User",
        subject: "auth_admin",
      }),
    },
    db: {
      delete: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        for (const [tableName, rows] of Object.entries(tables)) {
          const nextRows = rows.filter((row) => row._id !== id);
          if (nextRows.length !== rows.length) {
            tables[tableName] = nextRows;
            return;
          }
        }
      },
      get: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: (tableName: string, doc: RuntimeObject) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
      normalizeId(tableName: string, id: string) {
        return (tables[tableName] ?? []).some((row) => row._id === id) ? id : null;
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          take: async (count: number) => rows.slice(0, count),
          unique: async () => rows[0] ?? null,
          withIndex(_indexName: string, callback: (q: TestIndexQuery) => TestIndexQuery) {
            const filters: Array<{ field: string; value: RuntimeValue }> = [];
            const q: TestIndexQuery = {
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
    runMutation: async () => ({ storageIds: [] }),
    scheduler: {
      runAfter: async () => undefined,
    },
    storage: {
      delete: () => Promise.resolve(),
    },
  };

  return { ctx, tables };
}

const adminStaff = {
  _id: "staffUsers_admin",
  active: true,
  authUserId: "auth_admin",
  email: "admin@citiusholidays.com",
  emailNormalized: "admin@citiusholidays.com",
  name: "Admin User",
  roles: ["Admin"],
};

const baseQuery = {
  _id: "queries_1",
  clientName: "Acme Travel",
  contractingStatus: "Query Received",
  createdAt: 1,
  createdBy: "auth_admin",
  paxCount: 4,
  queryCode: "Q-0001",
  queryType: "FIT",
  salesStatus: "Proposal in discussion",
  travelType: "Domestic Travel",
  updatedAt: 1,
};

describe("Query deletion", () => {
  test("Deletes an unlinked All Sales Query", async () => {
    const { ctx, tables } = makeDeleteCtx({
      activityLogs: [],
      contractingAssignments: [{ _id: "contractingAssignments_1", queryId: "queries_1" }],
      jobCards: [],
      notifications: [{ _id: "notifications_1", entityId: "queries_1", entityType: "query" }],
      proposalQueryLinks: [],
      proposals: [],
      queries: [baseQuery],
      staffUsers: [adminStaff],
    });

    const result = await removeQuery._handler(ctx, {
      queryId: "queries_1",
    });

    expect(result).toEqual({ id: "queries_1" });
    expect(tables.queries).toEqual([]);
    expect(tables.contractingAssignments).toEqual([]);
    expect(tables.notifications).toEqual([]);
    expect(tables.activityLogs[0]).toMatchObject({
      action: "deleted",
      entityId: "queries_1",
      entityType: "query",
      message: "Q-0001 deleted",
    });
  });

  test("Keeps linked records intact and explains why a query cannot be deleted", async () => {
    const { ctx, tables } = makeDeleteCtx({
      activityLogs: [],
      contractingAssignments: [],
      jobCards: [{ _id: "jobCards_1", jobCode: "JC-0001", queryId: "queries_1" }],
      notifications: [],
      proposalQueryLinks: [],
      proposals: [{ _id: "proposals_1", proposalCode: "P-0001", queryId: "queries_1" }],
      queries: [baseQuery],
      staffUsers: [adminStaff],
    });

    await expect(removeQuery._handler(ctx, { queryId: "queries_1" })).rejects.toThrow(
      "Cannot delete Q-0001 because it has linked proposals and job cards. Delete or unlink those records first."
    );

    expect(tables.queries).toHaveLength(1);
    expect(tables.proposals).toHaveLength(1);
    expect(tables.jobCards).toHaveLength(1);
    expect(tables.activityLogs).toEqual([]);
  });
});
