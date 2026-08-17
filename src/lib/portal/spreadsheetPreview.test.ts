import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { prepareSpreadsheetPreview } from "./spreadsheetPreview";

describe("spreadsheet preview preparation", () => {
  test("stores freshly calculated safe results and preserves unsupported cached results", async () => {
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
      { cell: "B1", sheetName: "Costs", status: "recalculated" },
      { cell: "B2", sheetName: "Costs", status: "unsupported" },
    ]);
  });

  test("recalculates dependencies in graph order and rejects cycles", async () => {
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
      { cell: "B1", sheetName: "Costs", status: "recalculated" },
      { cell: "C1", sheetName: "Costs", status: "recalculated" },
      { cell: "D1", sheetName: "Costs", status: "unsupported" },
      { cell: "E1", sheetName: "Costs", status: "unsupported" },
    ]);
  });
});
