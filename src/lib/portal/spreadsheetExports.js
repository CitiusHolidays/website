import * as XLSX from "xlsx";
import { FLIGHT_EXPORT_HEADER, PASSENGER_EXPORT_HEADERS } from "./spreadsheetImports";

function sanitizeSheetName(name, fallback = "Sheet1") {
  const cleaned = String(name ?? "")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || fallback;
}

export function formatFoodPreferenceForExport(value) {
  switch (value) {
    case "Non-Veg":
      return "NON VEG";
    case "Jain":
      return "JAIN";
    case "Vegan":
      return "VEGAN";
    default:
      return "VEG";
  }
}

function passengerRowToArray(row) {
  const passport = row.passport || {};
  return [
    "",
    row.sourceDealerCode || "",
    row.sourceDealerName || "",
    row.sourceDescription || "",
    row.sourceSoName || "",
    row.sourceRsoName || "",
    1,
    "",
    row.willingToGo || "CONFIRMED",
    row.travelHub || "",
    row.fullName || "",
    row.gender || "",
    passport.dateOfBirth || "",
    passport.number || "",
    passport.issueDate || "",
    passport.expiryDate || "",
    formatFoodPreferenceForExport(row.foodPreference),
    row.contactNo || "",
    row.specialRequests || "",
    row.sourceGroup || "",
  ];
}

export function buildPassengerWorkbook(rows, { sheetName = "Passengers" } = {}) {
  const workbook = XLSX.utils.book_new();
  const sheetRows = [[], PASSENGER_EXPORT_HEADERS, ...rows.map(passengerRowToArray)];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(sheetRows),
    sanitizeSheetName(sheetName),
  );
  return workbook;
}

function flightHeaderRow() {
  return ["", ...FLIGHT_EXPORT_HEADER];
}

function flightSegmentRow(segment) {
  return [
    "",
    segment.dateLabel || "",
    segment.airline || "",
    segment.flightNumber || "",
    segment.departTime || "",
    segment.origin || "",
    segment.arriveTime || "",
    segment.destination || "",
    segment.duration || "-",
    segment.transit || "-",
  ];
}

export function buildFlightWorkbook(groups, { defaultSheetName = "Flights" } = {}) {
  const workbook = XLSX.utils.book_new();
  const groupsBySheet = new Map();

  for (const group of groups) {
    const key = group.sourceSheet || defaultSheetName;
    if (!groupsBySheet.has(key)) groupsBySheet.set(key, []);
    groupsBySheet.get(key).push(group);
  }

  if (groupsBySheet.size === 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([[], flightHeaderRow()]),
      sanitizeSheetName(defaultSheetName),
    );
    return workbook;
  }

  const usedNames = new Set();
  for (const [sheetKey, sheetGroups] of groupsBySheet.entries()) {
    let sheetName = sanitizeSheetName(sheetKey, defaultSheetName);
    let suffix = 2;
    while (usedNames.has(sheetName)) {
      const trimmed = sheetName.slice(0, Math.max(1, 28 - String(suffix).length));
      sheetName = `${trimmed}-${suffix}`;
      suffix += 1;
    }
    usedNames.add(sheetName);

    const sheetRows = [[]];
    for (const group of sheetGroups) {
      const segments = group.segments || [];
      if (segments.length === 0) continue;
      sheetRows.push(flightHeaderRow());
      for (const segment of segments) {
        sheetRows.push(flightSegmentRow(segment));
      }
      sheetRows.push([]);
    }
    if (sheetRows.length === 1) {
      sheetRows.push(flightHeaderRow());
    }

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(sheetRows),
      sheetName,
    );
  }

  return workbook;
}

export function downloadWorkbook(workbook, filename) {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
