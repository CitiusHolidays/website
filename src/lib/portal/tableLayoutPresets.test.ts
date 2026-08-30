import { describe, expect, test } from "bun:test";
import {
  createPortalTableLayoutState,
  normalizePortalTableLayoutState,
  PORTAL_TABLE_LAYOUT_KIND,
  portalTableLayoutsEqual,
  splitPortalSavedViews,
} from "./tableLayoutPresets";

describe("portal table layout presets", () => {
  test("serializes only approved presentation state", () => {
    const serialized = createPortalTableLayoutState({
      columns: ["query", "status", "status", "bad column"],
      scope: "queries:list",
      sort: { columnId: "status", direction: "desc" },
    });

    expect(serialized).toEqual({
      columns: ["query", "status"],
      kind: PORTAL_TABLE_LAYOUT_KIND,
      scope: "queries:list",
      sort: { columnId: "status", direction: "desc" },
    });
    expect(Object.keys(serialized).sort()).toEqual(["columns", "kind", "scope", "sort"]);
  });

  test("drops hostile filter, authorization, action, and persistence fields", () => {
    const normalized = normalizePortalTableLayoutState({
      authorization: { role: "Admin" },
      columns: ["status", "../actions", {}, "status"],
      kind: PORTAL_TABLE_LAYOUT_KIND,
      listFilters: { salesStatus: "Order Confirmed" },
      mandatoryActions: false,
      ownerAuthUserId: "attacker",
      scope: "queries:list",
      search: "hidden filter",
      sort: { columnId: "status", direction: "desc", serverOrder: "override" },
    });

    expect(normalized).toEqual({
      columns: ["status"],
      kind: PORTAL_TABLE_LAYOUT_KIND,
      scope: "queries:list",
      sort: { columnId: "status", direction: "desc" },
    });
    expect(Object.keys(normalized ?? {}).sort()).toEqual(["columns", "kind", "scope", "sort"]);
  });

  test("bounds hostile column arrays and rejects non-layout saved views", () => {
    const columns = Array.from({ length: 60 }, (_, index) => `column_${index}`);
    expect(
      normalizePortalTableLayoutState({
        columns,
        kind: PORTAL_TABLE_LAYOUT_KIND,
        scope: "queries:list",
        sort: null,
      })?.columns
    ).toHaveLength(40);
    expect(normalizePortalTableLayoutState({ columns: ["query"], search: "acme" })).toBeNull();
    expect(
      normalizePortalTableLayoutState({
        columns: "query",
        kind: PORTAL_TABLE_LAYOUT_KIND,
        scope: "queries:list",
        sort: null,
      })
    ).toBeNull();
    expect(
      normalizePortalTableLayoutState({
        columns: [],
        kind: PORTAL_TABLE_LAYOUT_KIND,
        scope: "queries:list",
        sort: null,
      })?.columns
    ).toEqual([]);
    expect(
      normalizePortalTableLayoutState({
        columns: ["query"],
        kind: PORTAL_TABLE_LAYOUT_KIND,
        scope: "queries:list",
        sort: { columnId: "query", direction: "sideways" },
      })
    ).toBeNull();
  });

  test("partitions layout presets without reclassifying filter views", () => {
    const layout = {
      filterState: createPortalTableLayoutState({
        columns: ["query"],
        scope: "queries:list",
        sort: null,
      }),
      id: "layout-1",
    };
    const filterView = { filterState: { search: "acme" }, id: "view-1" };
    const malformedLayout = {
      filterState: { columns: "query", kind: PORTAL_TABLE_LAYOUT_KIND },
      id: "layout-stale",
    };

    expect(splitPortalSavedViews([filterView, layout, malformedLayout])).toEqual({
      layoutPresets: [layout, malformedLayout],
      savedViews: [filterView],
    });
  });

  test("compares column sets and exact sort state for truthful current labels", () => {
    expect(
      portalTableLayoutsEqual(
        {
          columns: ["query", "status"],
          scope: "queries:list",
          sort: { columnId: "status", direction: "asc" },
        },
        {
          columns: ["status", "query"],
          scope: "queries:list",
          sort: { columnId: "status", direction: "asc" },
        }
      )
    ).toBe(true);
    expect(
      portalTableLayoutsEqual(
        { columns: ["query"], scope: "queries:list", sort: null },
        {
          columns: ["query"],
          scope: "queries:list",
          sort: { columnId: "query", direction: "asc" },
        }
      )
    ).toBe(false);
    expect(
      portalTableLayoutsEqual(
        { columns: ["query"], scope: "queries:list", sort: null },
        { columns: ["query"], scope: "proposals:list", sort: null }
      )
    ).toBe(false);
  });
});
