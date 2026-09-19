import { describe, expect, test } from "bun:test";
import type { FindMatch, XlsxMatchLocation, XlsxSelectionInput } from "@silurus/ooxml/xlsx";
import { spreadsheetSearch } from "./spreadsheetSearch";

function viewerHarness() {
  let sheet = 0;
  const selections: string[] = [];
  const viewer = {
    clearFind: () => undefined,
    findText: async (_query: string): Promise<FindMatch<XlsxMatchLocation>[]> => [],
    goToSheet: (index: number) => {
      sheet = index;
      return Promise.resolve();
    },
    scrollToCell: (_cell: string) => Promise.resolve(),
    setSelection: (cell: XlsxSelectionInput) => selections.push(`${sheet}!${cell}`),
    sheetNames: ["Costs", "Summary"],
  };
  return { selections, viewer };
}

describe("Spreadsheet document search", () => {
  test("Finds displayed values and supported or unsupported formula text in the open workbook", async () => {
    const { selections, viewer } = viewerHarness();
    viewer.findText = async () => [
      {
        location: { col: 1, ref: "A1", row: 1, sheet: 0, sheetName: "Costs" },
        matchIndex: 0,
        text: "SUM",
      },
    ];
    const search = spreadsheetSearch(viewer, [
      { cell: "A1", formula: "SUM(B1:B2)", sheetName: "Costs", status: "recalculated" },
      { cell: "C2", formula: "SUMIF(A1:A2,1)", sheetName: "Summary", status: "unsupported" },
    ]);
    expect(await search.find("sUm")).toEqual({ current: 1, total: 2 });
    expect(selections).toEqual(["0!A1"]);
    expect(await search.findNext()).toEqual({ current: 2, total: 2 });
    expect(selections.at(-1)).toBe("1!C2");
    expect(await search.findNext()).toEqual({ current: 1, total: 2 });
    expect(await search.findPrevious()).toEqual({ current: 2, total: 2 });
    search.clearSearch();
    expect(await search.findNext()).toEqual({ current: 0, total: 0 });
  });

  test("Searches exact formula text when no displayed value matches", async () => {
    const { selections, viewer } = viewerHarness();
    const search = spreadsheetSearch(viewer, [
      {
        cell: "B3",
        formula: "AVERAGE(A1:A2)",
        sheetName: "Summary",
        status: "recalculated",
      },
    ]);
    expect(await search.find("=AVERAGE(")).toEqual({ current: 1, total: 1 });
    expect(selections).toEqual(["1!B3"]);
    expect(await search.find("unrelated")).toEqual({ current: 0, total: 0 });
    expect(await search.find(" ")).toEqual({ current: 0, total: 0 });
  });

  test("Discards pending results when search is cleared or the document is closed", async () => {
    const { selections, viewer } = viewerHarness();
    const pending = Promise.withResolvers<Awaited<ReturnType<typeof viewer.findText>>>();
    viewer.findText = () => pending.promise;
    const search = spreadsheetSearch(viewer, [
      {
        cell: "B3",
        formula: "SUM(A1:A2)",
        sheetName: "Costs",
        status: "recalculated",
      },
    ]);
    const result = search.find("sum");
    search.clearSearch();
    pending.resolve([]);
    expect(await result).toEqual({ current: 0, total: 0 });
    expect(selections).toEqual([]);
  });
});
