import { describe, expect, test } from "bun:test";
import { remove } from "./queries";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;
type QueryRemoveHandler = {
  _handler: (ctx: unknown, args: { queryId: string }) => Promise<unknown>;
};

const removeQuery = remove as never as QueryRemoveHandler;

function makeDeleteCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  ) as Tables;

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        subject: "auth_admin",
        email: "admin@citiusholidays.com",
        name: "Admin User",
      }),
    },
    db: {
      normalizeId(tableName: string, id: string) {
        return (tables[tableName] ?? []).some((row) => row._id === id) ? id : null;
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
          unique: async () => rows[0] ?? null,
        };
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
      delete: async (id: string) => {
        for (const [tableName, rows] of Object.entries(tables)) {
          const nextRows = rows.filter((row) => row._id !== id);
          if (nextRows.length !== rows.length) {
            tables[tableName] = nextRows;
            return;
          }
        }
      },
    },
    runMutation: async () => ({ storageIds: [] }),
    storage: {
      delete: async () => {},
    },
  };

  return { ctx, tables };
}

const adminStaff = {
  _id: "staffUsers_admin",
  authUserId: "auth_admin",
  email: "admin@citiusholidays.com",
  emailNormalized: "admin@citiusholidays.com",
  name: "Admin User",
  roles: ["Admin"],
  active: true,
};

const baseQuery = {
  _id: "queries_1",
  queryCode: "Q-0001",
  clientName: "Acme Travel",
  queryType: "FIT",
  travelType: "Domestic Travel",
  paxCount: 4,
  salesStatus: "Proposal in discussion",
  contractingStatus: "Query Received",
  createdBy: "auth_admin",
  createdAt: 1,
  updatedAt: 1,
};

describe("query deletion", () => {
  test("deletes an unlinked All Sales Query", async () => {
    const { ctx, tables } = makeDeleteCtx({
      staffUsers: [adminStaff],
      queries: [baseQuery],
      proposals: [],
      proposalQueryLinks: [],
      contractingAssignments: [{ _id: "contractingAssignments_1", queryId: "queries_1" }],
      jobCards: [],
      notifications: [{ _id: "notifications_1", entityType: "query", entityId: "queries_1" }],
      activityLogs: [],
    });

    const result = await removeQuery._handler(ctx, {
      queryId: "queries_1",
    });

    expect(result).toEqual({ id: "queries_1" });
    expect(tables.queries).toEqual([]);
    expect(tables.contractingAssignments).toEqual([]);
    expect(tables.notifications).toEqual([]);
    expect(tables.activityLogs[0]).toMatchObject({
      entityType: "query",
      entityId: "queries_1",
      action: "deleted",
      message: "Q-0001 deleted",
    });
  });

  test("keeps linked records intact and explains why a query cannot be deleted", async () => {
    const { ctx, tables } = makeDeleteCtx({
      staffUsers: [adminStaff],
      queries: [baseQuery],
      proposals: [{ _id: "proposals_1", proposalCode: "P-0001", queryId: "queries_1" }],
      proposalQueryLinks: [],
      contractingAssignments: [],
      jobCards: [{ _id: "jobCards_1", jobCode: "JC-0001", queryId: "queries_1" }],
      notifications: [],
      activityLogs: [],
    });

    await expect(removeQuery._handler(ctx, { queryId: "queries_1" })).rejects.toThrow(
      "Cannot delete Q-0001 because it has linked proposals and job cards. Delete or unlink those records first.",
    );

    expect(tables.queries).toHaveLength(1);
    expect(tables.proposals).toHaveLength(1);
    expect(tables.jobCards).toHaveLength(1);
    expect(tables.activityLogs).toEqual([]);
  });
});
