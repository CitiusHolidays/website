import { describe, expect, test } from "bun:test";
import { getListFilterConfig } from "./listFilterConfig.js";
import {
  currentFiltersToSavedViewInput,
  normalizeSavedViewState,
  savedViewToUrl,
} from "./savedViews.js";

describe("savedViews", () => {
  const config = getListFilterConfig("queries");

  test("normalizes and strips unknown filters", () => {
    const state = normalizeSavedViewState(
      {
        search: "  acme  ",
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        jobCardFilter: "jc1",
        listFilters: { salesStatus: "Order Confirmed", unknown: "x" },
      },
      config,
    );
    expect(state.search).toBe("acme");
    expect(state.dateRange).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(state.jobCardFilter).toBe("jc1");
    expect(state.listFilters).toEqual({ salesStatus: "Order Confirmed" });
  });

  test("builds a url through the existing serializer", () => {
    const href = savedViewToUrl(
      "/portal/queries",
      {
        filterState: {
          search: "acme",
          dateRange: { from: "2026-01-01", to: "" },
          listFilters: { queryType: "MICE" },
        },
      },
      config,
    );
    expect(href).toBe("/portal/queries?q=acme&from=2026-01-01&f_queryType=MICE");
  });

  test("captures current filters as a saved view input", () => {
    const input = currentFiltersToSavedViewInput({
      view: "queries",
      pathname: "/portal/queries",
      search: "acme",
      dateRange: { from: "", to: "" },
      jobCardFilter: "",
      listFilters: { salesStatus: "Order Confirmed" },
      filterConfig: config,
    });
    expect(input.view).toBe("queries");
    expect(input.pathname).toBe("/portal/queries");
    expect(input.filterState.listFilters).toEqual({ salesStatus: "Order Confirmed" });
  });
});
