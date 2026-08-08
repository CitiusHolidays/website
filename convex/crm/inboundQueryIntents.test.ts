import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import {
  convertToQuery,
  getForSales,
  getPendingIntent,
  list,
  submitIntentGateway,
  submitIntentInternal,
} from "./inboundQueryIntents";
import { assertInboundQuerySourceUnchanged } from "./queryCommands";
import { assertMatchesRegisteredReturnContract } from "./validateReturnContract";

type Row = { _id: string; [key: string]: unknown };

const previousGatewaySecret = process.env.INBOUND_INTENT_GATEWAY_SECRET;

afterEach(() => {
  setSystemTime();
  if (previousGatewaySecret === undefined) {
    delete process.env.INBOUND_INTENT_GATEWAY_SECRET;
  } else {
    process.env.INBOUND_INTENT_GATEWAY_SECRET = previousGatewaySecret;
  }
});

test("inbound-linked Query provenance cannot be edited away from its consent source", () => {
  expect(() =>
    assertInboundQuerySourceUnchanged(
      { inboundIntentId: "intent_1", source: "Citius Concierge" } as any,
      "Referral"
    )
  ).toThrow("Inbound Query source is immutable");
  expect(() =>
    assertInboundQuerySourceUnchanged(
      { inboundIntentId: "intent_1", source: "Citius Concierge" } as any,
      "Citius Concierge"
    )
  ).not.toThrow();
});

function makeContext(
  initial: Record<string, Row[]> = {},
  identity: Record<string, unknown> | null = {
    email: "sales@example.com",
    name: "Sales Rep",
    subject: "auth_sales",
  }
) {
  const tables = Object.fromEntries(
    Object.entries(initial).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))])
  ) as Record<string, Row[]>;

  const db = {
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((row) => row._id === id);
        if (found) {
          return found;
        }
      }
      return null;
    },
    insert: async (table: string, document: Record<string, unknown>) => {
      const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
      tables[table] ||= [];
      tables[table].push({ _id: id, ...document });
      return id;
    },
    normalizeId: (table: string, id: string) =>
      (tables[table] ?? []).some((row) => row._id === id) ? id : null,
    patch: async (id: string, patch: Record<string, unknown>) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((entry) => entry._id === id);
        if (row) {
          Object.assign(row, patch);
          return;
        }
      }
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        collect: async () => rows,
        filter: (predicate: (q: any) => boolean) => {
          rows = rows.filter((row) => predicate(expression(row)));
          return builder;
        },
        first: async () => rows[0] ?? null,
        order: (direction: "asc" | "desc") => {
          rows.sort((left, right) => {
            const leftTime = Number(left.createdAt ?? left._creationTime ?? 0);
            const rightTime = Number(right.createdAt ?? right._creationTime ?? 0);
            return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
          });
          return builder;
        },
        paginate: async (opts: { numItems?: number }) => ({
          continueCursor: "",
          isDone: true,
          page: rows.slice(0, opts.numItems ?? 50),
        }),
        take: async (limit: number) => rows.slice(0, limit),
        unique: async () => rows[0] ?? null,
        withIndex: (_index: string, callback?: (q: any) => unknown) => {
          if (callback) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const queryBuilder = {
              eq: (field: string, value: unknown) => {
                filters.push({ field, value });
                return queryBuilder;
              },
              gte: (field: string, value: unknown) => {
                filters.push({ field: `gte:${field}`, value });
                return queryBuilder;
              },
              lte: (field: string, value: unknown) => {
                filters.push({ field: `lte:${field}`, value });
                return queryBuilder;
              },
            };
            callback(queryBuilder);
            rows = rows.filter((row) =>
              filters.every((filter) =>
                filter.field.startsWith("gte:")
                  ? Number(row[filter.field.slice(4)]) >= Number(filter.value)
                  : filter.field.startsWith("lte:")
                    ? Number(row[filter.field.slice(4)]) <= Number(filter.value)
                    : row[filter.field] === filter.value
              )
            );
          }
          return builder;
        },
        withSearchIndex: (_index: string, callback: (q: any) => unknown) => {
          const searchFilters: Array<{ field: string; value: unknown }> = [];
          const queryBuilder = {
            eq: (field: string, value: unknown) => {
              searchFilters.push({ field, value });
              return queryBuilder;
            },
            search: (_field: string, value: string) => {
              rows = rows.filter((row) => String(row.listSearchText ?? "").includes(value));
              return queryBuilder;
            },
          };
          callback(queryBuilder);
          rows = rows.filter((row) =>
            searchFilters.every((filter) => row[filter.field] === filter.value)
          );
          return builder;
        },
      };
      return builder;
    },
  };

  const ctx = {
    auth: { getUserIdentity: async () => identity },
    db,
    runMutation: async (_reference: unknown, args: Record<string, unknown>) =>
      await (submitIntentInternal as any)._handler(ctx, args),
    scheduler: { runAfter: async () => undefined },
  };

  return { ctx, tables };
}

function expression(row: Row) {
  return {
    and: (...values: boolean[]) => values.every(Boolean),
    eq: (left: unknown, right: unknown) => resolve(left, row) === resolve(right, row),
    field: (name: string) => ({ field: name }),
    gte: (left: unknown, right: unknown) => Number(resolve(left, row)) >= Number(right),
    lte: (left: unknown, right: unknown) => Number(resolve(left, row)) <= Number(right),
  };
}

function resolve(value: unknown, row: Row) {
  return typeof value === "object" && value !== null && "field" in value
    ? row[String((value as { field: string }).field)]
    : value;
}

const salesStaff = {
  _id: "staff_sales",
  active: true,
  authUserId: "auth_sales",
  email: "sales@example.com",
  name: "Sales Rep",
  roles: ["Sales"],
};

function inboundRow(overrides: Record<string, unknown> = {}) {
  return {
    _creationTime: 1,
    _id: "inboundQueryIntents_1",
    clientName: "A Traveller",
    consentAt: 1,
    createdAt: 1,
    source: "Citius Concierge",
    status: "pending",
    submissionKeyHash: "a".repeat(64),
    ...overrides,
  } as Row;
}

describe("protected inbound intent Convex boundaries", () => {
  test("rejects direct gateway calls without the server secret", async () => {
    process.env.INBOUND_INTENT_GATEWAY_SECRET = "expected-secret";
    const { ctx, tables } = makeContext({ inboundIntentRateLimits: [], inboundQueryIntents: [] });

    await expect(
      (submitIntentGateway as any)._handler(ctx, {
        clientName: "A Traveller",
        consent: true,
        gatewaySecret: "wrong-secret",
        rateLimitKeyHash: "b".repeat(64),
        source: "Citius Concierge",
        submissionKeyHash: "c".repeat(64),
      })
    ).rejects.toThrow("FORBIDDEN");
    expect(tables.inboundQueryIntents).toEqual([]);
    expect(tables.notifications).toBeUndefined();
  });

  test("creates once, returns duplicate on replay, then throttles new keys", async () => {
    process.env.INBOUND_INTENT_GATEWAY_SECRET = "expected-secret";
    const { ctx, tables } = makeContext({
      crmHandoffEvents: [],
      inboundIntentRateLimits: [],
      inboundQueryIntents: [],
      notifications: [],
      staffUsers: [salesStaff],
    });
    const base = {
      clientName: "A Traveller",
      consent: true,
      gatewaySecret: "expected-secret",
      rateLimitKeyHash: "d".repeat(64),
      source: "Citius Concierge",
    };

    const first = await (submitIntentGateway as any)._handler(ctx, {
      ...base,
      submissionKeyHash: "1".repeat(64),
    });
    const replay = await (submitIntentGateway as any)._handler(ctx, {
      ...base,
      submissionKeyHash: "1".repeat(64),
    });
    expect(first.status).toBe("created");
    expect(replay.status).toBe("duplicate");
    expect(tables.inboundQueryIntents).toHaveLength(1);
    expect(tables.notifications).toHaveLength(2);

    for (let index = 2; index <= 5; index += 1) {
      const result = await (submitIntentGateway as any)._handler(ctx, {
        ...base,
        submissionKeyHash: String(index).repeat(64),
      });
      expect(result.status).toBe("created");
    }
    const throttled = await (submitIntentGateway as any)._handler(ctx, {
      ...base,
      submissionKeyHash: "6".repeat(64),
    });
    expect(throttled).toEqual({ intentId: null, status: "throttled" });
    expect(tables.inboundQueryIntents).toHaveLength(5);
  });

  test("deduplicates retries for twenty-four hours but accepts a later submission", async () => {
    const now = Date.parse("2026-08-05T12:00:00.000Z");
    setSystemTime(new Date(now));
    process.env.INBOUND_INTENT_GATEWAY_SECRET = "expected-secret";
    const submissionKeyHash = "e".repeat(64);
    const { ctx, tables } = makeContext({
      crmHandoffEvents: [],
      inboundIntentRateLimits: [],
      inboundQueryIntents: [
        inboundRow({
          createdAt: now - 24 * 60 * 60 * 1000 - 1,
          submissionKeyHash,
        }),
      ],
      notifications: [],
      staffUsers: [salesStaff],
    });

    const result = await (submitIntentGateway as any)._handler(ctx, {
      clientName: "A Traveller",
      consent: true,
      gatewaySecret: "expected-secret",
      rateLimitKeyHash: "f".repeat(64),
      source: "Citius Concierge",
      submissionKeyHash,
    });

    expect(result.status).toBe("created");
    expect(tables.inboundQueryIntents).toHaveLength(2);
  });

  test("lists and opens intents only for Sales, and conversion rejects replayed intents", async () => {
    const { ctx } = makeContext({
      inboundQueryIntents: [
        inboundRow(),
        inboundRow({ _id: "inboundQueryIntents_2", clientName: "Converted", status: "converted" }),
      ],
      staffUsers: [salesStaff],
    });
    const page = await (list as any)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 50 },
    });
    assertMatchesRegisteredReturnContract(list, page);
    expect(page.page).toHaveLength(1);
    expect(page.page[0].clientName).toBe("A Traveller");
    expect(page.page[0]).not.toHaveProperty("listSearchText");
    expect(page.page[0]).not.toHaveProperty("submissionKeyHash");

    const opened = await (getForSales as any)._handler(ctx, { intentId: "inboundQueryIntents_1" });
    assertMatchesRegisteredReturnContract(getForSales, opened);
    expect(opened.clientName).toBe("A Traveller");

    const pending = await (getPendingIntent as any)._handler(ctx, {
      intentId: "inboundQueryIntents_1",
    });
    assertMatchesRegisteredReturnContract(getPendingIntent, pending);

    const convertedCtx = makeContext(
      {
        inboundQueryIntents: [inboundRow({ status: "converted" })],
        staffUsers: [salesStaff],
      },
      {
        email: "sales@example.com",
        name: "Sales Rep",
        subject: "auth_sales",
      }
    );
    await expect(
      (convertToQuery as any)._handler(convertedCtx.ctx, {
        intentId: "inboundQueryIntents_1",
        paxCount: 2,
        queryType: "FIT",
        travelType: "International Travel",
      })
    ).rejects.toThrow("already been triaged");
  });

  test("unauthenticated and non-Sales staff cannot read the index", async () => {
    const unauthenticated = makeContext({ inboundQueryIntents: [] }, null);
    await expect(
      (list as any)._handler(unauthenticated.ctx, {
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).rejects.toThrow("FORBIDDEN");

    const operations = makeContext(
      { inboundQueryIntents: [], staffUsers: [{ ...salesStaff, roles: ["Operations"] }] },
      { email: "ops@example.com", name: "Ops", subject: "auth_ops" }
    );
    await expect(
      (list as any)._handler(operations.ctx, {
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("matches the approved inbound lead role matrix", async () => {
    for (const role of ["Sales", "Sales Head", "Admin", "Directors", "Director Cement"]) {
      const allowed = makeContext({
        inboundQueryIntents: [inboundRow()],
        staffUsers: [{ ...salesStaff, roles: [role] }],
      });
      await expect(
        (list as any)._handler(allowed.ctx, {
          paginationOpts: { cursor: null, numItems: 50 },
        })
      ).resolves.toBeDefined();
    }

    for (const role of ["Sales Cement", "Operations", "Ticketing"]) {
      const denied = makeContext({
        inboundQueryIntents: [inboundRow()],
        staffUsers: [{ ...salesStaff, roles: [role] }],
      });
      await expect(
        (list as any)._handler(denied.ctx, {
          paginationOpts: { cursor: null, numItems: 50 },
        })
      ).rejects.toThrow("FORBIDDEN");
    }
  });

  test("keeps long source notes on the lead without copying them into Query Notes", async () => {
    const sourceNotes = Array.from({ length: 31 }, (_, index) => `source${index + 1}`).join(" ");
    const { ctx, tables } = makeContext({
      activities: [],
      clients: [],
      crmHandoffEvents: [
        {
          _id: "crmHandoffEvents_1",
          createdAt: 1,
          inboundIntentId: "inboundQueryIntents_1",
          source: "Citius Concierge",
        },
      ],
      inboundQueryIntents: [
        inboundRow({ contactEmail: "traveller@example.com", notes: sourceNotes }),
      ],
      notifications: [],
      queries: [],
      staffUsers: [salesStaff],
    });

    await expect(
      (convertToQuery as any)._handler(ctx, {
        intentId: "inboundQueryIntents_1",
        notes: undefined,
        paxCount: 2,
        queryType: "FIT",
        travelType: "International Travel",
      })
    ).resolves.toMatchObject({ queryCode: "Q-0001" });

    expect(tables.inboundQueryIntents[0].notes).toBe(sourceNotes);
    expect(tables.queries[0].notes).toBe("");
    expect(tables.queries[0]).toMatchObject({
      inboundIntentId: "inboundQueryIntents_1",
      source: "Citius Concierge",
      sourceConsentAt: 1,
    });
    expect(tables.clients[0].email).toBe("traveller@example.com");
  });
});
