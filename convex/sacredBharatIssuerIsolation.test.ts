import { describe, expect, test } from "bun:test";
import type { RuntimeValue } from "./lib/runtimeValues";
import { getMyProgress, listMyGroups } from "./sacredBharat";

interface Row {
  _id: string;
  [field: string]: RuntimeValue;
}

function makeContext(tokenIdentifier: string) {
  const tables = {
    authIdentityLinks: [
      {
        _id: "link_a",
        canonicalAuthUserId: "issuer-a|shared-subject",
        legacyAuthUserId: "shared-subject",
        status: "linked",
      },
    ],
    dataMigrationRegistry: [],
    sacredBharatGroupMembers: [
      {
        _id: "member_legacy",
        authUserId: "shared-subject",
        groupId: "group_1",
        role: "member",
      },
    ],
    sacredBharatGroups: [
      {
        _id: "group_1",
        inviteCode: "PRIVATE",
        isArchived: false,
        name: "Legacy group",
      },
    ],
    sacredBharatVisits: [
      {
        _id: "visit_legacy",
        authUserId: "shared-subject",
        templeId: "kashi-vishwanath",
        visitedAt: 1,
      },
    ],
    sacredBharatWishlist: [
      {
        _id: "wish_legacy",
        authUserId: "shared-subject",
        createdAt: 1,
        itemId: "ramanathaswamy",
        itemType: "temple",
      },
    ],
  } satisfies Record<string, Row[]>;
  return {
    auth: {
      getUserIdentity: async () => ({ subject: "shared-subject", tokenIdentifier }),
    },
    db: {
      get: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        return (
          Object.values(tables)
            .flat()
            .find((row) => row._id === id) ?? null
        );
      },
      query: (table: string) => {
        let rows = [...(tables[table] ?? [])];
        const builder = {
          collect: async () => rows,
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
    },
  };
}

describe("Sacred Bharat issuer ownership isolation", () => {
  test("Allows the explicitly linked issuer to read legacy progress and groups", async () => {
    const ctx = makeContext("issuer-a|shared-subject");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const progress = await (getMyProgress as any)._handler(ctx, {});
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const groups = await (listMyGroups as any)._handler(ctx, {});
    expect(progress.visitedTempleIds).toEqual(["kashi-vishwanath"]);
    expect(progress.wishlist).toHaveLength(1);
    expect(groups).toHaveLength(1);
  });

  test("Denies the same subject under a different issuer", async () => {
    const ctx = makeContext("issuer-b|shared-subject");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const progress = await (getMyProgress as any)._handler(ctx, {});
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const groups = await (listMyGroups as any)._handler(ctx, {});
    expect(progress.visitedTempleIds).toEqual([]);
    expect(progress.wishlist).toEqual([]);
    expect(groups).toEqual([]);
  });
});
