import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import {
  convertToQuery,
  dismiss,
  getForSales,
  getPendingIntent,
  list,
  submitIntentGateway,
  submitIntentInternal,
} from "./inboundQueryIntents";
import { getNotificationEmailDetails } from "./notificationEmailDetails";
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
  const indexCalls: Array<{ index: string; table: string }> = [];
  const paginationCalls: Array<{ maximumRowsRead?: number; numItems?: number }> = [];
  const scheduled: Array<{ args: Record<string, unknown>; delay: number }> = [];

  const db = {
    get: (_table: string, id: string) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((row) => row._id === id);
        if (found) {
          return found;
        }
      }
      return null;
    },
    insert: (table: string, document: Record<string, unknown>) => {
      const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
      tables[table] ||= [];
      tables[table].push({ _id: id, ...document });
      return id;
    },
    normalizeId: (table: string, id: string) =>
      (tables[table] ?? []).some((row) => row._id === id) ? id : null,
    patch: (_table: string, id: string, patch: Record<string, unknown>) => {
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
        paginate: async (opts: { maximumRowsRead?: number; numItems?: number }) => {
          paginationCalls.push(opts);
          return {
            continueCursor: "",
            isDone: true,
            page: rows.slice(0, opts.numItems ?? 50),
          };
        },
        take: async (limit: number) => rows.slice(0, limit),
        unique: async () => rows[0] ?? null,
        withIndex: (_index: string, callback?: (q: any) => unknown) => {
          indexCalls.push({ index: _index, table });
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
    scheduler: {
      runAfter: async (delay: number, _reference: unknown, args: Record<string, unknown>) => {
        scheduled.push({ args, delay });
      },
    },
  };

  return { ctx, indexCalls, paginationCalls, scheduled, tables };
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

  test("creates a durable Website lead before scheduling Sales and contact-inbox email", async () => {
    process.env.INBOUND_INTENT_GATEWAY_SECRET = "expected-secret";
    const { ctx, scheduled, tables } = makeContext({
      crmHandoffEvents: [],
      inboundIntentRateLimits: [],
      inboundQueryIntents: [],
      notifications: [],
      notificationTargetCounts: [],
      staffUsers: [salesStaff],
    });
    const result = await (submitIntentGateway as any)._handler(ctx, {
      clientName: "Website Traveller",
      consent: true,
      contactEmail: "traveller@example.com",
      gatewaySecret: "expected-secret",
      notes: "Subject: Kerala\n\nPlease call me.",
      rateLimitKeyHash: "7".repeat(64),
      source: "Website",
      submissionKeyHash: "8".repeat(64),
    });

    expect(result.status).toBe("created");
    expect(tables.inboundQueryIntents[0]).toMatchObject({
      consentAt: expect.any(Number),
      handoffEventId: "crmHandoffEvents_1",
      source: "Website",
      status: "pending",
    });
    expect(tables.crmHandoffEvents[0]).toMatchObject({
      inboundIntentId: "inboundQueryIntents_1",
      source: "Website",
    });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].args.recipients).toEqual(
      expect.arrayContaining(["info@citius.in", "sales@example.com"])
    );

    const emailDetails = await (getNotificationEmailDetails as any)._handler(ctx, {
      entityId: "inboundQueryIntents_1",
      entityType: "inboundQueryIntent",
    });
    expect(emailDetails).toMatchObject({
      rows: expect.arrayContaining([
        { label: "Name", value: "Website Traveller" },
        { label: "Email", value: "traveller@example.com" },
        { label: "Source", value: "Website" },
        { label: "Notes", value: "Subject: Kerala\n\nPlease call me." },
      ]),
      title: "Inbound enquiry details",
    });
  });

  test("creates one consented Sacred Bharat lead with bounded canonical context", async () => {
    process.env.INBOUND_INTENT_GATEWAY_SECRET = "expected-secret";
    const { ctx, scheduled, tables } = makeContext({
      crmHandoffEvents: [],
      inboundIntentRateLimits: [],
      inboundQueryIntents: [],
      notifications: [],
      staffUsers: [salesStaff],
    });
    const sacredArgs = {
      clientName: "Sacred Yatri",
      consent: true,
      contactEmail: "yatri@example.com",
      destination: "Shiva Trail",
      gatewaySecret: "expected-secret",
      rateLimitKeyHash: "9".repeat(64),
      sacredBharatContext: { entryPoint: "trail", trailSlug: "shiva-trail" },
      source: "Sacred Bharat",
      submissionKeyHash: "a".repeat(64),
    };
    const result = await (submitIntentGateway as any)._handler(ctx, sacredArgs);
    const replay = await (submitIntentGateway as any)._handler(ctx, sacredArgs);

    expect(result.status).toBe("created");
    expect(replay.status).toBe("duplicate");
    expect(tables.inboundQueryIntents).toHaveLength(1);
    expect(tables.inboundQueryIntents[0]).toMatchObject({
      consentAt: expect.any(Number),
      sacredBharatContext: { entryPoint: "trail", trailSlug: "shiva-trail" },
      source: "Sacred Bharat",
      status: "pending",
    });
    expect(tables.inboundQueryIntents[0].notes).toBeUndefined();
    expect(tables.crmHandoffEvents).toHaveLength(1);
    expect(tables.notifications).toHaveLength(2);
    expect(scheduled).toHaveLength(1);

    const emailDetails = await (getNotificationEmailDetails as any)._handler(ctx, {
      entityId: "inboundQueryIntents_1",
      entityType: "inboundQueryIntent",
    });
    expect(emailDetails.rows).toEqual(
      expect.arrayContaining([
        { label: "Source", value: "Sacred Bharat" },
        { label: "Sacred planning action", value: "Trail" },
        { label: "Sacred trail", value: "shiva-trail" },
      ])
    );
  });

  test("rejects malformed or missing Sacred Bharat context before writes", async () => {
    process.env.INBOUND_INTENT_GATEWAY_SECRET = "expected-secret";
    const { ctx, tables } = makeContext({
      inboundIntentRateLimits: [],
      inboundQueryIntents: [],
    });
    const base = {
      clientName: "Sacred Yatri",
      consent: true,
      gatewaySecret: "expected-secret",
      rateLimitKeyHash: "b".repeat(64),
      source: "Sacred Bharat",
      submissionKeyHash: "c".repeat(64),
    };

    await expect((submitIntentGateway as any)._handler(ctx, base)).rejects.toThrow(
      "Select one valid Sacred Bharat planning context"
    );
    await expect(
      (submitIntentGateway as any)._handler(ctx, {
        ...base,
        sacredBharatContext: {
          entryPoint: "journey_planner",
          templeId: "kashi-vishwanath",
          trailSlug: "shiva-trail",
        },
      })
    ).rejects.toThrow("Select one valid Sacred Bharat planning context");
    expect(tables.inboundQueryIntents).toEqual([]);
    expect(tables.inboundIntentRateLimits).toEqual([]);
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

  test("bounds list reads at the server and starts from the pending-status index", async () => {
    const { ctx, indexCalls, paginationCalls } = makeContext({
      inboundQueryIntents: [inboundRow()],
      staffUsers: [salesStaff],
    });
    await (list as any)._handler(ctx, {
      paginationOpts: { cursor: null, maximumRowsRead: 50_000, numItems: 5000 },
    });
    expect(indexCalls).toContainEqual({ index: "by_status", table: "inboundQueryIntents" });
    expect(paginationCalls.at(-1)).toMatchObject({ maximumRowsRead: 400, numItems: 100 });
  });

  test("dismisses once with accountable terminal state and replays only the same outcome", async () => {
    const at = Date.parse("2026-08-12T20:00:00.000Z");
    setSystemTime(new Date(at));
    const { ctx, tables } = makeContext({
      inboundQueryIntents: [inboundRow()],
      staffUsers: [salesStaff],
    });

    expect(
      await (dismiss as any)._handler(ctx, {
        dismissalReason: "not_qualified",
        intentId: "inboundQueryIntents_1",
      })
    ).toEqual({
      intentId: "inboundQueryIntents_1",
      replayed: false,
      status: "dismissed",
    });
    expect(tables.inboundQueryIntents[0]).toMatchObject({
      dismissalReason: "not_qualified",
      dismissedAt: at,
      status: "dismissed",
      triagedAt: at,
      triagedByStaffId: "staff_sales",
    });
    expect(
      await (dismiss as any)._handler(ctx, {
        dismissalReason: "not_qualified",
        intentId: "inboundQueryIntents_1",
      })
    ).toMatchObject({ replayed: true });
    await expect(
      (dismiss as any)._handler(ctx, {
        dismissalReason: "duplicate_enquiry",
        intentId: "inboundQueryIntents_1",
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

    const converted = await (convertToQuery as any)._handler(ctx, {
      intentId: "inboundQueryIntents_1",
      notes: undefined,
      paxCount: 2,
      queryType: "FIT",
      travelType: "International Travel",
    });
    expect(converted).toMatchObject({ queryCode: "Q-0001", replayed: false });
    expect(
      await (convertToQuery as any)._handler(ctx, {
        intentId: "inboundQueryIntents_1",
        paxCount: 999,
        queryType: "MICE",
        travelType: "Domestic Travel",
      })
    ).toMatchObject({ queryCode: "Q-0001", replayed: true });
    expect(tables.queries).toHaveLength(1);
    expect(tables.inboundQueryIntents[0]).toMatchObject({
      convertedAt: expect.any(Number),
      triagedAt: expect.any(Number),
      triagedByStaffId: "staff_sales",
    });

    expect(tables.inboundQueryIntents[0].notes).toBe(sourceNotes);
    expect(tables.queries[0].notes).toBe("");
    expect(tables.queries[0]).toMatchObject({
      inboundIntentId: "inboundQueryIntents_1",
      source: "Citius Concierge",
      sourceConsentAt: 1,
    });
    expect(tables.clients[0].email).toBe("traveller@example.com");
  });

  test("preserves Sacred Bharat source and consent when Sales converts the lead", async () => {
    const { ctx, tables } = makeContext({
      activities: [],
      clients: [],
      crmHandoffEvents: [
        {
          _id: "crmHandoffEvents_1",
          createdAt: 1,
          inboundIntentId: "inboundQueryIntents_1",
          source: "Sacred Bharat",
        },
      ],
      inboundQueryIntents: [
        inboundRow({
          consentAt: 123,
          destination: "Shiva Trail",
          sacredBharatContext: { entryPoint: "trail", trailSlug: "shiva-trail" },
          source: "Sacred Bharat",
        }),
      ],
      notifications: [],
      queries: [],
      staffUsers: [salesStaff],
    });

    await (convertToQuery as any)._handler(ctx, {
      intentId: "inboundQueryIntents_1",
      paxCount: 4,
      queryType: "Spiritual",
      travelType: "Domestic Travel",
    });

    expect(tables.queries).toHaveLength(1);
    expect(tables.queries[0]).toMatchObject({
      inboundIntentId: "inboundQueryIntents_1",
      source: "Sacred Bharat",
      sourceConsentAt: 123,
    });
  });
});
