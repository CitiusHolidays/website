import { describe, expect, test } from "bun:test";
import {
  applyListFilters,
  buildFilterOptions,
  filterByField,
  filterEmptyMessage,
  hasActiveListFilters,
} from "./listFilters.js";

describe("listFilters", () => {
  const rows = [
    { id: "1", salesStatus: "Inquiry", queryType: "MICE" },
    { id: "2", salesStatus: "Order Confirmed", queryType: "FIT" },
    { id: "3", salesStatus: "Inquiry", queryType: "FIT" },
  ];

  test("filterByField returns all rows when value is empty", () => {
    expect(filterByField(rows, "salesStatus", "")).toEqual(rows);
  });

  test("applyListFilters AND-composes multiple filters", () => {
    const filtered = applyListFilters(
      rows,
      { salesStatus: "Inquiry", queryType: "FIT" },
      [
        { field: "salesStatus" },
        { field: "queryType" },
      ],
    );
    expect(filtered).toEqual([{ id: "3", salesStatus: "Inquiry", queryType: "FIT" }]);
  });

  test("buildFilterOptions collects unique sorted values", () => {
    expect(buildFilterOptions(rows, "queryType")).toEqual(["FIT", "MICE"]);
  });

  test("hasActiveListFilters detects active dropdown values", () => {
    expect(hasActiveListFilters({}, [{ field: "status" }])).toBe(false);
    expect(hasActiveListFilters({ status: "Open" }, [{ field: "status" }])).toBe(true);
  });

  test("filterByField matches passport expiry urgency on attached rows", () => {
    const rows = [
      { id: "1", _passportExpiryUrgency: "critical" },
      { id: "2", _passportExpiryUrgency: "ok" },
    ];
    expect(filterByField(rows, "passportExpiryUrgency", "critical")).toEqual([rows[0]]);
  });

  test("filterEmptyMessage switches copy when filters are active", () => {
    expect(
      filterEmptyMessage({ filtersActive: true, defaultMessage: "No queries yet." }),
    ).toBe("No matches — adjust or clear filters.");
    expect(
      filterEmptyMessage({ filtersActive: false, defaultMessage: "No queries yet." }),
    ).toBe("No queries yet.");
  });
});
