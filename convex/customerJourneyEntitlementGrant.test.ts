import { describe, expect, test } from "bun:test";
import { grantConfirmedTripEntitlement, listAccountHolderOptions } from "./customerConfirmedTrips";

interface Row {
  _id: string;
  [field: string]: unknown;
}

function makeContext() {
  const tables: Record<string, Row[]> = {
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
  };
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
    insert: (table: string, value: Record<string, unknown>) => {
      const id = `${table}_${nextId}`;
      nextId += 1;
      tables[table].push({ _id: id, ...value });
      return Promise.resolve(id);
    },
    patch: (tableOrId: string, idOrValue: string | Record<string, unknown>, maybeValue?: Row) => {
      const id = maybeValue ? (idOrValue as string) : tableOrId;
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
        take: async (limit: number) => rows.slice(0, limit),
        withIndex: (_index: string, callback: (range: any) => unknown) => {
          const filters: [string, unknown][] = [];
          const range = {
            eq: (field: string, value: unknown) => {
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

describe("explicit Customer Journey Entitlement grant", () => {
  test("lists separate same-email Account Holders without exposing issuer IDs", async () => {
    const { ctx } = makeContext();
    const result = await (listAccountHolderOptions as any)._handler(ctx, {
      search: "shared@example.com",
    });
    expect(result).toEqual([
      { email: "shared@example.com", id: "profile_1", name: "Asha Organizer" },
      { email: "shared@example.com", id: "profile_2", name: "Ravi Traveller" },
    ]);
    expect(JSON.stringify(result)).not.toContain("issuer-a|");
  });

  test("resolves the selected profile server-side and grants only that confirmed journey", async () => {
    const { ctx, tables } = makeContext();
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
