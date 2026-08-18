import { describe, expect, test } from "bun:test";
import { list } from "./navShortcuts";

function makeCtx(tables: Record<string, unknown[]>) {
  const staff = {
    _id: "staff_1",
    active: true,
    authUserId: "auth_1",
    email: "admin@example.com",
    emailNormalized: "admin@example.com",
    name: "Admin User",
    roles: ["Admin"],
  };

  const takeCalls: Array<{ table: string; take: number }> = [];
  const getRows = (table: string) => (table === "staffUsers" ? [staff] : (tables[table] ?? []));

  const withIndex = (table: string, indexName: string) => {
    if (table === "staffUsers" && indexName === "by_authUserId") {
      return {
        take: async (take: number) => getRows(table).slice(0, take),
        unique: async () => getRows(table)[0] ?? null,
      };
    }
    return {
      order: (_direction: string) => ({
        take: (take: number) => {
          takeCalls.push({ table, take });
          return [...getRows(table)]
            .sort(
              (a, b) =>
                // SAFETY: This test controls the asserted value at the framework boundary below.
                Number((b as { createdAt?: number }).createdAt ?? 0) -
                // SAFETY: This test controls the asserted value at the framework boundary below.
                Number((a as { createdAt?: number }).createdAt ?? 0)
            )
            .slice(0, take);
        },
      }),
    };
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: () => ({
          email: "admin@example.com",
          name: "Admin User",
          subject: "auth_1",
        }),
      },
      db: {
        get: async (_table: string, id: string) => {
          for (const rows of Object.values(tables)) {
            // SAFETY: This test controls the asserted value at the framework boundary below.
            const match = rows.find((row) => (row as { _id?: string })._id === id);
            if (match) {
              return match;
            }
          }
          return null;
        },
        query: (table: string) => ({
          collect: async () => getRows(table),
          withIndex: (indexName: string) => withIndex(table, indexName),
        }),
      },
    },
    takeCalls,
  };
}

describe("NavShortcuts list", () => {
  test("Requests bounded newest rows before visibility filtering", async () => {
    const queries = Array.from({ length: 20 }, (_, index) => ({
      _id: `query_${index}`,
      clientName: "Client",
      createdAt: index,
      createdBy: "auth_1",
      queryCode: `Q-${index}`,
    }));

    const { ctx, takeCalls } = makeCtx({
      jobCards: [],
      proposalQueryLinks: [],
      proposals: [],
      queries,
      tickets: [],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await list._handler(ctx as never, {});

    expect(takeCalls).toContainEqual({ table: "queries", take: 36 });
    expect(result.queries).toHaveLength(12);
    expect(result.queries[0]?.id).toBe("query_19");
  });
});
