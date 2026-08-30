import { describe, expect, mock, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PORTAL_TABLE_LAYOUT_KIND } from "@/lib/portal/tableLayoutPresets";
import { buildPortalWorkspaceFilters } from "./portalWorkspaceFilters";

describe("Portal workspace layout presets", () => {
  test("stores only presentation state and keeps active server-filter inputs untouched", async () => {
    const createSavedView = mock(async () => ({ id: "layout-new" }));
    const replace = mock(() => undefined);
    const setDateRange = mock(() => undefined);
    const setJobCardFilter = mock(() => undefined);
    const setListFilters = mock(() => undefined);
    const setSearch = mock(() => undefined);
    const filters = buildPortalWorkspaceFilters({
      allowed: true,
      createSavedView,
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
      jobCardFilter: "job-1",
      listFilterConfig: [{ field: "salesStatus" }],
      listFilters: { salesStatus: "Order Confirmed" },
      pathname: "/portal/queries",
      removeSavedView: mock(async () => ({ id: "removed" })),
      router: fromPartial<AppRouterInstance>({ replace }),
      savedViews: [
        {
          filterState: { search: "acme" },
          id: "filter-view",
          name: "Acme",
          pathname: "/portal/queries",
          view: "queries",
        },
        {
          filterState: {
            authorization: { role: "Admin" },
            columns: ["query", "status"],
            kind: PORTAL_TABLE_LAYOUT_KIND,
            listFilters: { salesStatus: "hidden override" },
            scope: "queries:list",
            sort: { columnId: "status", direction: "asc" },
          },
          id: "layout-view",
          name: "Sales focus",
          pathname: "/portal/queries",
          sharedRole: "Sales",
          view: "queries",
        },
      ],
      search: "active search",
      searchParams: new URLSearchParams("q=active+search&f_salesStatus=Order+Confirmed"),
      setDateRange,
      setJobCardFilter,
      setListFilters,
      setSearch,
      showToast: { error: mock(() => undefined), success: mock(() => undefined) },
      updateSavedView: mock(async () => ({ id: "updated" })),
      view: "queries",
    });

    expect(filters.savedViewLinks.map((view) => view.id)).toEqual(["filter-view"]);
    expect(filters.layoutPresets.map((view) => view.id)).toEqual(["layout-view"]);

    await filters.saveCurrentLayout(
      "Finance review",
      {
        columns: ["query", "status", "status", "bad column"],
        scope: "queries:list",
        sort: null,
      },
      { sharedRole: "Finance" }
    );

    expect(createSavedView).toHaveBeenCalledWith({
      filterState: {
        columns: ["query", "status"],
        kind: PORTAL_TABLE_LAYOUT_KIND,
        scope: "queries:list",
        sort: null,
      },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "Finance review",
      pathname: "/portal/queries",
      sharedRole: "Finance",
      view: "queries",
    });
    expect(replace).not.toHaveBeenCalled();
    expect(setDateRange).not.toHaveBeenCalled();
    expect(setJobCardFilter).not.toHaveBeenCalled();
    expect(setListFilters).not.toHaveBeenCalled();
    expect(setSearch).not.toHaveBeenCalled();
  });
});
