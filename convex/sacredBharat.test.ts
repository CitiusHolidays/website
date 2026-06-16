import { describe, expect, test } from "bun:test";
import {
  applyGuestProgressMerge,
  dedupeWishlistItems,
  mergeGuestWishlist,
} from "./lib/sacredBharatGuestMerge";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeMergeCtx(initialTables: Tables = {}) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;

  const ctx = {
    db: {
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
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
              filters.every((filter) => row[filter.field] === filter.value),
            );
            return this;
          },
          unique: async () => rows[0] ?? null,
          collect: async () => [...rows],
        };
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
    },
  };

  return { ctx, tables };
}

describe("dedupeWishlistItems", () => {
  test("removes repeated guest wishlist entries", () => {
    expect(
      dedupeWishlistItems([
        { itemType: "temple", itemId: "badrinath" },
        { itemType: "temple", itemId: "badrinath" },
        { itemType: "trail", itemId: "shiva-trail" },
      ]),
    ).toEqual([
      { itemType: "temple", itemId: "badrinath" },
      { itemType: "trail", itemId: "shiva-trail" },
    ]);
  });
});

describe("applyGuestProgressMerge", () => {
  test("merges guest visits and wishlist for the authenticated user", async () => {
    const { ctx, tables } = makeMergeCtx();
    const timestamps = { visitedAt: 1_700_000_000_000, createdAt: 1_700_000_000_001 };

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["kedarnath"],
        wishlist: [{ itemType: "temple", itemId: "badrinath" }],
      },
      timestamps,
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
        itemType: "temple",
        itemId: "badrinath",
        createdAt: timestamps.createdAt,
      }),
    ]);
  });

  test("merges wishlist-only guest drafts with no visited temples", async () => {
    const { ctx, tables } = makeMergeCtx();
    const timestamps = { visitedAt: 1_700_000_000_000, createdAt: 1_700_000_000_001 };

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: [],
        wishlist: [{ itemType: "trail", itemId: "shiva-trail" }],
      },
      timestamps,
    );

    expect(tables.sacredBharatVisits ?? []).toEqual([]);
    expect(tables.sacredBharatWishlist).toEqual([
      expect.objectContaining({
        authUserId: "auth_guest",
        itemType: "trail",
        itemId: "shiva-trail",
        createdAt: timestamps.createdAt,
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
          itemType: "temple",
          itemId: "badrinath",
          createdAt: 2,
        },
      ],
    });

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["kedarnath"],
        wishlist: [{ itemType: "temple", itemId: "badrinath" }],
      },
      { visitedAt: 3, createdAt: 4 },
    );

    expect(tables.sacredBharatVisits).toHaveLength(1);
    expect(tables.sacredBharatWishlist).toHaveLength(1);
  });

  test("filters invalid temple ids before inserting visits", async () => {
    const { ctx, tables } = makeMergeCtx();

    await applyGuestProgressMerge(
      ctx as never,
      "auth_guest",
      {
        templeIds: ["not-a-temple"],
        wishlist: [{ itemType: "temple", itemId: "badrinath" }],
      },
      { visitedAt: 123, createdAt: 456 },
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
        { itemType: "temple", itemId: "badrinath" },
        { itemType: "temple", itemId: "badrinath" },
      ],
      456,
    );

    expect(tables.sacredBharatWishlist).toHaveLength(1);
  });
});
