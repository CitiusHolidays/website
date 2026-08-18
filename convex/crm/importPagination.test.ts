import { describe, expect, test } from "bun:test";
import { passengerExportPaginationOptions } from "./importActions";
import { CRM_LIST_MAX_ROWS_READ } from "./paginationPolicy";

describe("Passenger export pagination", () => {
  test("The internal worker owns fixed page and scan bounds for every cursor", () => {
    for (const cursor of [null, "cursor-100"] as const) {
      expect(passengerExportPaginationOptions(cursor)).toEqual({
        cursor,
        maximumRowsRead: CRM_LIST_MAX_ROWS_READ,
        numItems: 100,
      });
    }
  });
});
