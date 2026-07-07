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
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        jobCardFilter: "jc1",
        listFilters: { salesStatus: "Order Confirmed", unknown: "x" },
        search: "  acme  ",
      },
      config
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
          dateRange: { from: "2026-01-01", to: "" },
          listFilters: { queryType: "MICE" },
          search: "acme",
        },
      },
      config
    );
    expect(href).toBe("/portal/queries?q=acme&from=2026-01-01&f_queryType=MICE");
  });

  test("captures current filters as a saved view input", () => {
    const input = currentFiltersToSavedViewInput({
      dateRange: { from: "", to: "" },
      filterConfig: config,
      jobCardFilter: "",
      listFilters: { salesStatus: "Order Confirmed" },
      pathname: "/portal/queries",
      search: "acme",
      view: "queries",
    });
    expect(input.view).toBe("queries");
    expect(input.pathname).toBe("/portal/queries");
    expect(input.filterState.listFilters).toEqual({ salesStatus: "Order Confirmed" });
  });
});
