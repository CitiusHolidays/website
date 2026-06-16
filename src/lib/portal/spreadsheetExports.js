import { formatDisplayDateForExport } from "@/lib/formatDate";
import {
  FLIGHT_EXPORT_HEADER,
  PASSENGER_EXPORT_HEADERS,
  PASSPORT_EXPORT_HEADERS,
  ROOMING_EXPORT_HEADERS,
  TRAVELLER_MASTER_EXPORT_HEADERS,
  VISA_EXPORT_HEADERS,
} from "./spreadsheetImports";
import {
  sanitizeSheetName,
  workbookArrayBufferFromSheets,
  workbookFromSheets,
} from "./workbookAdapter";

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
  const name =
    row.surname || row.givenName
      ? { surname: row.surname || "", givenName: row.givenName || row.fullName || "" }
      : splitPassengerName(row.fullName);
  const ticketing = row.ticketing || {};
  return [
    row.sequenceNumber || "",
    honorificForPassenger(row.gender),
    name.surname,
    name.givenName,
    row.gender || "",
    passport.number || "",
    formatDisplayDateForExport(passport.dateOfBirth),
    formatDisplayDateForExport(passport.issueDate),
    formatDisplayDateForExport(passport.expiryDate),
    formatFoodPreferenceForExport(row.foodPreference),
    row.contactNo || "",
    ticketing.internationalFare || "",
    ticketing.internationalPnr || "",
    ticketing.internationalVendor || "",
    ticketing.domesticTicket || "",
    ticketing.domesticPnr || "",
    ticketing.domesticVendor || "",
  ];
}

function splitPassengerName(fullName) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) {
    return { surname: "", givenName: parts[0] || "" };
  }
  return {
    surname: parts.at(-1) || "",
    givenName: parts.slice(0, -1).join(" "),
  };
}

function honorificForPassenger(gender) {
  const key = String(gender ?? "")
    .trim()
    .toLowerCase();
  if (key.startsWith("f")) return "MS";
  if (key.startsWith("m")) return "MR";
  return "";
}

function splitTemplateName(fullName) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) {
    return { surname: "", givenName: parts[0] || "" };
  }
  return {
    surname: parts[0],
    givenName: parts.slice(1).join(" "),
  };
}

function roomTypeForTemplate(value) {
  switch (value) {
    case "Single":
      return "SINGLE";
    case "Double":
      return "DOUBLE";
    case "Triple":
      return "TRIPLE";
    case "Child with Bed":
      return "Child with Bed";
    case "Family Room":
      return "FAMILY ROOM";
    default:
      return "TWIN";
  }
}

function paymentTypeForTemplate(value) {
  switch (value) {
    case "Self Paid":
      return "Self Paid";
    case "Upgraded Self Paid":
      return "Upgraded Self Paid";
    default:
      return "Company Paid";
  }
}

function templateBase(row) {
  const passport = row.passport || {};
  const name =
    row.surname || row.givenName
      ? { surname: row.surname || "", givenName: row.givenName || row.fullName || "" }
      : splitTemplateName(row.fullName);
  return {
    passport,
    surname: name.surname,
    givenName: name.givenName,
    dealerName: row.sourceDealerName || "",
    gender: row.gender || "",
    passportValid: passport.number && passport.expiryDate ? "Yes" : "",
    remarks: row.specialRequests || "",
    contactNo: row.contactNo || "",
  };
}

function roomingRowToArray(row, index) {
  const base = templateBase(row);
  return [
    index + 1,
    base.dealerName,
    base.gender,
    base.surname,
    base.givenName,
    roomTypeForTemplate(row.roomType),
    row.hotelAllocation || base.remarks,
    base.passport.number || "",
    formatDisplayDateForExport(base.passport.issueDate),
    formatDisplayDateForExport(base.passport.expiryDate),
    formatDisplayDateForExport(base.passport.dateOfBirth),
    "",
    base.contactNo,
    "",
    formatFoodPreferenceForExport(row.foodPreference),
    row.travelHub || "",
    "",
    "",
    "",
  ];
}

function travellerMasterRowToArray(row, index) {
  const base = templateBase(row);
  return [
    index + 1,
    row.sourceDescription || "",
    row.sourceDealerCode || "",
    base.dealerName,
    base.gender,
    base.surname,
    base.givenName,
    base.passport.number || "",
    formatDisplayDateForExport(base.passport.issueDate),
    formatDisplayDateForExport(base.passport.expiryDate),
    formatDisplayDateForExport(base.passport.dateOfBirth),
    "",
    base.contactNo,
    "",
    row.sourceSoName || "",
    formatFoodPreferenceForExport(row.foodPreference),
    row.travelHub || "",
    row.sourceRsoName || "",
    "",
  ];
}

function passportRowToArray(row, index) {
  const base = templateBase(row);
  return [
    index + 1,
    base.dealerName,
    base.gender,
    base.surname,
    base.givenName,
    base.passport.number || "",
    formatDisplayDateForExport(base.passport.issueDate),
    formatDisplayDateForExport(base.passport.expiryDate),
    base.passportValid,
    formatDisplayDateForExport(base.passport.dateOfBirth),
    "",
    base.remarks,
    base.contactNo,
  ];
}

function visaRowToArray(row, index) {
  const base = templateBase(row);
  const visa = row.visa || {};
  return [
    index + 1,
    base.dealerName,
    base.gender,
    base.surname,
    base.givenName,
    base.passport.number || "",
    formatDisplayDateForExport(base.passport.issueDate),
    formatDisplayDateForExport(base.passport.expiryDate),
    base.passportValid,
    formatDisplayDateForExport(base.passport.dateOfBirth),
    "",
    base.remarks,
    base.contactNo,
    visa.appointmentDate ? "Yes" : "",
    formatDisplayDateForExport(visa.appointmentDate),
    "",
    visa.status || row.visaStatus || "",
    paymentTypeForTemplate(row.paymentType),
    "",
    visa.notes || "",
  ];
}

export function buildPassengerWorkbook(rows, { sheetName = "Passengers" } = {}) {
  const sheetRows = [
    PASSENGER_EXPORT_HEADERS,
    ...rows.map((row, index) => passengerRowToArray({ ...row, sequenceNumber: index + 1 })),
  ];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildTravellerMasterWorkbook(rows, { sheetName = "Master list" } = {}) {
  const sheetRows = [TRAVELLER_MASTER_EXPORT_HEADERS, ...rows.map(travellerMasterRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildRoomingWorkbook(rows, { sheetName = "Rooming" } = {}) {
  const sheetRows = [ROOMING_EXPORT_HEADERS, ...rows.map(roomingRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildPassportWorkbook(rows, { sheetName = "Passport" } = {}) {
  const sheetRows = [PASSPORT_EXPORT_HEADERS, ...rows.map(passportRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildVisaWorkbook(rows, { sheetName = "Visa" } = {}) {
  const sheetRows = [VISA_EXPORT_HEADERS, ...rows.map(visaRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
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
  const groupsBySheet = new Map();

  for (const group of groups) {
    const key = group.sourceSheet || defaultSheetName;
    if (!groupsBySheet.has(key)) groupsBySheet.set(key, []);
    groupsBySheet.get(key).push(group);
  }

  const sheets = {};

  if (groupsBySheet.size === 0) {
    sheets[sanitizeSheetName(defaultSheetName)] = [[], flightHeaderRow()];
    return workbookFromSheets(sheets);
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

    sheets[sheetName] = sheetRows;
  }

  return workbookFromSheets(sheets);
}

export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbookArrayBufferFromSheets(workbook.Sheets);
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
