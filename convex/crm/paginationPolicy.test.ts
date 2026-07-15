import { describe, expect, test } from "bun:test";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  CRM_LIST_MAX_PAGE_SIZE,
  CRM_LIST_MAX_ROWS_READ,
  compactPageItems,
  loadRowsByIdInBatches,
  mapInBoundedBatches,
} from "./paginationPolicy";

describe("CRM list pagination policy", () => {
  test("caps requested page and scan sizes while preserving the cursor", () => {
    expect(
      boundedPaginationOptions({
        cursor: "cursor-50",
        maximumRowsRead: 10_000,
        numItems: 1000,
      })
    ).toMatchObject({
      cursor: "cursor-50",
      maximumRowsRead: CRM_LIST_MAX_ROWS_READ,
      numItems: CRM_LIST_MAX_PAGE_SIZE,
    });
  });

  test("hydrates a scale fixture with a fixed concurrency ceiling", async () => {
    const rows = Array.from({ length: CRM_LIST_MAX_PAGE_SIZE + 37 }, (_, index) => index);
    let active = 0;
    let peak = 0;
    const result = await mapInBoundedBatches(
      rows,
      async (row) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        return `row-${row}`;
      },
      7
    );

    expect(peak).toBeLessThanOrEqual(7);
    expect(result).toHaveLength(rows.length);
    expect(result[0]).toBe("row-0");
    expect(result.at(-1)).toBe(`row-${rows.length - 1}`);
  });

  test("keeps stable source order while removing unauthorized or deleted rows", () => {
    const page = [
      { createdAt: 30, id: "newest" },
      null,
      { createdAt: 20, id: "middle" },
      null,
      { createdAt: 10, id: "oldest" },
    ];
    expect(compactPageItems(page).map((row) => row.id)).toEqual(["newest", "middle", "oldest"]);
  });

  test("applies status and date predicates before the source cursor", () => {
    let expression: unknown;
    const source = {
      filter(predicate: (q: any) => unknown) {
        expression = predicate({
          and: (...values: unknown[]) => ["and", ...values],
          eq: (field: unknown, value: unknown) => ["eq", field, value],
          field: (field: string) => field,
          gte: (field: unknown, value: unknown) => ["gte", field, value],
          lte: (field: unknown, value: unknown) => ["lte", field, value],
        });
        return this;
      },
    };

    expect(
      applyCrmCursorFilters(source, {
        createdAtFrom: 100,
        createdAtTo: 200,
        equals: { queryType: "MICE", status: undefined },
      })
    ).toBe(source);
    expect(expression).toEqual([
      "and",
      ["eq", "queryType", "MICE"],
      ["gte", "createdAt", 100],
      ["lte", "createdAt", 200],
    ]);
  });

  test("hydrates relation ids with bounded direct reads", async () => {
    let active = 0;
    let peak = 0;
    const ctx = {
      db: {
        get: async (selected: string) => {
          active += 1;
          peak = Math.max(peak, active);
          await Promise.resolve();
          active -= 1;
          return { id: selected };
        },
      },
    };

    const rows = await loadRowsByIdInBatches<any>(
      ctx,
      Array.from({ length: 21 }, (_, index) => `query-${index}`),
      21
    );
    expect(rows).toHaveLength(21);
    expect(peak).toBeLessThanOrEqual(8);
  });
});
