import ExcelJS from "exceljs";

export function sanitizeSheetName(name, fallback = "Sheet1") {
  const cleaned = String(name ?? "")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || fallback;
}

export function parseExcelDateCode(serial, opts, b2) {
  if (typeof serial !== "number" || !Number.isFinite(serial) || serial > 2_958_465 || serial < 0) {
    return null;
  }
  let date = serial | 0;
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
    if (++time === 86_400) {
      out.T = time = 0;
      date += 1;
      out.D += 1;
    }
  }
  let year;
  let month;
  let day;
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

function normalizeCellValue(value) {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "object") {
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
  return value;
}

function isBlankRow(rowValues) {
  return rowValues.every((value) => {
    if (value == null || value === "") {
      return true;
    }
    if (typeof value === "string" && value.trim() === "") {
      return true;
    }
    return false;
  });
}

function rowValuesFromWorksheetRow(row) {
  const raw = row.values;
  if (!Array.isArray(raw)) {
    return [];
  }
  const values = raw.slice(1).map((value) => normalizeCellValue(value));
  while (values.length > 0 && (values.at(-1) === "" || values.at(-1) == null)) {
    values.pop();
  }
  return values;
}

export function workbookFromSheets(sheets) {
  const SheetNames = Object.keys(sheets);
  return { SheetNames, Sheets: { ...sheets } };
}

export async function workbookRowsFromArrayBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const Sheets = {};
  const SheetNames = [];
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    SheetNames.push(sheetName);
    const rows = [];
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

export async function workbookArrayBufferFromSheets(sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(name));
    for (const row of rows) {
      worksheet.addRow(row);
    }
  }
  return workbook.xlsx.writeBuffer();
}
