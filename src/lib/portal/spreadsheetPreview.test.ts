import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { prepareSpreadsheetPreview, type SpreadsheetFormulaStatus } from "./spreadsheetPreview";

describe("Spreadsheet preview preparation", () => {
  test.each([false, true])(
    "Uses workbook date serials for formula references (1904: %s)",
    async (date1904) => {
      const workbook = new ExcelJS.Workbook();
      workbook.properties.date1904 = date1904;
      const sheet = workbook.addWorksheet("Dates");
      sheet.getCell("A1").value = new Date("2000-01-01T00:00:00.000Z");
      sheet.getCell("B1").value = { formula: "A1+1", result: 0 };
      const prepared = await prepareSpreadsheetPreview(await workbook.xlsx.writeBuffer());
      const renderedWorkbook = new ExcelJS.Workbook();
      await renderedWorkbook.xlsx.load(prepared.bytes);
      expect(renderedWorkbook.getWorksheet("Dates")?.getCell("B1").result).toBe(
        date1904 ? 35_065 : 36_527
      );
    }
  );

  test("Stores freshly calculated safe results and preserves unsupported cached results", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Costs");
    sheet.getCell("A1").value = 10;
    sheet.getCell("A2").value = 20;
    sheet.getCell("A3").value = 30;
    sheet.getCell("B1").value = { formula: "SUM(A1:A3)", result: 1 };
    sheet.getCell("B2").value = { formula: 'WEBSERVICE("https://example.test")', result: 7 };
    const input = await workbook.xlsx.writeBuffer();

    const prepared = await prepareSpreadsheetPreview(input);
    const renderedWorkbook = new ExcelJS.Workbook();
    await renderedWorkbook.xlsx.load(prepared.bytes);

    expect(prepared.bytes).toBeInstanceOf(ArrayBuffer);
    expect(renderedWorkbook.getWorksheet("Costs")?.getCell("B1").result).toBe(60);
    expect(renderedWorkbook.getWorksheet("Costs")?.getCell("B2").result).toBe(7);
    expect(prepared.recalculatedFormulaCount).toBe(1);
    expect(prepared.unsupportedFormulaCount).toBe(1);
    expect(prepared.formulaStatuses).toEqual([
      { cell: "B1", formula: "SUM(A1:A3)", sheetName: "Costs", status: "recalculated" },
      {
        cell: "B2",
        formula: 'WEBSERVICE("https://example.test")',
        sheetName: "Costs",
        status: "unsupported",
      },
    ]);
  });

  test("Recalculates dependencies in graph order and rejects cycles", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Costs");
    sheet.getCell("A1").value = 1;
    sheet.getCell("B1").value = { formula: "C1+1", result: 0 };
    sheet.getCell("C1").value = { formula: "A1+1", result: 0 };
    sheet.getCell("D1").value = { formula: "E1+1", result: 7 };
    sheet.getCell("E1").value = { formula: "D1+1", result: 8 };
    const input = await workbook.xlsx.writeBuffer();

    const prepared = await prepareSpreadsheetPreview(input);
    const renderedWorkbook = new ExcelJS.Workbook();
    await renderedWorkbook.xlsx.load(prepared.bytes);

    expect(renderedWorkbook.getWorksheet("Costs")?.getCell("B1").result).toBe(3);
    expect(renderedWorkbook.getWorksheet("Costs")?.getCell("C1").result).toBe(2);
    expect(renderedWorkbook.getWorksheet("Costs")?.getCell("D1").result).toBe(7);
    expect(renderedWorkbook.getWorksheet("Costs")?.getCell("E1").result).toBe(8);
    expect(prepared.formulaStatuses).toEqual([
      { cell: "B1", formula: "C1+1", sheetName: "Costs", status: "recalculated" },
      { cell: "C1", formula: "A1+1", sheetName: "Costs", status: "recalculated" },
      { cell: "D1", formula: "E1+1", sheetName: "Costs", status: "unsupported" },
      { cell: "E1", formula: "D1+1", sheetName: "Costs", status: "unsupported" },
    ]);
  });

  test("Preserves reference types and native errors through workbook serialization", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Costs");
    sheet.getCell("A2").value = "text";
    sheet.getCell("A3").value = true;
    sheet.getCell("A4").value = { error: "#DIV/0!" };
    const cases: [string, number | undefined, SpreadsheetFormulaStatus["status"]][] = [
      ["COUNT(A1)", 0, "recalculated"],
      ["COUNT(A2)", 0, "recalculated"],
      ["COUNTA(A1)", 0, "recalculated"],
      ["AVERAGE(A1,7)", 7, "recalculated"],
      ["COUNT(A1:A4)", 0, "recalculated"],
      ["COUNTA(A1:A4)", 3, "recalculated"],
      ["SUM(A4,7)", 99, "unsupported"],
      ["SUM(A1:A10001)", 99, "unsupported"],
      ["AVERAGE(A1)", undefined, "unsupported"],
    ];
    for (const [index, [formula, expected]] of cases.entries()) {
      sheet.getCell(index + 1, 2).value = {
        formula,
        result: expected === undefined ? undefined : 99,
      };
    }
    const prepared = await prepareSpreadsheetPreview(await workbook.xlsx.writeBuffer());
    const renderedWorkbook = new ExcelJS.Workbook();
    await renderedWorkbook.xlsx.load(prepared.bytes);
    for (const [index, [formula, expected, status]] of cases.entries()) {
      expect(renderedWorkbook.getWorksheet("Costs")?.getCell(index + 1, 2).result).toBe(expected);
      expect(prepared.formulaStatuses[index]).toEqual({
        cell: `B${index + 1}`,
        formula,
        sheetName: "Costs",
        status,
      });
    }
  });
});
