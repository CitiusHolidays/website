import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { RuntimeValue } from "../lib/runtimeValues";
import { buildQueryListSource } from "./queryReads";
import { buildTravellerListSource } from "./travellers";

function makePlannerCtx() {
  const indexCalls: Array<{ indexName: string; table: string }> = [];
  const rangeCalls: Array<{ field: string; operation: string; value: unknown }> = [];
  const searchCalls: Array<{ indexName: string; table: string }> = [];

  const range = {
    eq(field: string, value: RuntimeValue) {
      rangeCalls.push({ field, operation: "eq", value });
      return range;
    },
    gte(field: string, value: RuntimeValue) {
      rangeCalls.push({ field, operation: "gte", value });
      return range;
    },
    lte(field: string, value: RuntimeValue) {
      rangeCalls.push({ field, operation: "lte", value });
      return range;
    },
    search(_field: string, _value: string) {
      return range;
    },
  };
  const query = (table: string) => ({
    order: (_direction: "asc" | "desc") => query(table),
    withIndex: (indexName: string, callback?: (builder: typeof range) => RuntimeValue) => {
      indexCalls.push({ indexName, table });
      callback?.(range);
      return query(table);
    },
    withSearchIndex: (indexName: string, callback: (builder: typeof range) => RuntimeValue) => {
      searchCalls.push({ indexName, table });
      callback(range);
      return query(table);
    },
  });
  const testCtx = { db: { query } };
  // SAFETY: this fake implements the query methods the source planners exercise.
  const ctx = testCtx as typeof testCtx & QueryCtx;
  return { ctx, indexCalls, rangeCalls, searchCalls };
}

describe("CRM list source planners", () => {
  test("Binds Query Type and date to the compound storage range", () => {
    const { ctx, indexCalls, rangeCalls, searchCalls } = makePlannerCtx();

    buildQueryListSource(ctx, {
      createdAtFrom: 100,
      createdAtTo: 200,
      queryType: "MICE",
    });

    expect(indexCalls).toEqual([{ indexName: "by_queryType_createdAt", table: "queries" }]);
    expect(rangeCalls).toEqual([
      { field: "queryType", operation: "eq", value: "MICE" },
      { field: "createdAt", operation: "gte", value: 100 },
      { field: "createdAt", operation: "lte", value: 200 },
    ]);
    expect(searchCalls).toEqual([]);
  });

  test("Uses date-only storage ranges and leaves search relevance ordering intact", () => {
    const datePlan = makePlannerCtx();
    buildQueryListSource(datePlan.ctx, { createdAtFrom: 100 });
    expect(datePlan.indexCalls).toEqual([{ indexName: "by_createdAt", table: "queries" }]);
    expect(datePlan.rangeCalls).toEqual([{ field: "createdAt", operation: "gte", value: 100 }]);

    const searchPlan = makePlannerCtx();
    buildQueryListSource(searchPlan.ctx, { createdAtFrom: 100, queryType: "MICE" }, "delhi");
    expect(searchPlan.indexCalls).toEqual([]);
    expect(searchPlan.searchCalls).toEqual([{ indexName: "search_list", table: "queries" }]);
  });

  test("Binds Traveller Job Card and date before residual filters", () => {
    const { ctx, indexCalls, rangeCalls } = makePlannerCtx();

    buildTravellerListSource(
      ctx,
      { createdAtFrom: 100, createdAtTo: 200 },
      undefined,
      // SAFETY: This test controls the asserted value at the framework boundary below.
      "job_1" as Id<"jobCards">
    );

    expect(indexCalls).toEqual([{ indexName: "by_jobCardId_createdAt", table: "travellers" }]);
    expect(rangeCalls.map(({ field, operation }) => ({ field, operation }))).toEqual([
      { field: "jobCardId", operation: "eq" },
      { field: "createdAt", operation: "gte" },
      { field: "createdAt", operation: "lte" },
    ]);
  });

  test("Cuts a representative 1-in-20 Query Type source range before pagination", () => {
    const rows = Array.from({ length: 400 }, (_, index) => ({
      createdAt: 400 - index,
      queryType: index % 20 === 0 ? "Cement" : "MICE",
    }));
    const indexedCandidates = rows.filter((row) => row.queryType === "Cement");

    expect(indexedCandidates).toHaveLength(20);
    expect(indexedCandidates.length).toBeLessThan(rows.length / 10);
    expect(indexedCandidates.map((row) => row.createdAt)).toEqual(
      [...indexedCandidates]
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((row) => row.createdAt)
    );
  });
});
