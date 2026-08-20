import { describe, expect, test } from "bun:test";
import {
  applyListFilters,
  buildFilterOptions,
  enrichFilterOptions,
  enrichJobCardFilterOptions,
  filterByField,
  filterEmptyMessage,
  hasActiveListFilters,
} from "./listFilters.js";

describe("ListFilters", () => {
  const rows = [
    { id: "1", queryType: "MICE", salesStatus: "Inquiry" },
    { id: "2", queryType: "FIT", salesStatus: "Order Confirmed" },
    { id: "3", queryType: "FIT", salesStatus: "Inquiry" },
  ];

  test("FilterByField returns all rows when value is empty", () => {
    expect(filterByField(rows, "salesStatus", "")).toEqual(rows);
  });

  test("ApplyListFilters AND-composes multiple filters", () => {
    const filtered = applyListFilters(rows, { queryType: "FIT", salesStatus: "Inquiry" }, [
      { field: "salesStatus" },
      { field: "queryType" },
    ]);
    expect(filtered).toEqual([{ id: "3", queryType: "FIT", salesStatus: "Inquiry" }]);
  });

  test("BuildFilterOptions collects unique sorted values", () => {
    expect(buildFilterOptions(rows, "queryType")).toEqual(["FIT", "MICE"]);
  });

  test("HasActiveListFilters detects active dropdown values", () => {
    expect(hasActiveListFilters({}, [{ field: "status" }])).toBe(false);
    expect(hasActiveListFilters({ status: "Open" }, [{ field: "status" }])).toBe(true);
  });

  test("FilterByField matches passport expiry urgency on attached rows", () => {
    const urgencyRows = [
      { _passportExpiryUrgency: "critical", id: "1" },
      { _passportExpiryUrgency: "ok", id: "2" },
    ];
    expect(filterByField(urgencyRows, "passportExpiryUrgency", "critical")).toEqual([
      urgencyRows[0],
    ]);
  });

  test("FilterEmptyMessage switches copy when filters are active", () => {
    expect(filterEmptyMessage({ defaultMessage: "No queries yet.", filtersActive: true })).toBe(
      "No matches — adjust or clear filters."
    );
    expect(filterEmptyMessage({ defaultMessage: "No queries yet.", filtersActive: false })).toBe(
      "No queries yet."
    );
  });

  test("EnrichFilterOptions adds counts for each option", () => {
    const config = [{ field: "queryType" }, { field: "salesStatus" }];
    const options = [
      { label: "All query types", value: "" },
      { label: "MICE", value: "MICE" },
      { label: "FIT", value: "FIT" },
    ];
    const enriched = enrichFilterOptions({
      config,
      field: "queryType",
      filterValues: { salesStatus: "Inquiry" },
      options,
      rows,
    });
    expect(enriched).toEqual([
      { label: "All query types (2)", value: "" },
      { label: "MICE (1)", value: "MICE" },
      { label: "FIT (1)", value: "FIT" },
    ]);
  });

  test("EnrichJobCardFilterOptions counts rows per job card", () => {
    const scopedRows = [
      { id: "1", jobCardId: "jc1", roomType: "Single" },
      { id: "2", jobCardId: "jc1", roomType: "Twin" },
      { id: "3", jobCardId: "jc2", roomType: "Single" },
    ];
    const enriched = enrichJobCardFilterOptions({
      config: [{ field: "roomType" }],
      filterValues: { roomType: "Single" },
      options: [
        { label: "All job cards", value: "" },
        { label: "JC-0001", value: "jc1" },
        { label: "JC-0002", value: "jc2" },
      ],
      rows: scopedRows,
    });
    expect(enriched).toEqual([
      { label: "All job cards (2)", value: "" },
      { label: "JC-0001 (1)", value: "jc1" },
      { label: "JC-0002 (1)", value: "jc2" },
    ]);
  });
});
