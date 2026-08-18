import { describe, expect, test } from "bun:test";
import { buildPassengerImportReportRows, passengerImportReportToCsv } from "./importReconciliation";

describe("BuildPassengerImportReportRows", () => {
  test("Maps preview actions and batch errors to dispositions", () => {
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

  test("Prefers commit rowResults when provided", () => {
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

  test("Merges resumed commit rows onto the full preview without storing replayed source rows", () => {
    const rows = buildPassengerImportReportRows(
      [
        { action: "update", id: "row-1", travellerName: "Ada" },
        { action: "update", id: "row-2", travellerName: "Bob" },
        { action: "create", id: "row-3", travellerName: "Grace" },
      ],
      [],
      [
        {
          disposition: "created",
          fullName: "Grace",
          id: "row-3",
          sourceRowNumber: 4,
        },
      ]
    );

    expect(rows).toEqual([
      {
        disposition: "replayed",
        message: "Completed before this resume",
        rowNumber: 1,
        travellerName: "Ada",
      },
      {
        disposition: "replayed",
        message: "Completed before this resume",
        rowNumber: 2,
        travellerName: "Bob",
      },
      {
        disposition: "created",
        message: "",
        rowNumber: 4,
        travellerName: "Grace",
      },
    ]);
  });
});

describe("PassengerImportReportToCsv", () => {
  test("Escapes quotes in messages", () => {
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

  test("Neutralizes spreadsheet formula prefixes in imported values", () => {
    const csv = passengerImportReportToCsv([
      {
        disposition: "failed",
        message: '=HYPERLINK("https://attacker.test")',
        rowNumber: 2,
        travellerName: " +SUM(1,2)",
      },
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://attacker.test"")"');
    expect(csv).toContain('"\' +SUM(1,2)"');
  });
});
