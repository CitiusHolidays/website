import { describe, expect, test } from "bun:test";
import { grantConfirmedTripEntitlement, listAccountHolderOptions } from "./customerConfirmedTrips";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";

interface Row {
  _id: string;
  [field: string]: RuntimeValue;
}

function makeContext() {
  const tables = {
    authIdentityLinks: [],
    customerJourneyEntitlements: [],
    queries: [
      {
        _id: "query_1",
        confirmedOfferId: "offer_1",
        createdBy: "staff-auth",
        queryCode: "Q-0001",
        queryType: "MICE",
        salesOwnerId: "staff-auth",
      },
    ],
    staffUsers: [
      {
        _id: "staff_1",
        active: true,
        authUserId: "staff-auth",
        email: "sales@example.com",
        name: "Sales User",
        roles: ["Sales"],
      },
    ],
    userProfiles: [
      {
        _id: "profile_1",
        authUserId: "issuer-a|customer-1",
        createdAt: 2,
        email: "shared@example.com",
        name: "Asha Organizer",
      },
      {
        _id: "profile_2",
        authUserId: "issuer-a|customer-2",
        createdAt: 1,
        email: "shared@example.com",
        name: "Ravi Traveller",
      },
    ],
  } satisfies Record<string, Row[]>;
  let nextId = 1;
  const db = {
    get: (tableOrId: string, maybeId?: string) => {
      const id = maybeId ?? tableOrId;
      return Promise.resolve(
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null
      );
    },
    insert: (table: string, value: RuntimeObject) => {
      const id = `${table}_${nextId}`;
      nextId += 1;
      tables[table].push({ _id: id, ...value });
      return Promise.resolve(id);
    },
    patch: (tableOrId: string, idOrValue: string | RuntimeObject, maybeValue?: Row) => {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const id = maybeValue ? (idOrValue as string) : tableOrId;
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const value = maybeValue ?? (idOrValue as Row);
      const row = Object.values(tables)
        .flat()
        .find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, value);
      }
      return Promise.resolve();
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        first: async () => rows[0] ?? null,
        order: (direction: "asc" | "desc") => {
          rows.sort((left, right) =>
            direction === "desc"
              ? Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0)
              : Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0)
          );
          return builder;
        },
        paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
          const start = cursor ? Number.parseInt(cursor, 10) : 0;
          const page = rows.slice(start, start + numItems);
          const next = start + page.length;
          return {
            continueCursor: next >= rows.length ? "" : String(next),
            isDone: next >= rows.length,
            page,
          };
        },
        take: async (limit: number) => rows.slice(0, limit),
        withIndex: (_index: string, callback: (range: any) => RuntimeValue) => {
          const filters: [string, unknown][] = [];
          const range = {
            eq: (field: string, value: RuntimeValue) => {
              filters.push([field, value]);
              return range;
            },
          };
          callback(range);
          rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
          return builder;
        },
      };
      return builder;
    },
  };
  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({
          email: "sales@example.com",
          subject: "staff-auth",
        }),
      },
      db,
    },
    tables,
  };
}

describe("Explicit Customer Journey Entitlement grant", () => {
  test("Lists separate same-email Account Holders without exposing issuer IDs", async () => {
    const { ctx } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (listAccountHolderOptions as any)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 25 },
      search: "shared@example.com",
    });
    expect(result).toEqual({
      continueCursor: "",
      isDone: true,
      page: [
        { email: "shared@example.com", id: "profile_1", name: "Asha Organizer" },
        { email: "shared@example.com", id: "profile_2", name: "Ravi Traveller" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("issuer-a|");
  });

  test("Continues searching beyond the newest profile page", async () => {
    const { ctx, tables } = makeContext();
    tables.userProfiles = Array.from({ length: 125 }, (_, index) => ({
      _id: `profile_${index + 1}`,
      authUserId: `issuer-a|customer-${index + 1}`,
      createdAt: 125 - index,
      email: index === 124 ? "older@example.com" : `newer-${index}@example.com`,
      name: index === 124 ? "Older Account Holder" : `Newer Account Holder ${index}`,
    }));

    let cursor: string | null = null;
    const matches: Row[] = [];
    let isDone = false;
    while (!isDone) {
      // biome-ignore lint/performance/noAwaitInLoops: each page requires the prior server cursor
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await (listAccountHolderOptions as any)._handler(ctx, {
        paginationOpts: { cursor, numItems: 25 },
        search: "older@example.com",
      });
      matches.push(...result.page);
      cursor = result.continueCursor || null;
      ({ isDone } = result);
    }

    expect(matches).toEqual([
      { email: "older@example.com", id: "profile_125", name: "Older Account Holder" },
    ]);
  });

  test("Resolves the selected profile server-side and grants only that confirmed journey", async () => {
    const { ctx, tables } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (grantConfirmedTripEntitlement as any)._handler(ctx, {
      accountHolderProfileId: "profile_2",
      queryId: "query_1",
      role: "traveller",
    });
    expect(result.entitlementId).toBe("customerJourneyEntitlements_1");
    expect(tables.customerJourneyEntitlements[0]).toMatchObject({
      accountHolderProfileId: "profile_2",
      authUserId: "issuer-a|customer-2",
      confirmedOfferId: "offer_1",
      queryId: "query_1",
      role: "traveller",
      source: "crm_operator_grant",
    });
  });
});
