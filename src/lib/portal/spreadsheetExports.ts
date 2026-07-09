import { formatDisplayDateForExport } from "@/lib/formatDate";
import { normalizeTravellerGender } from "@/lib/portal/travellerSummary";
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
  type WorkbookRow,
  type WorkbookRows,
  workbookArrayBufferFromSheets,
  workbookFromSheets,
} from "./workbookAdapter";

const WHITESPACE_RE = /\s+/;

interface ExportPassportDetails {
  dateOfBirth?: string;
  expiryDate?: string;
  issueDate?: string;
  number?: string;
}

interface ExportVisaDetails {
  appointmentDate?: string;
  notes?: string;
  status?: string;
}

export interface TravellerWorkbookExportRow {
  contactNo?: string;
  foodPreference?: string;
  fullName?: string;
  gender?: string;
  givenName?: string;
  hotelAllocation?: string;
  passport?: ExportPassportDetails;
  paymentType?: string;
  roomType?: string;
  sourceDealerCode?: string;
  sourceDealerName?: string;
  sourceDescription?: string;
  sourceRsoName?: string;
  sourceSoName?: string;
  specialRequests?: string;
  surname?: string;
  ticketing?: {
    domesticPnr?: string;
    domesticTicket?: string;
    domesticVendor?: string;
    internationalFare?: string | number;
    internationalPnr?: string;
    internationalVendor?: string;
  };
  travelBatchReference?: string;
  travelHub?: string;
  visa?: ExportVisaDetails;
  visaStatus?: string;
}

export interface FlightSegmentExportRow {
  airline?: string;
  arriveTime?: string;
  dateLabel?: string;
  departTime?: string;
  destination?: string;
  duration?: string;
  flightNumber?: string | number;
  origin?: string;
  transit?: string;
}

export interface FlightGroupExportRow {
  segments?: FlightSegmentExportRow[];
  sourceSheet?: string;
  travelBatchReference?: string;
}

interface WorkbookBuildOptions {
  sheetName?: string;
}

interface FlightWorkbookBuildOptions {
  defaultSheetName?: string;
}

export function formatFoodPreferenceForExport(value: unknown): string {
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

function genderForTemplate(value: unknown): string {
  const normalized = normalizeTravellerGender(value);
  if (normalized === "Male") {
    return "MALE";
  }
  if (normalized === "Female") {
    return "FEMALE";
  }
  return typeof value === "string" ? value : "";
}

function passengerRowToArray(
  row: TravellerWorkbookExportRow & { sequenceNumber?: number }
): WorkbookRow {
  const passport = row.passport || {};
  const name =
    row.surname || row.givenName
      ? { givenName: row.givenName || row.fullName || "", surname: row.surname || "" }
      : splitPassengerName(row.fullName);
  const ticketing = row.ticketing || {};
  return [
    row.sequenceNumber || "",
    honorificForPassenger(row.gender),
    name.surname,
    name.givenName,
    genderForTemplate(row.gender),
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
    row.travelBatchReference || "",
  ];
}

function splitPassengerName(fullName: unknown): { givenName: string; surname: string } {
  const parts = String(fullName ?? "")
    .trim()
    .split(WHITESPACE_RE)
    .filter(Boolean);
  if (parts.length <= 1) {
    return { givenName: parts[0] || "", surname: "" };
  }
  return {
    givenName: parts.slice(0, -1).join(" "),
    surname: parts.at(-1) || "",
  };
}

function honorificForPassenger(gender: unknown): string {
  const key = String(gender ?? "")
    .trim()
    .toLowerCase();
  if (key.startsWith("f")) {
    return "MS";
  }
  if (key.startsWith("m")) {
    return "MR";
  }
  return "";
}

function splitTemplateName(fullName: unknown): { givenName: string; surname: string } {
  const parts = String(fullName ?? "")
    .trim()
    .split(WHITESPACE_RE)
    .filter(Boolean);
  if (parts.length <= 1) {
    return { givenName: parts[0] || "", surname: "" };
  }
  return {
    givenName: parts.slice(1).join(" "),
    surname: parts[0],
  };
}

function roomTypeForTemplate(value: unknown): string {
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

function paymentTypeForTemplate(value: unknown): string {
  switch (value) {
    case "Self Paid":
      return "Self Paid";
    case "Upgraded Self Paid":
      return "Upgraded Self Paid";
    default:
      return "Company Paid";
  }
}

function templateBase(row: TravellerWorkbookExportRow): {
  contactNo: string;
  dealerName: string;
  gender: string;
  givenName: string;
  passport: ExportPassportDetails;
  passportValid: string;
  remarks: string;
  surname: string;
} {
  const passport = row.passport || {};
  const name =
    row.surname || row.givenName
      ? { givenName: row.givenName || row.fullName || "", surname: row.surname || "" }
      : splitTemplateName(row.fullName);
  return {
    contactNo: row.contactNo || "",
    dealerName: row.sourceDealerName || "",
    gender: genderForTemplate(row.gender),
    givenName: name.givenName,
    passport,
    passportValid: passport.number && passport.expiryDate ? "Yes" : "",
    remarks: row.specialRequests || "",
    surname: name.surname,
  };
}

function roomingRowToArray(row: TravellerWorkbookExportRow, index: number): WorkbookRow {
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
    row.travelBatchReference || "",
    "",
  ];
}

function travellerMasterRowToArray(row: TravellerWorkbookExportRow, index: number): WorkbookRow {
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
    row.travelBatchReference || "",
    "",
  ];
}

function passportRowToArray(row: TravellerWorkbookExportRow, index: number): WorkbookRow {
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
    row.travelBatchReference || "",
  ];
}

function visaRowToArray(row: TravellerWorkbookExportRow, index: number): WorkbookRow {
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
    row.travelBatchReference || "",
  ];
}

export function buildPassengerWorkbook(
  rows: TravellerWorkbookExportRow[],
  { sheetName = "Passengers" }: WorkbookBuildOptions = {}
): WorkbookRows {
  const sheetRows = [
    PASSENGER_EXPORT_HEADERS,
    ...rows.map((row, index) => passengerRowToArray({ ...row, sequenceNumber: index + 1 })),
  ];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildTravellerMasterWorkbook(
  rows: TravellerWorkbookExportRow[],
  { sheetName = "Master list" }: WorkbookBuildOptions = {}
): WorkbookRows {
  const sheetRows = [TRAVELLER_MASTER_EXPORT_HEADERS, ...rows.map(travellerMasterRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildRoomingWorkbook(
  rows: TravellerWorkbookExportRow[],
  { sheetName = "Rooming" }: WorkbookBuildOptions = {}
): WorkbookRows {
  const sheetRows = [ROOMING_EXPORT_HEADERS, ...rows.map(roomingRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildPassportWorkbook(
  rows: TravellerWorkbookExportRow[],
  { sheetName = "Passport" }: WorkbookBuildOptions = {}
): WorkbookRows {
  const sheetRows = [PASSPORT_EXPORT_HEADERS, ...rows.map(passportRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

export function buildVisaWorkbook(
  rows: TravellerWorkbookExportRow[],
  { sheetName = "Visa" }: WorkbookBuildOptions = {}
): WorkbookRows {
  const sheetRows = [VISA_EXPORT_HEADERS, ...rows.map(visaRowToArray)];
  return workbookFromSheets({
    [sanitizeSheetName(sheetName)]: sheetRows,
  });
}

function flightHeaderRow(): WorkbookRow {
  return ["", ...FLIGHT_EXPORT_HEADER];
}

function flightSegmentRow(segment: FlightSegmentExportRow): WorkbookRow {
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

function groupFlightsBySheet(
  groups: FlightGroupExportRow[],
  defaultSheetName: string
): Map<string, FlightGroupExportRow[]> {
  const groupsBySheet = new Map<string, FlightGroupExportRow[]>();
  for (const group of groups) {
    const key = group.sourceSheet || defaultSheetName;
    const sheetGroups = groupsBySheet.get(key) ?? [];
    sheetGroups.push(group);
    groupsBySheet.set(key, sheetGroups);
  }
  return groupsBySheet;
}

function uniqueSheetName(
  sheetKey: string,
  defaultSheetName: string,
  usedNames: Set<string>
): string {
  let sheetName = sanitizeSheetName(sheetKey, defaultSheetName);
  let suffix = 2;
  while (usedNames.has(sheetName)) {
    const trimmed = sheetName.slice(0, Math.max(1, 28 - String(suffix).length));
    sheetName = `${trimmed}-${suffix}`;
    suffix += 1;
  }
  usedNames.add(sheetName);
  return sheetName;
}

function flightSheetRows(sheetGroups: FlightGroupExportRow[]): WorkbookRow[] {
  const sheetRows: WorkbookRow[] = [[]];
  for (const group of sheetGroups) {
    const segments = group.segments || [];
    if (segments.length === 0) {
      continue;
    }
    if (group.travelBatchReference) {
      sheetRows.push(["Travel Batch", group.travelBatchReference]);
    }
    sheetRows.push(flightHeaderRow());
    for (const segment of segments) {
      sheetRows.push(flightSegmentRow(segment));
    }
    sheetRows.push([]);
  }
  if (sheetRows.length === 1) {
    sheetRows.push(flightHeaderRow());
  }
  return sheetRows;
}

export function buildFlightWorkbook(
  groups: FlightGroupExportRow[],
  { defaultSheetName = "Flights" }: FlightWorkbookBuildOptions = {}
): WorkbookRows {
  const groupsBySheet = groupFlightsBySheet(groups, defaultSheetName);
  const sheets: Record<string, WorkbookRow[]> = {};

  if (groupsBySheet.size === 0) {
    sheets[sanitizeSheetName(defaultSheetName)] = [[], flightHeaderRow()];
    return workbookFromSheets(sheets);
  }

  const usedNames = new Set<string>();
  for (const [sheetKey, sheetGroups] of groupsBySheet.entries()) {
    const sheetName = uniqueSheetName(sheetKey, defaultSheetName, usedNames);
    sheets[sheetName] = flightSheetRows(sheetGroups);
  }

  return workbookFromSheets(sheets);
}

export async function downloadWorkbook(workbook: WorkbookRows, filename: string): Promise<void> {
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
