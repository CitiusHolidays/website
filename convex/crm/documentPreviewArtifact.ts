import type { JSONValue } from "convex/values";
import {
  isRuntimeBoolean,
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
} from "../lib/runtimeValues";
import type {
  DocumentPreviewErrorCode,
  DocumentPreviewOperationKind,
} from "./documentPreviewContract";

const PDF_HEADER = "%PDF-";
const PDF_HEADER_PATTERN = /^%PDF-(?:1\.[0-7]|2\.0)(?:\r?\n|\r)/;
const PDF_START_XREF_PATTERN = /startxref\s+(\d+)\s+%%EOF\s*$/;
const PDF_TAIL_BYTES = 64 * 1024;
const PDF_XREF_PROBE_BYTES = 8 * 1024;
const PDF_ROOT_REFERENCE_PATTERN = /\/Root\s+(\d+)\s+(\d+)\s+R\b/;
const PDF_XREF_SUBSECTION_PATTERN = /^(\d+)\s+(\d+)$/;
const PDF_XREF_ENTRY_PATTERN = /^(\d{10})\s+(\d{5})\s+([fn])(?:\s|$)/;
const PDF_CATALOG_PATTERN = /\/Type\s*\/Catalog\b/;
const PDF_LINE_PATTERN = /\r?\n/;
const SPREADSHEET_SCHEMA_VERSION = 1;
const MAX_SPREADSHEET_SHEETS = 256;
const MAX_SPREADSHEET_ROWS_PER_SHEET = 200_000;
const MAX_SPREADSHEET_COLUMNS_PER_ROW = 16_384;
const MAX_SPREADSHEET_CELLS = 2_000_000;

export interface DocumentPreviewArtifactValidation {
  errorCode?: DocumentPreviewErrorCode;
  valid: boolean;
}

function containsUnsafeJsonKey(value: JSONValue): boolean {
  if (Array.isArray(value)) {
    return value.some(containsUnsafeJsonKey);
  }
  if (!isRuntimeObject(value)) {
    return false;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return true;
    }
    if (containsUnsafeJsonKey(nested)) {
      return true;
    }
  }
  return false;
}

function isSpreadsheetCellValue(value: JSONValue) {
  return (
    value === null ||
    isRuntimeString(value) ||
    isRuntimeBoolean(value) ||
    (isRuntimeNumber(value) && Number.isFinite(value))
  );
}

function spreadsheetRowCellCount(value: JSONValue) {
  if (
    !Array.isArray(value) ||
    value.length > MAX_SPREADSHEET_COLUMNS_PER_ROW ||
    !value.every(isSpreadsheetCellValue)
  ) {
    return null;
  }
  return value.length;
}

function spreadsheetSheetCellCount(value: JSONValue) {
  if (!isRuntimeObject(value) || Array.isArray(value)) {
    return null;
  }
  if (!hasExactKeys(value, ["name", "rows"])) {
    return null;
  }
  if (
    !isRuntimeString(value.name) ||
    value.name.length < 1 ||
    value.name.length > 256 ||
    !Array.isArray(value.rows) ||
    value.rows.length > MAX_SPREADSHEET_ROWS_PER_SHEET
  ) {
    return null;
  }
  let cellCount = 0;
  for (const row of value.rows) {
    const rowCellCount = spreadsheetRowCellCount(row);
    if (rowCellCount === null) {
      return null;
    }
    cellCount += rowCellCount;
  }
  return cellCount;
}

function isValidSpreadsheetArtifact(value: JSONValue) {
  if (!isRuntimeObject(value) || Array.isArray(value)) {
    return false;
  }
  if (
    !hasExactKeys(value, ["schemaVersion", "sheets"]) ||
    value.schemaVersion !== SPREADSHEET_SCHEMA_VERSION ||
    !Array.isArray(value.sheets) ||
    value.sheets.length > MAX_SPREADSHEET_SHEETS
  ) {
    return false;
  }
  let cellCount = 0;
  for (const sheet of value.sheets) {
    const sheetCellCount = spreadsheetSheetCellCount(sheet);
    if (sheetCellCount === null) {
      return false;
    }
    cellCount += sheetCellCount;
  }
  if (cellCount > MAX_SPREADSHEET_CELLS) {
    return false;
  }
  return true;
}

function hasExactKeys(value: Record<string, JSONValue>, allowed: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: xref subsection accounting and the referenced Catalog check form one structural validation pass.
async function validatePdfTableXref(blob: Blob, xrefOffset: number) {
  const xrefSource = await blob.slice(xrefOffset).text();
  const trailerOffset = xrefSource.indexOf("trailer");
  if (trailerOffset < 0) {
    return false;
  }
  const rootMatch = PDF_ROOT_REFERENCE_PATTERN.exec(xrefSource.slice(trailerOffset));
  if (!rootMatch) {
    return false;
  }
  const rootObject = Number(rootMatch[1]);
  const rootGeneration = Number(rootMatch[2]);
  const lines = xrefSource
    .slice("xref".length, trailerOffset)
    .split(PDF_LINE_PATTERN)
    .map((line) => line.trim())
    .filter(Boolean);
  let lineIndex = 0;
  let rootOffset: number | null = null;
  while (lineIndex < lines.length) {
    const subsection = PDF_XREF_SUBSECTION_PATTERN.exec(lines[lineIndex]);
    if (!subsection) {
      return false;
    }
    const firstObject = Number(subsection[1]);
    const entryCount = Number(subsection[2]);
    lineIndex += 1;
    if (
      !(Number.isSafeInteger(firstObject) && Number.isSafeInteger(entryCount) && entryCount > 0)
    ) {
      return false;
    }
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      const entry = PDF_XREF_ENTRY_PATTERN.exec(lines[lineIndex] ?? "");
      if (!entry) {
        return false;
      }
      const objectNumber = firstObject + entryIndex;
      const generation = Number(entry[2]);
      if (objectNumber === rootObject && generation === rootGeneration && entry[3] === "n") {
        rootOffset = Number(entry[1]);
      }
      lineIndex += 1;
    }
  }
  if (!(rootOffset !== null && rootOffset >= 0 && rootOffset < xrefOffset)) {
    return false;
  }
  const rootProbe = new TextDecoder("latin1").decode(
    await blob.slice(rootOffset, rootOffset + PDF_XREF_PROBE_BYTES).arrayBuffer()
  );
  const rootPrefix = `${rootObject} ${rootGeneration} obj`;
  const rootEnd = rootProbe.indexOf("endobj", rootPrefix.length);
  return (
    rootProbe.startsWith(rootPrefix) &&
    rootEnd > rootPrefix.length &&
    PDF_CATALOG_PATTERN.test(rootProbe.slice(rootPrefix.length, rootEnd))
  );
}

async function validatePdf(blob: Blob): Promise<DocumentPreviewArtifactValidation> {
  if (blob.size < PDF_HEADER.length + 20) {
    return { errorCode: "corrupt", valid: false };
  }
  const header = new TextDecoder("latin1").decode(await blob.slice(0, 16).arrayBuffer());
  if (!(header.startsWith(PDF_HEADER) && PDF_HEADER_PATTERN.test(header))) {
    return { errorCode: "signature_mismatch", valid: false };
  }
  const tailStart = Math.max(0, blob.size - PDF_TAIL_BYTES);
  const tail = new TextDecoder("latin1").decode(await blob.slice(tailStart).arrayBuffer());
  const startXrefMatch = PDF_START_XREF_PATTERN.exec(tail);
  if (!startXrefMatch) {
    return { errorCode: "corrupt", valid: false };
  }
  const xrefOffset = Number(startXrefMatch[1]);
  if (!(Number.isSafeInteger(xrefOffset) && xrefOffset >= 0 && xrefOffset < blob.size)) {
    return { errorCode: "corrupt", valid: false };
  }
  const xrefProbe = new TextDecoder("latin1").decode(
    await blob.slice(xrefOffset, xrefOffset + PDF_XREF_PROBE_BYTES).arrayBuffer()
  );
  if (!xrefProbe.startsWith("xref")) {
    return { errorCode: "corrupt", valid: false };
  }
  return (await validatePdfTableXref(blob, xrefOffset))
    ? { valid: true }
    : { errorCode: "corrupt", valid: false };
}

async function validateSpreadsheetJson(blob: Blob): Promise<DocumentPreviewArtifactValidation> {
  try {
    // SAFETY: JSON.parse can produce only the JSONValue grammar; the domain validator below rejects every unapproved artifact field/value contract.
    const parsed = JSON.parse(await blob.text()) as JSONValue;
    if (containsUnsafeJsonKey(parsed)) {
      return { errorCode: "unsafe_content", valid: false };
    }
    if (!isValidSpreadsheetArtifact(parsed)) {
      return { errorCode: "corrupt", valid: false };
    }
    return { valid: true };
  } catch {
    return { errorCode: "corrupt", valid: false };
  }
}

export async function validateDocumentPreviewArtifact(
  blob: Blob,
  previewKind: DocumentPreviewOperationKind
): Promise<DocumentPreviewArtifactValidation> {
  return previewKind === "spreadsheet"
    ? await validateSpreadsheetJson(blob)
    : await validatePdf(blob);
}
