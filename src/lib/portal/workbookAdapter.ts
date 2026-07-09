import ExcelJS from "exceljs";

export type WorkbookCellValue = string | number | boolean | Date | null | undefined;
export type WorkbookRow = WorkbookCellValue[];
export type WorkbookSheetMap = Record<string, WorkbookRow[]>;
export interface WorkbookRows {
  SheetNames: string[];
  Sheets: WorkbookSheetMap;
}

interface ExcelDateOptions {
  date1904?: boolean;
}

export interface ParsedExcelDateCode {
  D: number;
  d: number;
  H: number;
  M: number;
  m: number;
  q: number;
  S: number;
  T: number;
  u: number;
  y: number;
}

interface ExcelCellObject {
  error?: unknown;
  hyperlink?: string;
  result?: unknown;
  richText?: Array<{ text?: string }>;
  text?: string;
}

export function sanitizeSheetName(name: unknown, fallback = "Sheet1"): string {
  const cleaned = String(name ?? "")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || fallback;
}

export function parseExcelDateCode(
  serial: unknown,
  opts?: ExcelDateOptions,
  b2 = false
): ParsedExcelDateCode | null {
  if (typeof serial !== "number" || !Number.isFinite(serial) || serial > 2_958_465 || serial < 0) {
    return null;
  }
  let date = Math.trunc(serial);
  let time = Math.floor(86_400 * (serial - date));
  let dow = 0;
  const out = {
    D: date,
    d: 0,
    H: 0,
    M: 0,
    m: 0,
    q: 0,
    S: 0,
    T: time,
    u: 86_400 * (serial - date) - time,
    y: 0,
  };
  if (Math.abs(out.u) < 1e-6) {
    out.u = 0;
  }
  if (opts?.date1904) {
    date += 1462;
  }
  if (out.u > 0.9999) {
    out.u = 0;
    time += 1;
    if (time === 86_400) {
      time = 0;
      out.T = time;
      date += 1;
      out.D += 1;
    }
  }
  let year: number;
  let month: number;
  let day: number;
  if (date === 60) {
    if (b2) {
      year = 1317;
      month = 10;
      day = 29;
    } else {
      year = 1900;
      month = 2;
      day = 29;
    }
    dow = 3;
  } else if (date === 0) {
    if (b2) {
      year = 1317;
      month = 8;
      day = 29;
    } else {
      year = 1900;
      month = 1;
      day = 0;
    }
    dow = 6;
  } else {
    let adjusted = date;
    if (adjusted > 60) {
      adjusted -= 1;
    }
    const calendar = new Date(1900, 0, 1);
    calendar.setDate(calendar.getDate() + adjusted - 1);
    year = calendar.getFullYear();
    month = calendar.getMonth() + 1;
    day = calendar.getDate();
    dow = calendar.getDay();
    if (date < 60) {
      dow = (dow + 6) % 7;
    }
  }
  out.y = year;
  out.m = month;
  out.d = day;
  out.S = time % 60;
  time = Math.floor(time / 60);
  out.M = time % 60;
  time = Math.floor(time / 60);
  out.H = time;
  out.q = dow;
  return out;
}

function isExcelCellObject(value: unknown): value is ExcelCellObject {
  return Boolean(value && typeof value === "object");
}

function normalizeCellValue(value: unknown): WorkbookCellValue {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value;
  }
  if (isExcelCellObject(value)) {
    if (Object.hasOwn(value, "result")) {
      return normalizeCellValue(value.result);
    }
    if (value.hyperlink) {
      return value.text ?? value.hyperlink;
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
    if (typeof value.text === "string") {
      return value.text;
    }
    if (value.error) {
      return "";
    }
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  return "";
}

function isBlankRow(rowValues: WorkbookRow): boolean {
  return rowValues.every((value) => {
    if (value === null || value === undefined || value === "") {
      return true;
    }
    if (typeof value === "string" && value.trim() === "") {
      return true;
    }
    return false;
  });
}

function rowValuesFromWorksheetRow(row: ExcelJS.Row): WorkbookRow {
  const raw = row.values;
  if (!Array.isArray(raw)) {
    return [];
  }
  const values = raw.slice(1).map((value) => normalizeCellValue(value));
  while (
    values.length > 0 &&
    (values.at(-1) === "" || values.at(-1) === null || values.at(-1) === undefined)
  ) {
    values.pop();
  }
  return values;
}

export function workbookFromSheets(sheets: WorkbookSheetMap): WorkbookRows {
  const SheetNames = Object.keys(sheets);
  return { SheetNames, Sheets: { ...sheets } };
}

export async function workbookRowsFromArrayBuffer(buffer: ArrayBuffer): Promise<WorkbookRows> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const Sheets: WorkbookSheetMap = {};
  const SheetNames: string[] = [];
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    SheetNames.push(sheetName);
    const rows: WorkbookRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = rowValuesFromWorksheetRow(row);
      if (!isBlankRow(values)) {
        rows.push(values);
      }
    });
    Sheets[sheetName] = rows;
  }
  return { SheetNames, Sheets };
}

export async function workbookArrayBufferFromSheets(sheets: WorkbookSheetMap): Promise<BlobPart> {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(name));
    for (const row of rows) {
      worksheet.addRow(row);
    }
  }
  return await workbook.xlsx.writeBuffer();
}
