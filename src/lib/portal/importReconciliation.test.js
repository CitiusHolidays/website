import { describe, expect, test } from "bun:test";
import {
  buildPassengerImportReportRows,
  passengerImportReportToCsv,
} from "./importReconciliation";

describe("buildPassengerImportReportRows", () => {
  test("maps preview actions and batch errors to dispositions", () => {
    const rows = buildPassengerImportReportRows(
      [
        { action: "create", id: "row-1", travellerName: "Ada" },
        { action: "update", id: "row-2", travellerName: "Bob" },
      ],
      [
        {
          batchId: "b1",
          errors: [{ id: "row-2", message: "Invalid room type", sourceRowNumber: 4 }],
          status: "completed",
        },
      ]
    );

    expect(rows).toEqual([
      {
        disposition: "created",
        message: "",
        rowNumber: 1,
        travellerName: "Ada",
      },
      {
        disposition: "failed",
        message: "Invalid room type",
        rowNumber: 4,
        travellerName: "Bob",
      },
    ]);
  });

  test("prefers commit rowResults when provided", () => {
    const rows = buildPassengerImportReportRows(
      [{ action: "create", id: "row-1", travellerName: "Ada" }],
      [],
      [
        {
          disposition: "created",
          fullName: "Ada Lovelace",
          id: "row-1",
          sourceRowNumber: 3,
        },
      ]
    );

    expect(rows).toEqual([
      {
        disposition: "created",
        message: "",
        rowNumber: 3,
        travellerName: "Ada Lovelace",
      },
    ]);
  });
});

describe("passengerImportReportToCsv", () => {
  test("escapes quotes in messages", () => {
    const csv = passengerImportReportToCsv([
      {
        disposition: "failed",
        message: 'Say "hello"',
        rowNumber: 2,
        travellerName: "Test",
      },
    ]);
    expect(csv).toContain('"Say ""hello"""');
  });
});
