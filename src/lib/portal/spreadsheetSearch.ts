import type { XlsxViewer } from "@silurus/ooxml/xlsx";
import { stepPdfSearchMatch } from "./pdfSearch";
import type { SpreadsheetFormulaStatus } from "./spreadsheetPreview";

type SearchViewer = Pick<
  XlsxViewer,
  "clearFind" | "findText" | "goToSheet" | "scrollToCell" | "setSelection" | "sheetNames"
>;

export function spreadsheetSearch(viewer: SearchViewer, formulas: SpreadsheetFormulaStatus[]) {
  let generation = 0;
  let matches: Array<{ cell: string; sheetName: string }> = [];
  let current = -1;
  const result = () => ({ current: current + 1, total: matches.length });
  const select = async () => {
    const match = matches[current];
    if (match) {
      const activeGeneration = generation;
      await viewer.goToSheet(viewer.sheetNames.indexOf(match.sheetName));
      if (activeGeneration !== generation) {
        return result();
      }
      await viewer.scrollToCell(match.cell);
      if (activeGeneration === generation) {
        viewer.setSelection(match.cell);
      }
    }
    return result();
  };
  const clearSearch = () => {
    generation += 1;
    matches = [];
    current = -1;
    viewer.clearFind();
  };
  return {
    clearSearch,
    find: async (query: string) => {
      clearSearch();
      const activeGeneration = generation;
      const needle = query.trim().toLocaleLowerCase();
      if (!needle) {
        return result();
      }
      const displayedMatches = await viewer.findText(query.trim());
      if (activeGeneration !== generation) {
        return result();
      }
      const cells = new Map<string, { cell: string; sheetName: string }>();
      for (const { location } of displayedMatches) {
        cells.set(`${location.sheetName}!${location.ref}`, {
          cell: location.ref,
          sheetName: location.sheetName,
        });
      }
      for (const entry of formulas) {
        if (`=${entry.formula}`.toLocaleLowerCase().includes(needle)) {
          cells.set(`${entry.sheetName}!${entry.cell}`, entry);
        }
      }
      matches = [...cells.values()];
      current = matches.length > 0 ? 0 : -1;
      return await select();
    },
    findNext: async () => {
      current = stepPdfSearchMatch(current, matches.length, 1);
      return await select();
    },
    findPrevious: async () => {
      current = stepPdfSearchMatch(current, matches.length, -1);
      return await select();
    },
  };
}
