import { describe, expect, test } from "bun:test";
import type { SpreadsheetScalar } from "./spreadsheetFormula";
import { evaluateSafeSpreadsheetFormula } from "./spreadsheetFormula";

const CELLS = new Map<string, SpreadsheetScalar>([
  ["A1", 10],
  ["A2", 20],
  ["A3", 30],
  ["B1", "Citius"],
  ["B2", ""],
  ["B3", null],
  ["Costs!A1", 5],
]);

function resolveCell(reference: string) {
  return CELLS.get(reference) ?? null;
}

function resolveRange(start: string, end: string) {
  if (start === "A1" && end === "A3") {
    return [10, 20, 30];
  }
  if (start === "B1" && end === "B3") {
    return ["Citius", "", null];
  }
  return [];
}

describe("Safe spreadsheet formula evaluation", () => {
  test("Recalculates the approved aggregate subset and arithmetic", () => {
    const resolver = { resolveCell, resolveRange };

    expect(evaluateSafeSpreadsheetFormula("=SUM(A1:A3)", resolver)).toEqual({
      status: "calculated",
      value: 60,
    });
    expect(evaluateSafeSpreadsheetFormula("=AVERAGE(A1:A3)", resolver)).toEqual({
      status: "calculated",
      value: 20,
    });
    expect(evaluateSafeSpreadsheetFormula("=MIN(A1:A3)+MAX(A1:A3)/2", resolver)).toEqual({
      status: "calculated",
      value: 25,
    });
    expect(evaluateSafeSpreadsheetFormula("=COUNT(A1:A3)+COUNTA(B1:B3)", resolver)).toEqual({
      status: "calculated",
      value: 4,
    });
    expect(evaluateSafeSpreadsheetFormula("='Costs'!A1*2", resolver)).toEqual({
      status: "calculated",
      value: 10,
    });
  });

  test("Fails closed for external, volatile, user-defined, or malformed formulas", () => {
    const resolver = { resolveCell, resolveRange };
    for (const formula of [
      '=WEBSERVICE("https://example.test")',
      "=NOW()",
      "=[external.xlsx]Costs!A1",
      "=CUSTOM_UDF(A1)",
      "=SUM(A1:A3",
    ]) {
      expect(evaluateSafeSpreadsheetFormula(formula, resolver)).toEqual({
        status: "unsupported",
      });
    }
  });
});
