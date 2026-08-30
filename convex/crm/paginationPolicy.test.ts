import { describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { RuntimeValue } from "../lib/runtimeValues";
import {
  applyCrmCreatedAtIndexRange,
  applyCrmCursorFilters,
  boundedPaginationOptions,
  CRM_LIST_MAX_PAGE_SIZE,
  CRM_LIST_MAX_ROWS_READ,
  type CreatedAtIndexRangeBuilder,
  compactPageItems,
  loadRowsByIdInBatches,
  mapInBoundedBatches,
} from "./paginationPolicy";

describe("CRM list pagination policy", () => {
  test("Binds created-at limits to the storage range in index order", () => {
    const calls: [operation: string, field: string, value: number][] = [];
    const upper = {
      lte(field: "createdAt", value: number) {
        calls.push(["lte", field, value]);
        return this;
      },
    };
    const range = {
      ...upper,
      gte(field: "createdAt", value: number) {
        calls.push(["gte", field, value]);
        return upper;
      },
    };

    // SAFETY: the in-memory builder implements the createdAt methods exercised by this policy.
    const createdAtRange = fromPartial<typeof range & CreatedAtIndexRangeBuilder>(range);
    applyCrmCreatedAtIndexRange(createdAtRange, {
      createdAtFrom: 100,
      createdAtTo: 200,
    });

    expect(calls).toEqual([
      ["gte", "createdAt", 100],
      ["lte", "createdAt", 200],
    ]);
  });

  test("Supports open-ended and empty created-at ranges", () => {
    const calls: string[] = [];
    const range = {
      gte() {
        calls.push("gte");
        return this;
      },
      lte() {
        calls.push("lte");
        return this;
      },
    };

    // SAFETY: the in-memory builder implements the createdAt methods exercised by this policy.
    const createdAtRange = fromPartial<typeof range & CreatedAtIndexRangeBuilder>(range);
    expect(applyCrmCreatedAtIndexRange(createdAtRange, {})).toBe(range);
    applyCrmCreatedAtIndexRange(createdAtRange, {
      createdAtFrom: 100,
    });
    applyCrmCreatedAtIndexRange(createdAtRange, {
      createdAtTo: 200,
    });
    expect(calls).toEqual(["gte", "lte"]);
  });

  test("Caps requested page and scan sizes while preserving the cursor", () => {
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

  test("Hydrates a scale fixture with a fixed concurrency ceiling", async () => {
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

  test("Keeps stable source order while removing unauthorized or deleted rows", () => {
    const page = [
      { createdAt: 30, id: "newest" },
      null,
      { createdAt: 20, id: "middle" },
      null,
      { createdAt: 10, id: "oldest" },
    ];
    expect(compactPageItems(page).map((row) => row.id)).toEqual(["newest", "middle", "oldest"]);
  });

  test("Applies status and date predicates before the source cursor", () => {
    let expression: unknown;
    const source = {
      filter(predicate: (q: any) => RuntimeValue) {
        expression = predicate({
          and: (...values: unknown[]) => ["and", ...values],
          eq: (field: RuntimeValue, value: RuntimeValue) => ["eq", field, value],
          field: (field: string) => field,
          gte: (field: RuntimeValue, value: RuntimeValue) => ["gte", field, value],
          lte: (field: RuntimeValue, value: RuntimeValue) => ["lte", field, value],
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

  test("Preserves false, zero, and empty-string equality predicates", () => {
    const cases = [
      { expected: ["eq", "active", false], field: "active", value: false },
      { expected: ["eq", "attemptCount", 0], field: "attemptCount", value: 0 },
      { expected: ["eq", "department", ""], field: "department", value: "" },
    ] as const;

    for (const testCase of cases) {
      let expression: unknown;
      const source = {
        filter(predicate: (q: any) => RuntimeValue) {
          expression = predicate({
            and: (...values: unknown[]) => ["and", ...values],
            eq: (field: RuntimeValue, value: RuntimeValue) => ["eq", field, value],
            field: (field: string) => field,
            gte: (field: RuntimeValue, value: RuntimeValue) => ["gte", field, value],
            lte: (field: RuntimeValue, value: RuntimeValue) => ["lte", field, value],
          });
          return this;
        },
      };

      expect(
        applyCrmCursorFilters(source, {
          equals: { [testCase.field]: testCase.value },
        })
      ).toBe(source);
      expect(expression).toEqual(testCase.expected);
    }
  });

  test("Applies union predicates before pagination", () => {
    let expression: unknown;
    const source = {
      filter(predicate: (q: any) => RuntimeValue) {
        expression = predicate({
          and: (...values: unknown[]) => ["and", ...values],
          eq: (field: RuntimeValue, value: RuntimeValue) => ["eq", field, value],
          field: (field: string) => field,
          gte: (field: RuntimeValue, value: RuntimeValue) => ["gte", field, value],
          lte: (field: RuntimeValue, value: RuntimeValue) => ["lte", field, value],
          or: (...values: unknown[]) => ["or", ...values],
        });
        return this;
      },
    };

    expect(
      applyCrmCursorFilters(source, {
        oneOf: { status: ["Documents Pending", "Awaiting"] },
      })
    ).toBe(source);
    expect(expression).toEqual([
      "or",
      ["eq", "status", "Documents Pending"],
      ["eq", "status", "Awaiting"],
    ]);
  });

  test("Continues to omit only undefined equality predicates", () => {
    let filtered = false;
    const source = {
      filter() {
        filtered = true;
        return this;
      },
    };

    expect(applyCrmCursorFilters(source, { equals: { active: undefined } })).toBe(source);
    expect(filtered).toBe(false);
  });

  test("Hydrates relation ids with bounded direct reads", async () => {
    let active = 0;
    let peak = 0;
    const ctx = {
      db: {
        get: async (_table: string, selected: string) => {
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
      "queries",
      Array.from({ length: 21 }, (_, index) => `query-${index}`),
      21
    );
    expect(rows).toHaveLength(21);
    expect(peak).toBeLessThanOrEqual(8);
  });
});
