import { describe, expect, test } from "bun:test";
import type { QueryCtx } from "../_generated/server";
import type { RuntimeValue } from "../lib/runtimeValues";
import { PERMISSIONS, type PortalAccess } from "./lib";
import {
  loadCreatedAtSnapshotRows,
  loadDashboardCapacitySnapshot,
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
    staffId: "staff_1" as PortalAccess["staffId"],
  };
}

function makeCtx(tables: Record<string, unknown[]> = {}) {
  const indexCalls: Array<{ indexName: string; table: string }> = [];
  const queryCalls: string[] = [];
  const rangeCalls: Array<{ field: string; operation: "gte" | "lte"; value: number }> = [];
  const takeCalls: Array<{ limit: number; table: string }> = [];

  const builder = (table: string, rows = tables[table] ?? []) => {
    const queryExpression = {
      gte(field: string, value: number) {
        rangeCalls.push({ field, operation: "gte", value });
        return queryExpression;
      },
      lte(field: string, value: number) {
        rangeCalls.push({ field, operation: "lte", value });
        return queryExpression;
      },
    };

    return {
      order: (_direction: "asc" | "desc") => builder(table, rows),
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
  const ctx = testCtx as typeof testCtx & QueryCtx;

  return { ctx, indexCalls, queryCalls, rangeCalls, takeCalls };
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
});
