import { describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { QueryCtx } from "../_generated/server";
import type { RuntimeValue } from "../lib/runtimeValues";
import { PERMISSIONS, type PortalAccess } from "./lib";
import {
  loadCreatedAtSnapshotRows,
  loadDashboardCapacitySnapshot,
  loadDashboardSummarySnapshot,
  loadReportsSnapshot,
} from "./operationalSnapshots";

function portalAccess(permissions: string[], roles: string[] = ["Directors"]): PortalAccess {
  return {
    allowed: true,
    authUserId: "auth_1",
    email: "director@example.com",
    name: "Director",
    permissions,
    roles,
    // SAFETY: This test controls the asserted value at the framework boundary below.
    staffId: fromPartial<PortalAccess["staffId"]>("staff_1"),
  };
}

function makeCtx(
  tables: Record<string, unknown[]> = {},
  pagination: Record<string, { isDone: boolean; page: unknown[] }> = {}
) {
  const indexCalls: Array<{ indexName: string; table: string }> = [];
  const paginateCalls: Array<{
    cursor: string | null;
    maximumRowsRead?: number;
    numItems: number;
    table: string;
  }> = [];
  const queryCalls: string[] = [];
  const rangeCalls: Array<{ field: string; operation: "gte" | "lte"; value: number }> = [];
  const takeCalls: Array<{ limit: number; table: string }> = [];

  const builder = (table: string, rows = tables[table] ?? []) => {
    const queryExpression = {
      eq(_field: string, _value: RuntimeValue) {
        return true;
      },
      field(field: string) {
        return field;
      },
      gte(field: string, value: number) {
        rangeCalls.push({ field, operation: "gte", value });
        return queryExpression;
      },
      lte(field: string, value: number) {
        rangeCalls.push({ field, operation: "lte", value });
        return queryExpression;
      },
      or(..._expressions: unknown[]) {
        return true;
      },
    };

    return {
      filter: (callback: (q: typeof queryExpression) => RuntimeValue) => {
        callback(queryExpression);
        return builder(table, rows);
      },
      order: (_direction: "asc" | "desc") => builder(table, rows),
      paginate: (options: {
        cursor: string | null;
        maximumRowsRead?: number;
        numItems: number;
      }) => {
        paginateCalls.push({ ...options, table });
        const configured = pagination[table];
        return {
          continueCursor: "",
          isDone: configured?.isDone ?? rows.length <= options.numItems,
          page: configured?.page ?? rows.slice(0, options.numItems),
        };
      },
      take: (limit: number) => {
        takeCalls.push({ limit, table });
        return rows.slice(0, limit);
      },
      withIndex: (indexName: string, callback?: (q: typeof queryExpression) => RuntimeValue) => {
        indexCalls.push({ indexName, table });
        callback?.(queryExpression);
        return builder(table, rows);
      },
    };
  };

  const testCtx = {
    db: {
      query: (table: string) => {
        queryCalls.push(table);
        return builder(table);
      },
    },
  };
  // SAFETY: this fake implements the bounded query methods the snapshot readers exercise.
  const ctx = fromPartial<typeof testCtx & QueryCtx>(testCtx);

  return { ctx, indexCalls, paginateCalls, queryCalls, rangeCalls, takeCalls };
}

describe("Typed operational snapshots", () => {
  test("Short-circuits capacity reads without team permission", async () => {
    const { ctx, queryCalls, takeCalls } = makeCtx();

    const snapshot = await loadDashboardCapacitySnapshot(
      ctx,
      portalAccess([PERMISSIONS.VIEW_QUERIES])
    );

    expect(snapshot).toEqual({ jobCards: [], queries: [], staff: [] });
    expect(queryCalls).toEqual([]);
    expect(takeCalls).toEqual([]);
  });

  test("Loads only permitted capacity collections", async () => {
    const query = {
      _id: "query_1",
      createdAt: 1,
      createdBy: "auth_1",
      queryType: "MICE",
    };
    const staff = { _id: "staff_1", active: true, name: "Director" };
    const { ctx, indexCalls, queryCalls } = makeCtx({ queries: [query], staffUsers: [staff] });

    const snapshot = await loadDashboardCapacitySnapshot(
      ctx,
      portalAccess([PERMISSIONS.VIEW_QUERIES, PERMISSIONS.VIEW_TEAM])
    );

    expect(snapshot.queries).toEqual([query]);
    expect(snapshot.jobCards).toEqual([]);
    expect(snapshot.staff).toEqual([staff]);
    expect(queryCalls).toEqual(["queries", "staffUsers"]);
    expect(indexCalls).toContainEqual({ indexName: "by_createdAt", table: "queries" });
    expect(queryCalls).not.toContain("jobCards");
  });

  test("Avoids relationship reads for non-Cement reports", async () => {
    const { ctx, queryCalls } = makeCtx();

    await loadReportsSnapshot(ctx, portalAccess([PERMISSIONS.VIEW_REPORTS]));

    expect(queryCalls).toEqual(["queries", "invoices", "staffUsers", "offices"]);
    expect(queryCalls).not.toContain("proposalQueryLinks");
    expect(queryCalls).not.toContain("jobCards");
    expect(queryCalls).not.toContain("proposals");
  });

  test("Uses the created-at index and binds both date limits", async () => {
    const { ctx, indexCalls, rangeCalls, takeCalls } = makeCtx({ queries: [] });

    await loadCreatedAtSnapshotRows(ctx, "queries", { from: "2026-08-01", to: "2026-08-12" }, 17);

    expect(indexCalls).toEqual([{ indexName: "by_createdAt", table: "queries" }]);
    expect(rangeCalls.map(({ field, operation }) => ({ field, operation }))).toEqual([
      { field: "createdAt", operation: "gte" },
      { field: "createdAt", operation: "lte" },
    ]);
    expect(takeCalls).toEqual([{ limit: 17, table: "queries" }]);
  });

  test("Bounds the post-index Job Card creation scan and reports an incomplete source", async () => {
    const confirmedQuery = {
      _id: "query_confirmed",
      contractingStatus: "Order Confirmed",
      createdAt: 1,
      createdBy: "auth_1",
      queryType: "MICE",
      salesStatus: "Order Confirmed",
    };
    const { ctx, paginateCalls } = makeCtx(
      { queries: [confirmedQuery] },
      { queries: { isDone: false, page: [confirmedQuery] } }
    );

    const snapshot = await loadDashboardSummarySnapshot(
      ctx,
      portalAccess([PERMISSIONS.MANAGE_JOB_CARDS], ["Accounts"]),
      undefined,
      false
    );

    expect(snapshot.jobCardCreationQueries).toEqual([confirmedQuery]);
    expect(snapshot.urgentSourceComplete.accounts).toBe(false);
    expect(paginateCalls).toEqual([
      {
        cursor: null,
        maximumRowsRead: 400,
        numItems: 240,
        table: "queries",
      },
    ]);
  });
});
