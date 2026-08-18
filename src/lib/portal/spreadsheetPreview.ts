import ExcelJS from "exceljs";
import {
  isRuntimeBoolean,
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
} from "../runtimeValues";
import { assertSafeOfficeArchive } from "./officeArchiveSafety";
import {
  evaluateSafeSpreadsheetFormula,
  type SpreadsheetFormulaResolver,
  type SpreadsheetScalar,
} from "./spreadsheetFormula";

const CELL_ADDRESS_PATTERN = /^([A-Z]{1,3})(\d+)$/i;
const MAX_PREVIEW_RANGE_CELLS = 10_000;
const OFFICE_ARCHIVE_LIMITS = {
  maxArchiveEntries: 4096,
  maxArchiveEntryBytes: 64 * 1024 * 1024,
  maxTotalInflatedBytes: 192 * 1024 * 1024,
};

export interface SpreadsheetFormulaStatus {
  cell: string;
  sheetName: string;
  status: "recalculated" | "unsupported";
}

export interface PreparedSpreadsheetPreview {
  bytes: ArrayBuffer;
  formulaStatuses: SpreadsheetFormulaStatus[];
  recalculatedFormulaCount: number;
  unsupportedFormulaCount: number;
}

function columnNumber(label: string) {
  let value = 0;
  for (const character of label.toUpperCase()) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value;
}

function splitReference(reference: string, fallbackSheet: string) {
  const separator = reference.lastIndexOf("!");
  const sheetName = separator >= 0 ? reference.slice(0, separator) : fallbackSheet;
  const address = separator >= 0 ? reference.slice(separator + 1) : reference;
  const match = CELL_ADDRESS_PATTERN.exec(address);
  if (!match) {
    throw new Error("Invalid cell reference");
  }
  const column = columnNumber(match[1]);
  const row = Number(match[2]);
  if (column > 16_384 || row < 1 || row > 1_048_576) {
    throw new Error("Cell reference exceeds spreadsheet limits");
  }
  return {
    column,
    row,
    sheetName,
  };
}

function spreadsheetScalar(value: ExcelJS.CellValue): SpreadsheetScalar {
  if (value === null || value === undefined) {
    return null;
  }
  if (isRuntimeNumber(value) || isRuntimeString(value) || isRuntimeBoolean(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (isRuntimeObject(value)) {
    if ("result" in value) {
      // SAFETY: ExcelJS formula results are CellValue values, but its public union exposes result as any.
      return spreadsheetScalar(value.result as ExcelJS.CellValue);
    }
    if ("text" in value && isRuntimeString(value.text)) {
      return value.text;
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (isRuntimeObject(part) && isRuntimeString(part.text) ? part.text : ""))
        .join("");
    }
  }
  return null;
}

function resolverFor(
  workbook: ExcelJS.Workbook,
  activeSheet: ExcelJS.Worksheet,
  resolveFormulaCell: (sheetName: string, row: number, column: number) => SpreadsheetScalar
): SpreadsheetFormulaResolver {
  const worksheetFor = (name: string) => {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) {
      throw new Error("Unknown worksheet");
    }
    return sheet;
  };
  return {
    resolveCell(reference) {
      const resolved = splitReference(reference, activeSheet.name);
      return resolveFormulaCell(resolved.sheetName, resolved.row, resolved.column);
    },
    resolveRange(start, end) {
      const first = splitReference(start, activeSheet.name);
      const last = splitReference(end, first.sheetName);
      if (first.sheetName !== last.sheetName) {
        throw new Error("Ranges cannot span worksheets");
      }
      const top = Math.min(first.row, last.row);
      const bottom = Math.max(first.row, last.row);
      const left = Math.min(first.column, last.column);
      const right = Math.max(first.column, last.column);
      if ((bottom - top + 1) * (right - left + 1) > MAX_PREVIEW_RANGE_CELLS) {
        throw new Error("Formula range is too large for preview");
      }
      const values: SpreadsheetScalar[] = [];
      const sheet = worksheetFor(first.sheetName);
      for (let row = top; row <= bottom; row += 1) {
        for (let column = left; column <= right; column += 1) {
          values.push(resolveFormulaCell(sheet.name, row, column));
        }
      }
      return values;
    },
  };
}

interface FormulaNode {
  cell: ExcelJS.Cell;
  formula: string;
  sheet: ExcelJS.Worksheet;
  state: "pending" | "recalculated" | "unsupported" | "visiting";
  value?: number;
}

function formulaKey(sheetName: string, address: string) {
  return `${sheetName}!${address.toUpperCase()}`;
}

function formulaFromCell(cell: ExcelJS.Cell) {
  const { value } = cell;
  if (!(value && isRuntimeObject(value) && "formula" in value && isRuntimeString(value.formula))) {
    return null;
  }
  return value.formula;
}

export async function prepareSpreadsheetPreview(
  input: ArrayBuffer
): Promise<PreparedSpreadsheetPreview> {
  await assertSafeOfficeArchive(input, OFFICE_ARCHIVE_LIMITS);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);
  const nodes = new Map<string, FormulaNode>();
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const formula = formulaFromCell(cell);
        if (formula) {
          nodes.set(formulaKey(worksheet.name, cell.address), {
            cell,
            formula,
            sheet: worksheet,
            state: "pending",
          });
        }
      });
    });
  }

  const evaluateNode = (node: FormulaNode): number | null => {
    if (node.state === "recalculated") {
      return node.value ?? null;
    }
    if (node.state === "unsupported" || node.state === "visiting") {
      node.state = "unsupported";
      return null;
    }
    node.state = "visiting";
    const resolveFormulaCell = (sheetName: string, row: number, column: number) => {
      const cell = workbook.getWorksheet(sheetName)?.getCell(row, column);
      if (!cell) {
        throw new Error("Unknown formula cell");
      }
      const dependency = nodes.get(formulaKey(sheetName, cell.address));
      if (!dependency) {
        return spreadsheetScalar(cell.value);
      }
      const value = evaluateNode(dependency);
      if (value === null) {
        throw new Error("Formula dependency was not recalculated");
      }
      return value;
    };
    const result = evaluateSafeSpreadsheetFormula(
      `=${node.formula}`,
      resolverFor(workbook, node.sheet, resolveFormulaCell)
    );
    if (result.status !== "calculated") {
      node.state = "unsupported";
      return null;
    }
    node.cell.value = { formula: node.formula, result: result.value };
    node.state = "recalculated";
    node.value = result.value;
    return result.value;
  };

  let recalculatedFormulaCount = 0;
  let unsupportedFormulaCount = 0;
  const formulaStatuses: SpreadsheetFormulaStatus[] = [];
  for (const node of nodes.values()) {
    evaluateNode(node);
    const status = node.state === "recalculated" ? "recalculated" : "unsupported";
    formulaStatuses.push({ cell: node.cell.address, sheetName: node.sheet.name, status });
    if (status === "recalculated") {
      recalculatedFormulaCount += 1;
    } else {
      unsupportedFormulaCount += 1;
    }
  }
  const serialized = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(serialized);
  return {
    bytes: bytes.buffer,
    formulaStatuses,
    recalculatedFormulaCount,
    unsupportedFormulaCount,
  };
}
