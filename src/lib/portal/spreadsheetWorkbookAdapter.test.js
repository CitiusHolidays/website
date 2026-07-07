import { describe, expect, test } from "bun:test";
import {
  parseExcelDateCode,
  sanitizeSheetName,
  workbookArrayBufferFromSheets,
  workbookFromSheets,
  workbookRowsFromArrayBuffer,
} from "./workbookAdapter";

describe("workbookAdapter", () => {
  test("parseExcelDateCode matches Excel serial dates and times", () => {
    expect(parseExcelDateCode(43_252)).toMatchObject({ d: 1, H: 0, M: 0, m: 6, S: 0, y: 2018 });
    expect(parseExcelDateCode(43_252.5)).toMatchObject({ d: 1, H: 12, M: 0, m: 6, S: 0, y: 2018 });
    expect(parseExcelDateCode(-1)).toBeNull();
  });

  test("sanitizeSheetName trims invalid characters and enforces 31 characters", () => {
    expect(sanitizeSheetName("bad\\name/with*chars")).toBe("bad name with chars");
    expect(sanitizeSheetName("abcdefghijklmnopqrstuvwxyz1234567890")).toHaveLength(31);
    expect(sanitizeSheetName("   ")).toBe("Sheet1");
  });

  test("workbookRowsFromArrayBuffer preserves Date cells and skips blank rows", async () => {
    const birthDate = new Date(1967, 5, 12);
    const sheets = workbookFromSheets({
      Passengers: [["Name", "Date of Birth"], [], [" ", ""], ["PRADIP SEN", birthDate]],
    });
    const buffer = await workbookArrayBufferFromSheets(sheets.Sheets);
    const parsed = await workbookRowsFromArrayBuffer(buffer);

    expect(parsed.SheetNames).toEqual(["Passengers"]);
    expect(parsed.Sheets.Passengers).toHaveLength(2);
    expect(parsed.Sheets.Passengers[0]).toEqual(["Name", "Date of Birth"]);
    expect(parsed.Sheets.Passengers[1][0]).toBe("PRADIP SEN");
    expect(parsed.Sheets.Passengers[1][1]).toBeInstanceOf(Date);
    expect(parsed.Sheets.Passengers[1][1].getFullYear()).toBe(1967);
  });

  test("export round-trips sheet data through array buffer", async () => {
    const sheets = workbookFromSheets({
      "JC-0001-NS": [
        ["NO", "Name"],
        [1, "PRADIP SEN"],
      ],
    });
    const buffer = await workbookArrayBufferFromSheets(sheets.Sheets);
    const parsed = await workbookRowsFromArrayBuffer(buffer);
    expect(parsed.Sheets["JC-0001-NS"]).toEqual([
      ["NO", "Name"],
      [1, "PRADIP SEN"],
    ]);
  });
});
