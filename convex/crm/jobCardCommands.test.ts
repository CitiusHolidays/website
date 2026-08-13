import { describe, expect, test } from "bun:test";
import { remove, update } from "./jobCards";
import { assertMatchesRegisteredReturnContract } from "./validateReturnContract";

interface Row {
  _id: string;
  [key: string]: unknown;
}
type Tables = Record<string, Row[]>;

function makeCommandCtx(initialTables: Tables, initialActor = "auth_admin") {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;
  const scheduled: Record<string, unknown>[] = [];
  let actor = initialActor;
  let insertedId = 0;

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: `${actor}@example.com`,
        name: actor,
        subject: actor,
        tokenIdentifier: actor,
      }),
    },
    db: {
      delete: (_table: string, id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
        }
      },
      get: (_table: string, id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: (tableName: string, value: Record<string, unknown>) => {
        insertedId += 1;
        const id = `${tableName}_${insertedId}`;
        tables[tableName] = [...(tables[tableName] ?? []), { _id: id, ...value }];
        return id;
      },
      normalizeId: (_tableName: string, id: string | null | undefined) => id ?? null,
      patch: (_table: string, id: string, value: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.map((row) => (row._id === id ? { ...row, ...value } : row));
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        const query = {
          collect: async () => [...rows],
          first: async () => rows[0] ?? null,
          order(direction: "asc" | "desc") {
            if (direction === "desc") {
              rows = [...rows].reverse();
            }
            return query;
          },
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
            return query;
          },
        };
        return query;
      },
    },
    runMutation: async () => undefined,
    scheduler: {
      runAfter: (_delay: number, _functionReference: unknown, args: Record<string, unknown>) => {
        scheduled.push(args);
      },
    },
  };

  return {
    ctx,
    scheduled,
    setActor(nextActor: string) {
      actor = nextActor;
    },
    tables,
  };
}

function adminStaff(actor: string): Row {
  return {
    _id: `staffUsers_${actor}`,
    active: true,
    authUserId: actor,
    email: `${actor}@example.com`,
    name: actor,
    roles: ["Admin"],
  };
}

describe("Job Card command replay contracts", () => {
  test("update returns only its registered id contract and a deleted Job Card stays not found", async () => {
    const { ctx, tables } = makeCommandCtx({
      activityLogs: [],
      jobCardDeletionOperations: [
        {
          _id: "jobCardDeletionOperations_old",
          initiatedBy: "auth_admin",
          jobCardId: "jobCards_deleted",
          status: "complete",
        },
      ],
      jobCards: [
        {
          _id: "jobCards_existing",
          clientName: "Original client",
          confirmedPax: 10,
          createdBy: "auth_admin",
          destination: "Goa",
          jobCode: "JC-0001-AA",
          status: "Open",
        },
      ],
      staffUsers: [adminStaff("auth_admin")],
    });

    const result = await (update as any)._handler(ctx, {
      clientName: "Updated client",
      jobCardId: "jobCards_existing",
    });

    expect(result).toEqual({ id: "jobCards_existing" });
    assertMatchesRegisteredReturnContract(update as never, result);
    expect(tables.jobCards[0]?.clientName).toBe("Updated client");

    await expect(
      (update as any)._handler(ctx, { clientName: "Stale edit", jobCardId: "jobCards_deleted" })
    ).rejects.toThrow("Job Card not found");
  });

  test("remove reattaches only its initiating actor without starting another deletion graph", async () => {
    const { ctx, scheduled, setActor, tables } = makeCommandCtx({
      activityLogs: [],
      jobCardDeletionOperations: [],
      jobCards: [
        {
          _id: "jobCards_1",
          clientName: "Acme Group",
          confirmedPax: 10,
          createdBy: "auth_admin",
          destination: "Dubai",
          jobCode: "JC-0002-AA",
          status: "Open",
        },
      ],
      notificationReads: [],
      notifications: [],
      staffUsers: [adminStaff("auth_admin"), adminStaff("auth_other")],
    });

    const initialResult = await (remove as any)._handler(ctx, { jobCardId: "jobCards_1" });
    assertMatchesRegisteredReturnContract(remove as never, initialResult);
    expect(initialResult).toMatchObject({ id: "jobCards_1", status: "running" });
    expect(tables.jobCards).toEqual([]);
    expect(tables.jobCardDeletionOperations).toHaveLength(1);

    const { operationId } = initialResult;
    await ctx.db.patch(operationId, { status: "complete" });
    const scheduledAfterInitialDelete = scheduled.length;

    const replayResult = await (remove as any)._handler(ctx, { jobCardId: "jobCards_1" });
    expect(replayResult).toEqual({ id: "jobCards_1", operationId, status: "complete" });
    assertMatchesRegisteredReturnContract(remove as never, replayResult);
    expect(tables.jobCardDeletionOperations).toHaveLength(1);
    expect(scheduled).toHaveLength(scheduledAfterInitialDelete);

    setActor("auth_other");
    await expect((remove as any)._handler(ctx, { jobCardId: "jobCards_1" })).rejects.toThrow(
      "Job Card not found"
    );
    expect(tables.jobCardDeletionOperations).toHaveLength(1);
    expect(scheduled).toHaveLength(scheduledAfterInitialDelete);
  });
});
