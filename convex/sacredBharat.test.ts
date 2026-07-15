import { describe, expect, test } from "bun:test";
import {
  applyGuestProgressMerge,
  dedupeWishlistItems,
  mergeGuestWishlist,
} from "./lib/sacredBharatGuestMerge";

interface Row {
  _id: string;
  [key: string]: unknown;
}
type Tables = Record<string, Row[]>;

function makeMergeCtx(initialTables: Tables = {}) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;

  const ctx = {
    db: {
      delete: (id: string) => {
        for (const [tableName, rows] of Object.entries(tables)) {
          tables[tableName] = rows.filter((row) => row._id !== id);
        }
      },
      insert: (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
      patch: (id: string, doc: Record<string, unknown>) => {
        for (const [tableName, rows] of Object.entries(tables)) {
          tables[tableName] = rows.map((row) => (row._id === id ? { ...row, ...doc } : row));
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          unique: async () => rows[0] ?? null,
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
            return this;
          },
        };
      },
    },
  };

  return { ctx, tables };
}

describe("dedupeWishlistItems", () => {
  test("removes repeated guest wishlist entries", () => {
    expect(
      dedupeWishlistItems([
        { itemId: "badrinath", itemType: "temple" },
        { itemId: "badrinath", itemType: "temple" },
        { itemId: "shiva-trail", itemType: "trail" },
      ])
    ).toEqual([
      { itemId: "badrinath", itemType: "temple" },
      { itemId: "shiva-trail", itemType: "trail" },
    ]);
  });

  test("canonicalizes temple aliases before deduplicating", () => {
    expect(
      dedupeWishlistItems([
        { itemId: "rameswaram", itemType: "temple" },
        { itemId: "ramanathaswamy", itemType: "temple" },
      ])
    ).toEqual([{ itemId: "ramanathaswamy", itemType: "temple" }]);
  });
});

describe("applyGuestProgressMerge", () => {
  test("merges guest visits and wishlist for the authenticated user", async () => {
    const { ctx, tables } = makeMergeCtx();
    const timestamps = { createdAt: 1_700_000_000_001, visitedAt: 1_700_000_000_000 };

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["kedarnath"],
        wishlist: [{ itemId: "badrinath", itemType: "temple" }],
      },
      timestamps
    );

    expect(tables.sacredBharatVisits).toEqual([
      expect.objectContaining({
        authUserId: "auth_guest",
        templeId: "kedarnath",
        visitedAt: timestamps.visitedAt,
      }),
    ]);
    expect(tables.sacredBharatWishlist).toEqual([
      expect.objectContaining({
        authUserId: "auth_guest",
        createdAt: timestamps.createdAt,
        itemId: "badrinath",
        itemType: "temple",
      }),
    ]);
  });

  test("merges wishlist-only guest drafts with no visited temples", async () => {
    const { ctx, tables } = makeMergeCtx();
    const timestamps = { createdAt: 1_700_000_000_001, visitedAt: 1_700_000_000_000 };

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: [],
        wishlist: [{ itemId: "shiva-trail", itemType: "trail" }],
      },
      timestamps
    );

    expect(tables.sacredBharatVisits ?? []).toEqual([]);
    expect(tables.sacredBharatWishlist).toEqual([
      expect.objectContaining({
        authUserId: "auth_guest",
        createdAt: timestamps.createdAt,
        itemId: "shiva-trail",
        itemType: "trail",
      }),
    ]);
  });

  test("keeps existing visit and wishlist rows instead of duplicating them", async () => {
    const { ctx, tables } = makeMergeCtx({
      sacredBharatVisits: [
        {
          _id: "visit_1",
          authUserId: "auth_guest",
          templeId: "kedarnath",
          visitedAt: 1,
        },
      ],
      sacredBharatWishlist: [
        {
          _id: "wish_1",
          authUserId: "auth_guest",
          createdAt: 2,
          itemId: "badrinath",
          itemType: "temple",
        },
      ],
    });

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["kedarnath"],
        wishlist: [{ itemId: "badrinath", itemType: "temple" }],
      },
      { createdAt: 4, visitedAt: 3 }
    );

    expect(tables.sacredBharatVisits).toHaveLength(1);
    expect(tables.sacredBharatWishlist).toHaveLength(1);
  });

  test("canonicalizes and collapses existing alias rows during replay", async () => {
    const { ctx, tables } = makeMergeCtx({
      sacredBharatVisits: [
        { _id: "visit_1", authUserId: "auth_guest", templeId: "rameswaram", visitedAt: 1 },
        {
          _id: "visit_2",
          authUserId: "auth_guest",
          templeId: "ramanathaswamy",
          visitedAt: 2,
        },
      ],
      sacredBharatWishlist: [
        {
          _id: "wish_1",
          authUserId: "auth_guest",
          createdAt: 1,
          itemId: "varanasi",
          itemType: "temple",
        },
        {
          _id: "wish_2",
          authUserId: "auth_guest",
          createdAt: 2,
          itemId: "kashi-vishwanath",
          itemType: "temple",
        },
      ],
    });

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["rameswaram"],
        wishlist: [{ itemId: "varanasi", itemType: "temple" }],
      },
      { createdAt: 4, visitedAt: 3 }
    );

    expect(tables.sacredBharatVisits).toHaveLength(1);
    expect(tables.sacredBharatVisits[0].templeId).toBe("ramanathaswamy");
    expect(tables.sacredBharatWishlist).toHaveLength(1);
    expect(tables.sacredBharatWishlist[0].itemId).toBe("kashi-vishwanath");
  });

  test("filters invalid temple ids before inserting visits", async () => {
    const { ctx, tables } = makeMergeCtx();

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["not-a-temple"],
        wishlist: [{ itemId: "badrinath", itemType: "temple" }],
      },
      { createdAt: 456, visitedAt: 123 }
    );

    expect(tables.sacredBharatVisits ?? []).toEqual([]);
    expect(tables.sacredBharatWishlist).toHaveLength(1);
  });
});

describe("mergeGuestWishlist", () => {
  test("deduplicates repeated entries before insert", async () => {
    const { ctx, tables } = makeMergeCtx();

    await mergeGuestWishlist(
      ctx as never,
      "auth_guest",
      [
        { itemId: "badrinath", itemType: "temple" },
        { itemId: "badrinath", itemType: "temple" },
      ],
      456
    );

    expect(tables.sacredBharatWishlist).toHaveLength(1);
  });
});
