import { describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  getConfirmedTripAccessContext,
  grantConfirmedTripEntitlement,
  listAccountHolderOptions,
  listConfirmedTripAccess,
  restoreConfirmedTripEntitlement,
  revokeConfirmedTripEntitlement,
} from "./customerConfirmedTrips";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";

interface Row {
  _id: string;
  [field: string]: RuntimeValue;
}

function makeContext() {
  const tables = {
    activityLogs: [],
    authIdentityLinks: [],
    commandReceipts: [],
    confirmedOffers: [
      {
        _id: "offer_1",
        confirmedPax: 2,
        destination: "Kyoto",
        sellingPricePerPax: 200_000,
        travelEndDate: "2026-11-10",
        travelStartDate: "2026-11-01",
      },
      {
        _id: "offer_2",
        confirmedPax: 1,
        destination: "Private",
        sellingPricePerPax: 100_000,
        travelStartDate: "2027-01-01",
      },
    ],
    customerJourneyEntitlements: [],
    e2eRunActors: [],
    e2eRuns: [],
    queries: [
      {
        _id: "query_1",
        confirmedOfferId: "offer_1",
        createdBy: "staff-auth",
        queryCode: "Q-0001",
        queryType: "MICE",
        salesOwnerId: "staff-auth",
      },
      {
        _id: "query_2",
        confirmedOfferId: "offer_2",
        createdBy: "other-staff",
        queryCode: "Q-PRIVATE",
        queryType: "MICE",
        salesOwnerId: "other-staff",
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
      const id = maybeValue ? fromPartial<string>(idOrValue) : tableOrId;
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const value = maybeValue ?? fromPartial<Row>(idOrValue);
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
          rows.sort((left, right) => {
            const timeOrder = Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0);
            const idOrder = left._id.localeCompare(right._id);
            return direction === "desc" ? -(timeOrder || idOrder) : timeOrder || idOrder;
          });
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
        unique: async () => rows[0] ?? null,
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

function commandId(sequence: number) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

describe("Explicit Customer Journey Entitlement grant", () => {
  test("Lists separate same-email Account Holders without exposing issuer IDs", async () => {
    const { ctx } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(listAccountHolderOptions)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 25 },
      queryId: "query_1",
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

    const matches: Row[] = [];
    const loadPage = async (cursor: string | null): Promise<void> => {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await fromAny<any, unknown>(listAccountHolderOptions)._handler(ctx, {
        paginationOpts: { cursor, numItems: 25 },
        queryId: "query_1",
        search: "older@example.com",
      });
      matches.push(...result.page);
      if (!result.isDone) {
        await loadPage(result.continueCursor || null);
      }
    };
    await loadPage(null);

    expect(matches).toEqual([
      { email: "older@example.com", id: "profile_125", name: "Older Account Holder" },
    ]);
  });

  test("Paginates every access record beyond the first hundred", async () => {
    const { ctx, tables } = makeContext();
    tables.userProfiles = Array.from({ length: 125 }, (_, index) => ({
      _id: `holder_${index}`,
      authUserId: `issuer-a|holder-${index}`,
      createdAt: index,
      email: `holder-${index}@example.com`,
      name: `Holder ${index}`,
    }));
    tables.customerJourneyEntitlements = Array.from({ length: 125 }, (_, index) => ({
      _id: `entitlement_${index}`,
      accountHolderProfileId: `holder_${index}`,
      authUserId: `issuer-a|holder-${index}`,
      capabilities: ["view_confirmed_trip"],
      confirmedOfferId: "offer_1",
      createdAt: index,
      queryId: "query_1",
      role: "organizer",
      source: "identity_migration",
      updatedAt: index,
    }));

    const records: Row[] = [];
    const loadPage = async (cursor: string | null): Promise<void> => {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await fromAny<any, unknown>(listConfirmedTripAccess)._handler(ctx, {
        paginationOpts: { cursor, numItems: 20 },
        queryId: "query_1",
      });
      records.push(...result.page);
      if (!result.isDone) {
        await loadPage(result.continueCursor || null);
      }
    };
    await loadPage(null);

    expect(records).toHaveLength(125);
    expect(new Set(records.map((record) => record.id)).size).toBe(125);
  });

  test("Resolves the selected profile server-side and grants only that confirmed journey", async () => {
    const { ctx, tables } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
      accountHolderProfileId: "profile_2",
      commandId: commandId(1),
      queryId: "query_1",
      role: "organizer",
    });
    expect(result.entitlementId).toBe("customerJourneyEntitlements_1");
    expect(tables.customerJourneyEntitlements[0]).toMatchObject({
      accountHolderProfileId: "profile_2",
      authUserId: "issuer-a|customer-2",
      confirmedOfferId: "offer_1",
      queryId: "query_1",
      role: "organizer",
      source: "crm_operator_grant",
    });
    expect(tables.activityLogs[0]).toMatchObject({
      action: "customer_journey_access_granted",
      entityId: "customerJourneyEntitlements_1",
      entityType: "customerJourneyEntitlement",
    });
  });

  test("Fails closed when Traveller access has no verified Traveller binding", async () => {
    const { ctx, tables } = makeContext();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
        accountHolderProfileId: "profile_2",
        commandId: commandId(2),
        queryId: "query_1",
        role: "traveller",
      })
    ).rejects.toThrow("TRAVELLER_BINDING_REQUIRED");
    expect(tables.customerJourneyEntitlements).toHaveLength(0);

    tables.customerJourneyEntitlements.push({
      _id: "entitlement_unbound_traveller",
      accountHolderProfileId: "profile_2",
      authUserId: "issuer-a|customer-2",
      capabilities: ["view_confirmed_trip"],
      confirmedOfferId: "offer_1",
      createdAt: 1,
      queryId: "query_1",
      revokedAt: 2,
      role: "traveller",
      source: "identity_migration",
      updatedAt: 2,
    });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(restoreConfirmedTripEntitlement)._handler(ctx, {
        commandId: commandId(3),
        entitlementId: "entitlement_unbound_traveller",
        queryId: "query_1",
        reason: "Restore requested without a binding",
      })
    ).rejects.toThrow("TRAVELLER_BINDING_REQUIRED");
    expect(tables.customerJourneyEntitlements[0].revokedAt).toBe(2);
  });

  test("Revokes every active duplicate for one Account holder and journey", async () => {
    const { ctx, tables } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const granted = await fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
      accountHolderProfileId: "profile_1",
      commandId: commandId(9),
      queryId: "query_1",
      role: "organizer",
    });
    tables.customerJourneyEntitlements.push({
      ...tables.customerJourneyEntitlements[0],
      _id: "entitlement_duplicate",
      createdAt: 2,
      updatedAt: 2,
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(revokeConfirmedTripEntitlement)._handler(ctx, {
      commandId: commandId(10),
      entitlementId: granted.entitlementId,
      queryId: "query_1",
      reason: "Duplicate access must fail closed",
    });

    expect(result).toMatchObject({ changed: true, status: "revoked" });
    expect(tables.customerJourneyEntitlements.every((row) => row.revokedAt !== undefined)).toBe(
      true
    );
  });

  test("Lists privacy-safe provenance and requires explicit revoke and restore operations", async () => {
    const { ctx, tables } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const granted = await fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
      accountHolderProfileId: "profile_1",
      commandId: commandId(4),
      queryId: "query_1",
      role: "organizer",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const replayedGrant = await fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
      accountHolderProfileId: "profile_1",
      commandId: commandId(4),
      queryId: "query_1",
      role: "organizer",
    });
    expect(replayedGrant).toEqual(granted);
    expect(tables.commandReceipts).toHaveLength(1);
    expect(
      tables.activityLogs.filter((row) => row.action === "customer_journey_access_granted")
    ).toHaveLength(1);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const before = await fromAny<any, unknown>(listConfirmedTripAccess)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 20 },
      queryId: "query_1",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const context = await fromAny<any, unknown>(getConfirmedTripAccessContext)._handler(ctx, {
      queryId: "query_1",
    });
    expect(context).toEqual({
      destination: "Kyoto",
      queryCode: "Q-0001",
      travelEndDate: "2026-11-10",
      travelStartDate: "2026-11-01",
    });
    expect(before.page[0]).toMatchObject({
      accountHolder: {
        email: "shared@example.com",
        id: "profile_1",
        name: "Asha Organizer",
      },
      grantedBy: "Sales User",
      role: "organizer",
      status: "active",
    });
    expect(JSON.stringify(before)).not.toContain("issuer-a|");

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const revoked = await fromAny<any, unknown>(revokeConfirmedTripEntitlement)._handler(ctx, {
      commandId: commandId(5),
      entitlementId: granted.entitlementId,
      queryId: "query_1",
      reason: "Access granted to the wrong organizer",
    });
    expect(revoked).toMatchObject({ changed: true, status: "revoked" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const replayedRevoke = await fromAny<any, unknown>(revokeConfirmedTripEntitlement)._handler(
      ctx,
      {
        commandId: commandId(5),
        entitlementId: granted.entitlementId,
        queryId: "query_1",
        reason: "Access granted to the wrong organizer",
      }
    );
    expect(replayedRevoke).toMatchObject({ changed: false, status: "revoked" });
    expect(
      tables.activityLogs.filter((row) => row.action === "customer_journey_access_revoked")
    ).toHaveLength(1);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
        accountHolderProfileId: "profile_1",
        commandId: commandId(6),
        queryId: "query_1",
        role: "organizer",
      })
    ).rejects.toThrow("JOURNEY_ENTITLEMENT_RESTORE_REQUIRED");

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const restored = await fromAny<any, unknown>(restoreConfirmedTripEntitlement)._handler(ctx, {
      commandId: commandId(7),
      entitlementId: granted.entitlementId,
      queryId: "query_1",
      reason: "Identity was verified by support",
    });
    expect(restored).toMatchObject({ changed: true, status: "active" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const replayedRestore = await fromAny<any, unknown>(restoreConfirmedTripEntitlement)._handler(
      ctx,
      {
        commandId: commandId(7),
        entitlementId: granted.entitlementId,
        queryId: "query_1",
        reason: "Identity was verified by support",
      }
    );
    expect(replayedRestore).toMatchObject({ changed: false, status: "active" });
    expect(
      tables.activityLogs.filter((row) => row.action === "customer_journey_access_restored")
    ).toHaveLength(1);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const after = await fromAny<any, unknown>(listConfirmedTripAccess)._handler(ctx, {
      paginationOpts: { cursor: null, numItems: 20 },
      queryId: "query_1",
    });
    expect(after.page[0]).toMatchObject({
      lastChange: {
        action: "restored",
        actorName: "Sales User",
        reason: "Identity was verified by support",
      },
      status: "active",
    });
    expect(tables.customerJourneyEntitlements).toHaveLength(1);
  });

  test("Rejects grant and access management outside the Staff member's Query scope", async () => {
    const { ctx } = makeContext();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(grantConfirmedTripEntitlement)._handler(ctx, {
        accountHolderProfileId: "profile_1",
        commandId: commandId(8),
        queryId: "query_2",
        role: "organizer",
      })
    ).rejects.toThrow("Confirmed Query not found");
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(listConfirmedTripAccess)._handler(ctx, {
        paginationOpts: { cursor: null, numItems: 20 },
        queryId: "query_2",
      })
    ).rejects.toThrow("Confirmed Query not found");
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(listAccountHolderOptions)._handler(ctx, {
        paginationOpts: { cursor: null, numItems: 25 },
        queryId: "query_2",
      })
    ).rejects.toThrow("Confirmed Query not found");
  });
});
