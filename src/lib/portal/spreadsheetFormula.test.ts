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
      value: 5,
    });
    expect(evaluateSafeSpreadsheetFormula("='Costs'!A1*2", resolver)).toEqual({
      status: "calculated",
      value: 10,
    });
  });

  test("Keeps scalar references and ranges equivalent for aggregate inputs", () => {
    // Excel reference semantics: COUNT ignores text/booleans/errors; COUNTA counts empty text.
    // https://support.microsoft.com/en-us/excel/functions/count-function
    // https://support.microsoft.com/en-us/excel/functions/counta-function
    const cases: [SpreadsheetScalar, number, number, number | null][] = [
      [null, 0, 0, 7],
      ["", 0, 1, 7],
      ["Citius", 0, 1, 7],
      ["12", 0, 1, 7],
      [true, 0, 1, 7],
      [false, 0, 1, 7],
      [0, 1, 1, 3.5],
      [7, 1, 1, 7],
      [{ error: "#DIV/0!" }, 0, 1, null],
    ];
    for (const [value, count, counta, average] of cases) {
      const resolver = { resolveCell: () => value, resolveRange: () => [value] };
      for (const reference of ["A1", "A1:A1"]) {
        for (const [name, expected] of [
          ["COUNT", count],
          ["COUNTA", counta],
        ] as const) {
          expect(evaluateSafeSpreadsheetFormula(`=${name}(${reference})`, resolver)).toEqual({
            status: "calculated",
            value: expected,
          });
        }
        expect(evaluateSafeSpreadsheetFormula(`=AVERAGE(${reference},7)`, resolver)).toEqual(
          average === null ? { status: "unsupported" } : { status: "calculated", value: average }
        );
      }
    }
  });

  test("Ignores blank and text references without hiding cell errors in numeric aggregates", () => {
    const resolver = { resolveCell: () => null, resolveRange: () => [null, "text", false] };
    for (const formula of ["=SUM(A1:A3)", "=MIN(A1:A3)", "=MAX(A1:A3)", "=A1+7"]) {
      expect(evaluateSafeSpreadsheetFormula(formula, resolver)).toEqual({
        status: "calculated",
        value: formula === "=A1+7" ? 7 : 0,
      });
    }
    expect(evaluateSafeSpreadsheetFormula("=AVERAGE(A1:A3)", resolver)).toEqual({
      status: "unsupported",
    });
    for (const name of ["SUM", "AVERAGE", "MIN", "MAX"]) {
      expect(
        evaluateSafeSpreadsheetFormula(`=${name}(A1:A2)`, {
          resolveCell: () => 7,
          resolveRange: () => [7, { error: "#VALUE!" }],
        })
      ).toEqual({ status: "unsupported" });
    }
  });

  test("Coerces only arithmetic operands and rejects ambiguous ranges or invalid arithmetic", () => {
    const cells = new Map<string, SpreadsheetScalar>([
      ["A1", null],
      ["A2", "7"],
      ["A3", true],
      ["A4", "text"],
      ["A5", { error: "#REF!" }],
    ]);
    const resolver = {
      resolveCell: (reference: string) => cells.get(reference) ?? null,
      resolveRange: () => [null, 7],
    };
    expect(evaluateSafeSpreadsheetFormula("=A1+A2+A3", resolver)).toEqual({
      status: "calculated",
      value: 8,
    });
    for (const formula of [
      "=A4+1",
      "=A5+1",
      "=A1:A2+1",
      "=7/A1",
      "=A4",
      "=1e309",
      "=SUM(1e308*10,7)",
      `=SUM(${"1,".repeat(4096)}1)`,
    ]) {
      expect(evaluateSafeSpreadsheetFormula(formula, resolver)).toEqual({ status: "unsupported" });
    }
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
