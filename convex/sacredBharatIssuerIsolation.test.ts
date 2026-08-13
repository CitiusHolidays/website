import { describe, expect, test } from "bun:test";
import { getMyProgress, listMyGroups } from "./sacredBharat";

interface Row {
  _id: string;
  [field: string]: unknown;
}

function makeContext(tokenIdentifier: string) {
  const tables: Record<string, Row[]> = {
    authIdentityLinks: [
      {
        _id: "link_a",
        canonicalAuthUserId: "issuer-a|shared-subject",
        legacyAuthUserId: "shared-subject",
        status: "linked",
      },
    ],
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
  };
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
    },
  };
}

describe("Sacred Bharat issuer ownership isolation", () => {
  test("allows the explicitly linked issuer to read legacy progress and groups", async () => {
    const ctx = makeContext("issuer-a|shared-subject");
    const progress = await (getMyProgress as any)._handler(ctx, {});
    const groups = await (listMyGroups as any)._handler(ctx, {});
    expect(progress.visitedTempleIds).toEqual(["kashi-vishwanath"]);
    expect(progress.wishlist).toHaveLength(1);
    expect(groups).toHaveLength(1);
  });

  test("denies the same subject under a different issuer", async () => {
    const ctx = makeContext("issuer-b|shared-subject");
    const progress = await (getMyProgress as any)._handler(ctx, {});
    const groups = await (listMyGroups as any)._handler(ctx, {});
    expect(progress.visitedTempleIds).toEqual([]);
    expect(progress.wishlist).toEqual([]);
    expect(groups).toEqual([]);
  });
});
