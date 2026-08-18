import { describe, expect, test } from "bun:test";
import { buildFlightWorkbook } from "./spreadsheetExports";
import { parseFlightWorkbook } from "./spreadsheetImports";

describe("Flight spreadsheet exports", () => {
  test("Builds a workbook that round-trips through the import parser", () => {
    const workbook = buildFlightWorkbook(
      [
        {
          segments: [
            {
              airline: "Kenya Airlines",
              arriveTime: "06:25",
              dateLabel: "Thu 1 Oct",
              departTime: "02:40",
              destination: "Nairobi",
              duration: "6h 15m",
              flightNumber: "203",
              origin: "Mumbai",
              transit: "-",
            },
            {
              airline: "Kenya Airlines",
              arriveTime: "01:40",
              dateLabel: "Sun 4 Oct",
              departTime: "16:45",
              destination: "Mumbai",
              duration: "6h 25m",
              flightNumber: "202",
              origin: "Nairobi",
              transit: "-",
            },
          ],
          sourceSheet: "BOM",
          travelBatchReference: "JC-0001 / B01",
        },
        {
          segments: [
            {
              airline: "Kenya Airlines",
              arriveTime: "10:30",
              dateLabel: "Thu 1 Oct",
              departTime: "06:45",
              destination: "Nairobi",
              duration: "6h 15m",
              flightNumber: "205",
              origin: "Mumbai",
              transit: "-",
            },
          ],
          sourceSheet: "BOM",
        },
      ],
      { defaultSheetName: "JC-0001-NS" }
    );

    const parsed = parseFlightWorkbook(workbook);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0].travelBatchReference).toBe("JC-0001 / B01");
    expect(parsed.groups[0].segments).toHaveLength(2);
    expect(parsed.groups[0].segments[0]).toMatchObject({
      airline: "Kenya Airlines",
      dateLabel: "Thu 1 Oct",
      destination: "Nairobi",
      flightNumber: "203",
      origin: "Mumbai",
    });
    expect(parsed.errors).toHaveLength(0);
  });
});
