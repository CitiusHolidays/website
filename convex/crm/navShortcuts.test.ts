import { describe, expect, test } from "bun:test";
import { list } from "./navShortcuts";

function makeCtx(tables: Record<string, unknown[]>) {
  const staff = {
    _id: "staff_1",
    authUserId: "auth_1",
    email: "admin@example.com",
    emailNormalized: "admin@example.com",
    name: "Admin User",
    roles: ["Admin"],
    active: true,
  };

  const takeCalls: Array<{ table: string; take: number }> = [];
  const getRows = (table: string) => (table === "staffUsers" ? [staff] : (tables[table] ?? []));

  const withIndex = (table: string, indexName: string) => {
    if (table === "staffUsers" && indexName === "by_authUserId") {
      return { unique: async () => getRows(table)[0] ?? null };
    }
    return {
      order: (_direction: string) => ({
        take: async (take: number) => {
          takeCalls.push({ table, take });
          return [...getRows(table)]
            .sort(
              (a, b) =>
                Number((b as { createdAt?: number }).createdAt ?? 0) -
                Number((a as { createdAt?: number }).createdAt ?? 0),
            )
            .slice(0, take);
        },
      }),
    };
  };

  return {
    takeCalls,
    ctx: {
      auth: {
        getUserIdentity: async () => ({
          subject: "auth_1",
          email: "admin@example.com",
          name: "Admin User",
        }),
      },
      db: {
        get: async (id: string) => {
          for (const rows of Object.values(tables)) {
            const match = rows.find((row) => (row as { _id?: string })._id === id);
            if (match) return match;
          }
          return null;
        },
        query: (table: string) => ({
          collect: async () => getRows(table),
          withIndex: (indexName: string) => withIndex(table, indexName),
        }),
      },
    },
  };
}

describe("navShortcuts list", () => {
  test("requests bounded newest rows before visibility filtering", async () => {
    const queries = Array.from({ length: 20 }, (_, index) => ({
      _id: `query_${index}`,
      queryCode: `Q-${index}`,
      clientName: "Client",
      createdBy: "auth_1",
      createdAt: index,
    }));

    const { ctx, takeCalls } = makeCtx({
      queries,
      proposals: [],
      proposalQueryLinks: [],
      jobCards: [],
      tickets: [],
    });

    const result = await list._handler(ctx as never, {});

    expect(takeCalls).toContainEqual({ table: "queries", take: 36 });
    expect(result.queries).toHaveLength(12);
    expect(result.queries[0]?.id).toBe("query_19");
  });
});
