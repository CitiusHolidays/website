import { normalizeTravellerGender } from "./travellerSummary";
import {
  parseExcelDateCode,
  type WorkbookCellValue,
  type WorkbookRow,
  type WorkbookRows,
  workbookRowsFromArrayBuffer,
} from "./workbookAdapter";

type HeaderMap = Map<string, number>;
type ImportKind = "passenger" | "traveller" | "rooming" | "passport" | "visa";

export interface SpreadsheetImportError {
  id: string;
  message: string;
  sourceRowNumber: number;
  sourceSheet: string;
}

export interface SpreadsheetSkippedRow {
  fullName: string;
  id: string;
  reason: string;
  sourceRowNumber: number;
  sourceSheet: string;
  status: string;
}

export interface PassengerTicketingImport {
  domesticPnr: string;
  domesticTicket: string;
  domesticVendor: string;
  internationalFare: string;
  internationalPnr: string;
  internationalVendor: string;
}

export interface ImportedPassportDetails {
  dateOfBirth: string;
  expiryDate: string;
  issueDate: string;
  nationality: string;
  number: string;
}

export interface ImportedTravellerRow {
  biometricAppointmentDate?: string;
  contactNo: string;
  domesticTravelRequired: boolean;
  foodPreference: string;
  fullName: string;
  gender: string;
  givenName: string;
  guestType: string;
  hotelAllocation?: string;
  id: string;
  importKey: string;
  importKind: ImportKind;
  passport: ImportedPassportDetails;
  passportStatus: string;
  paymentType: string;
  roomType: string;
  sourceDealerCode: string;
  sourceDealerName: string;
  sourceDescription: string;
  sourceGroup?: string;
  sourceRowNumber: number;
  sourceRsoName: string;
  sourceSheet: string;
  sourceSoName: string;
  specialRequests: string;
  surname: string;
  ticketing?: PassengerTicketingImport;
  travelBatchReference?: string;
  travelHub: string;
  visaNotes?: string;
  visaRequired: boolean;
  visaStatus?: string;
}

export interface TravellerWorkbookParseResult {
  errors: SpreadsheetImportError[];
  rows: ImportedTravellerRow[];
  skipped: SpreadsheetSkippedRow[];
}

export interface ImportedFlightSegment {
  airline: string;
  arriveTime: string;
  dateLabel: string;
  departTime: string;
  destination: string;
  duration: string;
  flightNumber: string;
  id: string;
  importKey: string;
  origin: string;
  segmentIndex: number;
  sourceGroupIndex: number;
  sourceRowNumber: number;
  sourceSheet: string;
  transit: string;
}

export interface ImportedFlightGroup {
  groupIndex: number;
  id: string;
  name: string;
  segments: ImportedFlightSegment[];
  sourceSheet: string;
  travelBatchReference?: string;
}

type MutableImportedFlightGroup = ImportedFlightGroup & {
  headerStart: number;
};

export interface FlightWorkbookParseResult {
  errors: SpreadsheetImportError[];
  groups: ImportedFlightGroup[];
}

interface TemplateRowBaseInput {
  headers: HeaderMap;
  importKind: Exclude<ImportKind, "passenger">;
  row: WorkbookRow;
  sheetName: string;
  sourceRowNumber: number;
}

interface TemplateWorkbookOptions {
  importKind: Exclude<ImportKind, "passenger">;
  preferredSheetNames: string[];
  requiredHeaders: string[];
}

interface ImportKeyInput {
  contactNo: string;
  dateOfBirth: string;
  fullName: string;
}

interface TemplateImportKeyInput extends ImportKeyInput {
  passportNumber: string;
}

export const PASSENGER_EXPORT_HEADERS = [
  "NO",
  "",
  "SURNAME",
  "Name As per Govt. ID Proof",
  "Gender",
  "Passport no ",
  "Date of Birth",
  "Passport Issus date",
  "Passport Exp",
  "Meal Preference",
  "Contact No.",
  "International fare",
  "International PNR",
  "VENDOR",
  "Domestic ticket",
  "Domestic PNR",
  "VENDOR",
  "Travel Batch",
];

export const FLIGHT_EXPORT_HEADER = [
  "Date",
  "Airline",
  "Flight No",
  "Depart",
  "from",
  "Arrive",
  "at",
  "Duration",
  "Transit",
];

export const TRAVELLER_MASTER_EXPORT_HEADERS = [
  "S.No",
  "Branch ",
  "Branch Code",
  "Dealer Name",
  "Gender",
  "SURNAME",
  "GIVEN NAME",
  "Passport Number",
  "Passport Issue date",
  "Passport expiry date",
  "Date of Birth As per passport",
  "Place of Issue",
  "Contact Number",
  "Email id",
  "Base Location",
  "Food Preference",
  "Hub",
  "Airlines",
  "Travel Batch",
  "",
];

export const ROOMING_EXPORT_HEADERS = [
  "Sl.no.",
  "Dealer Name",
  "Gender",
  "SURNAME",
  "GIVEN NAME",
  "ROOMING Category",
  "REMARKS",
  "Passport Number",
  "Passport Issue date",
  "Passport expiry date",
  "Date of Birth As per passport",
  "Place of Issue",
  "Contact Number",
  "Email id",
  "Meal",
  "Hub",
  "Airlines International",
  "Airlines Domestic ",
  "Travel Batch",
  "",
];

export const PASSPORT_EXPORT_HEADERS = [
  "Sl.no.",
  "Dealer Name",
  "Gender",
  "SURNAME",
  "GIVEN NAME",
  "Passport Number",
  "Passport Issue date",
  "Passport expiry date",
  "PP Valid for Travel Yes /No",
  "Date of Birth As per passport",
  "Place of Issue",
  "REMARKS:  Expiry PP / Under Renewal",
  "Contact Number",
  "Travel Batch",
];

export const VISA_EXPORT_HEADERS = [
  "Sl.no.",
  "Dealer Name",
  "Gender",
  "SURNAME",
  "GIVEN NAME",
  "Passport Number",
  "Passport Issue date",
  "Passport expiry date",
  "PP Valid for Travel Yes /No",
  "Date of Birth As per passport",
  "Place of Issue",
  "REMARKS:  Expiry PP / Under Renewal",
  "Contact Number",
  "Biometric Required",
  "Date of Appointmemt ",
  "VFS Center ",
  "Status Of Visa ",
  "Company paid/ Self Paid",
  "Amount",
  "Remarks ",
  "Travel Batch",
];

const PASSENGER_REQUIRED_HEADERS = ["Name As per Govt. ID Proof", "WILLING TO GO"];
const TICKETING_TEMPLATE_REQUIRED_HEADERS = [
  "SURNAME",
  "Name As per Govt. ID Proof",
  "Passport no ",
];
const ISO_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/;
const DMY_DATE_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/;

function clean(value: unknown): string {
  if (value instanceof Date) {
    return formatDateObject(value);
  }
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerKey(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizedKey(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rowToHeaderMap(row: WorkbookRow): HeaderMap {
  const map = new Map();
  row.forEach((cell, index) => {
    const key = headerKey(cell);
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

function getByHeader(row: WorkbookRow, headers: HeaderMap, names: string[]): WorkbookCellValue {
  for (const name of names) {
    const index = headers.get(headerKey(name));
    if (index !== undefined) {
      return row[index];
    }
  }
  return "";
}

function sheetRows(rowArrays: WorkbookRow[] | undefined): WorkbookRow[] {
  return rowArrays ?? [];
}

async function workbookFromFile(file: Blob): Promise<WorkbookRows> {
  return workbookRowsFromArrayBuffer(await file.arrayBuffer());
}

export async function parsePassengerWorkbookFile(
  file: Blob
): Promise<TravellerWorkbookParseResult> {
  return parsePassengerWorkbook(await workbookFromFile(file));
}

export async function parseFlightWorkbookFile(file: Blob): Promise<FlightWorkbookParseResult> {
  return parseFlightWorkbook(await workbookFromFile(file));
}

export async function parseTravellerMasterWorkbookFile(
  file: Blob
): Promise<TravellerWorkbookParseResult> {
  return parseTravellerMasterWorkbook(await workbookFromFile(file));
}

export async function parseRoomingWorkbookFile(file: Blob): Promise<TravellerWorkbookParseResult> {
  return parseRoomingWorkbook(await workbookFromFile(file));
}

export async function parsePassportWorkbookFile(file: Blob): Promise<TravellerWorkbookParseResult> {
  return parsePassportWorkbook(await workbookFromFile(file));
}

export async function parseVisaWorkbookFile(file: Blob): Promise<TravellerWorkbookParseResult> {
  return parseVisaWorkbook(await workbookFromFile(file));
}

function formatDateObject(value: Date): string {
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function normalizeFoodPreference(value: unknown): string {
  const key = headerKey(value);
  if (!key) {
    return "Veg";
  }
  if (key.includes("nonveg") || key.includes("nonvegetarian")) {
    return "Non-Veg";
  }
  if (key.includes("jain")) {
    return "Jain";
  }
  if (key.includes("vegan")) {
    return "Vegan";
  }
  return "Veg";
}

export function normalizeRoomType(value: unknown, fallback = "Twin"): string {
  const key = headerKey(value);
  if (!key) {
    return fallback;
  }
  if (key.includes("single") || key === "sgl") {
    return "Single";
  }
  if (key.includes("double") || key === "dbl") {
    return "Double";
  }
  if (key.includes("triple") || key === "tpl") {
    return "Triple";
  }
  if (key.includes("child")) {
    return "Child with Bed";
  }
  if (key.includes("family")) {
    return "Family Room";
  }
  if (key.includes("twin")) {
    return "Twin";
  }
  return fallback;
}

export function normalizePaymentType(value: unknown, fallback = "Company Paid"): string {
  const key = headerKey(value);
  if (!key) {
    return fallback;
  }
  if (key.includes("upgrade")) {
    return "Upgraded Self Paid";
  }
  if (key.includes("self")) {
    return "Self Paid";
  }
  if (key.includes("company")) {
    return "Company Paid";
  }
  return fallback;
}

export function normalizeVisaStatus(value: unknown): string {
  const key = headerKey(value);
  if (!key) {
    return "";
  }
  if (key.includes("notrequired")) {
    return "Not Required";
  }
  if (key.includes("checklist")) {
    return "Checklist Shared";
  }
  if (key.includes("documentpending") || key.includes("docpending")) {
    return "Documents Pending";
  }
  if (key.includes("documentverified") || key.includes("docverified")) {
    return "Documents Verified";
  }
  if (key.includes("appointment")) {
    return "Appointment Scheduled";
  }
  if (key.includes("submitted")) {
    return "Submitted";
  }
  if (key.includes("awaiting")) {
    return "Awaiting";
  }
  if (key.includes("approved")) {
    return "Approved";
  }
  if (key.includes("rejected")) {
    return "Rejected";
  }
  if (key.includes("reapplied") || key.includes("reapply")) {
    return "Re-applied";
  }
  if (key.includes("notstarted") || key.includes("pending")) {
    return "Not Started";
  }
  return "";
}

export function normalizeImportedDate(value: unknown): string {
  if (value instanceof Date) {
    return formatDateObject(value);
  }
  if (typeof value === "number") {
    const parsed = parseExcelDateCode(value);
    if (parsed) {
      return [
        String(parsed.y).padStart(4, "0"),
        String(parsed.m).padStart(2, "0"),
        String(parsed.d).padStart(2, "0"),
      ].join("-");
    }
  }
  const text = clean(value);
  if (!text) {
    return "";
  }
  if (ISO_DATE_PREFIX_RE.test(text)) {
    return text.slice(0, 10);
  }

  const dotMatch = text.match(DMY_DATE_RE);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    const fullYear = year.length === 2 ? Number(`20${year}`) : Number(year);
    return [
      String(fullYear).padStart(4, "0"),
      String(Number(month)).padStart(2, "0"),
      String(Number(day)).padStart(2, "0"),
    ].join("-");
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return text;
}

function formatTime(value: unknown): string {
  if (value instanceof Date) {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const parsed = parseExcelDateCode(value);
    if (parsed) {
      return `${String(parsed.H).padStart(2, "0")}:${String(parsed.M).padStart(2, "0")}`;
    }
  }
  return clean(value);
}

function passengerImportKey({ contactNo, dateOfBirth, fullName }: ImportKeyInput): string {
  return [normalizedKey(fullName), normalizeImportedDate(dateOfBirth), normalizedKey(contactNo)]
    .filter(Boolean)
    .join("|");
}

function hasPassengerHeaders(row: WorkbookRow): boolean {
  return hasOldPassengerHeaders(row) || hasTicketingTemplateHeaders(row);
}

function hasOldPassengerHeaders(row: WorkbookRow): boolean {
  const headers = row.map(headerKey);
  return PASSENGER_REQUIRED_HEADERS.every((header) => headers.includes(headerKey(header)));
}

function hasTicketingTemplateHeaders(row: WorkbookRow): boolean {
  const headers = row.map(headerKey);
  return TICKETING_TEMPLATE_REQUIRED_HEADERS.every((header) => headers.includes(headerKey(header)));
}

function fullNameFromTemplateRow(row: WorkbookRow, headers: HeaderMap): string {
  const fullName = clean(
    getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"])
  );
  if (fullName) {
    return fullName;
  }
  return [
    clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"])),
    clean(getByHeader(row, headers, ["GIVEN NAME", "Given Name", "First Name"])),
  ]
    .filter(Boolean)
    .join(" ");
}

function templateNameParts(
  row: WorkbookRow,
  headers: HeaderMap
): { givenName: string; surname: string } {
  const surname = clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"]));
  const givenName = clean(
    getByHeader(row, headers, [
      "GIVEN NAME",
      "Given Name",
      "First Name",
      "Name As per Govt. ID Proof",
      "Passenger Name",
      "Full Name",
    ])
  );
  return { givenName, surname };
}

function passengerFullName(row: WorkbookRow, headers: HeaderMap): string {
  const name = clean(
    getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"])
  );
  const surname = clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"]));
  const hasTicketingNameParts = Boolean(surname && name && headers.has(headerKey("SURNAME")));
  if (hasTicketingNameParts) {
    return [name, surname].filter(Boolean).join(" ");
  }
  return name || surname;
}

function passengerNameParts(
  row: WorkbookRow,
  headers: HeaderMap
): { givenName: string; surname: string } {
  const surname = clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"]));
  const givenName = clean(
    getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"])
  );
  return { givenName, surname };
}

function adjacentCellByHeader(
  row: WorkbookRow,
  headers: HeaderMap,
  header: string,
  offset = 1
): WorkbookCellValue {
  const index = headers.get(headerKey(header));
  return index === undefined ? "" : row[index + offset];
}

function passengerTicketingFromRow(row: WorkbookRow, headers: HeaderMap): PassengerTicketingImport {
  return {
    domesticPnr: clean(getByHeader(row, headers, ["Domestic PNR"])),
    domesticTicket: clean(getByHeader(row, headers, ["Domestic ticket", "Domestic Ticket"])),
    domesticVendor: clean(adjacentCellByHeader(row, headers, "Domestic PNR")),
    internationalFare: clean(getByHeader(row, headers, ["International fare"])),
    internationalPnr: clean(getByHeader(row, headers, ["International PNR"])),
    internationalVendor: clean(adjacentCellByHeader(row, headers, "International PNR")),
  };
}

function isPassportValidForTravel(value: unknown): boolean | null {
  const key = headerKey(value);
  if (!key) {
    return null;
  }
  if (
    key === "no" ||
    key === "n" ||
    key.includes("invalid") ||
    key.includes("renewal") ||
    key.includes("expired")
  ) {
    return false;
  }
  if (key === "yes" || key === "y" || key.includes("valid")) {
    return true;
  }
  return null;
}

function passportStatusFromValidity(
  validForTravel: boolean | null,
  passportNumber: string
): string {
  if (validForTravel === false) {
    return "Pending";
  }
  return passportNumber ? "Received" : "Pending";
}

function templateImportKey({
  contactNo,
  dateOfBirth,
  fullName,
  passportNumber,
}: TemplateImportKeyInput): string {
  if (passportNumber) {
    return `passport:${passportNumber.toUpperCase()}`;
  }
  return passengerImportKey({ contactNo, dateOfBirth, fullName });
}

const TRAVEL_BATCH_HEADER_NAMES = ["Travel Batch", "Travel Batch Reference", "Batch Reference"];

function travelBatchHeaderIndex(headers: HeaderMap): number | undefined {
  for (const name of TRAVEL_BATCH_HEADER_NAMES) {
    const index = headers.get(headerKey(name));
    if (index !== undefined) {
      return index;
    }
  }
}

function travelBatchReferenceFromRow(row: WorkbookRow, headers: HeaderMap): string | undefined {
  const index = travelBatchHeaderIndex(headers);
  if (index === undefined) {
    return;
  }
  return clean(row[index]);
}

function templateRowBase({
  headers,
  importKind,
  row,
  sheetName,
  sourceRowNumber,
}: TemplateRowBaseInput): ImportedTravellerRow {
  const fullName = fullNameFromTemplateRow(row, headers);
  const nameParts = templateNameParts(row, headers);
  const dateOfBirth = normalizeImportedDate(
    getByHeader(row, headers, ["Date of Birth As per passport", "Date of Birth", "DOB"])
  );
  const contactNo = clean(
    getByHeader(row, headers, ["Contact Number", "Contact No.", "Contact No", "Mobile", "Phone"])
  );
  const passportNumber = clean(
    getByHeader(row, headers, ["Passport Number", "Passport no", "Passport No.", "Passport no "])
  );
  const passportIssueDate = normalizeImportedDate(
    getByHeader(row, headers, ["Passport Issue date", "Passport Issus date", "Passport Issue Date"])
  );
  const passportExpiryDate = normalizeImportedDate(
    getByHeader(row, headers, [
      "Passport expiry date",
      "Passport Exp",
      "Passport Expiry",
      "Passport Expiry Date",
    ])
  );
  const validForTravel = isPassportValidForTravel(
    getByHeader(row, headers, ["PP Valid for Travel Yes /No", "PP Valid for Travel Yes/No"])
  );
  const remarks = clean(
    getByHeader(row, headers, [
      "REMARKS",
      "Remarks",
      "REMARKS:  Expiry PP / Under Renewal",
      "Remarks ",
    ])
  );
  const roomType = normalizeRoomType(
    getByHeader(row, headers, ["ROOMING Category", "Rooming Category", "Room Type"])
  );
  const visaStatus = normalizeVisaStatus(
    getByHeader(row, headers, ["Status Of Visa", "Visa Status", "Status"])
  );

  return {
    biometricAppointmentDate: normalizeImportedDate(
      getByHeader(row, headers, ["Date of Appointmemt ", "Date of Appointment", "Appointment Date"])
    ),
    contactNo,
    domesticTravelRequired: false,
    foodPreference: normalizeFoodPreference(
      getByHeader(row, headers, ["Meal", "Meal Preference", "Food Preference"])
    ),
    fullName,
    gender: normalizeTravellerGender(getByHeader(row, headers, ["Gender"])),
    givenName: nameParts.givenName,
    guestType: "Client",
    hotelAllocation: importKind === "rooming" ? roomType : "",
    id: `${sheetName}:${sourceRowNumber}`,
    importKey: templateImportKey({ contactNo, dateOfBirth, fullName, passportNumber }),
    importKind,
    passport: {
      dateOfBirth,
      expiryDate: passportExpiryDate,
      issueDate: passportIssueDate,
      nationality: "UNKNOWN",
      number: passportNumber,
    },
    passportStatus: passportStatusFromValidity(validForTravel, passportNumber),
    paymentType: normalizePaymentType(
      getByHeader(row, headers, ["Company paid/ Self Paid", "Payment Type"])
    ),
    roomType,
    sourceDealerCode: clean(getByHeader(row, headers, ["Branch Code", "Code", "Dealer Code"])),
    sourceDealerName: clean(getByHeader(row, headers, ["Dealer Name", "Name"])),
    sourceDescription: clean(getByHeader(row, headers, ["Branch", "Branch "])),
    sourceRowNumber,
    sourceRsoName: clean(getByHeader(row, headers, ["Airlines", "Airline"])),
    sourceSheet: sheetName,
    sourceSoName: clean(getByHeader(row, headers, ["Base Location", "Base"])),
    specialRequests: remarks,
    surname: nameParts.surname,
    travelBatchReference: travelBatchReferenceFromRow(row, headers),
    travelHub: clean(getByHeader(row, headers, ["Hub", "Travel Hub"])),
    visaNotes: clean(getByHeader(row, headers, ["Remarks ", "Visa Remarks", "Notes"])),
    visaRequired: visaStatus ? visaStatus !== "Not Required" : true,
    visaStatus: visaStatus || undefined,
  };
}

function hasTemplateHeaders(row: WorkbookRow, requiredHeaders: string[]): boolean {
  const headerSet = new Set(row.map(headerKey));
  return requiredHeaders.every((header) => headerSet.has(headerKey(header)));
}

function findRowIndex(rows: WorkbookRow[], predicate: (row: WorkbookRow) => boolean): number {
  for (let index = 0; index < rows.length; index += 1) {
    if (predicate(rows[index])) {
      return index;
    }
  }
  return -1;
}

function parseTemplateWorkbook(
  workbook: WorkbookRows,
  { importKind, preferredSheetNames, requiredHeaders }: TemplateWorkbookOptions
): TravellerWorkbookParseResult {
  const rows: ImportedTravellerRow[] = [];
  const skipped: SpreadsheetSkippedRow[] = [];
  const errors: SpreadsheetImportError[] = [];
  const seenPassengerKeys = new Set<string>();
  const preferred = new Set<string>(preferredSheetNames.map(headerKey));
  const matchingSheetNames = workbook.SheetNames.filter((sheetName) =>
    preferred.has(headerKey(sheetName))
  );
  const sheetNames = matchingSheetNames.length > 0 ? matchingSheetNames : workbook.SheetNames;

  for (const sheetName of sheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName] ?? []);
    const headerIndex = findRowIndex(rawRows, (row) => hasTemplateHeaders(row, requiredHeaders));
    if (headerIndex < 0) {
      continue;
    }

    const headers = rowToHeaderMap(rawRows[headerIndex]);
    rawRows.slice(headerIndex + 1).forEach((row, offset) => {
      const sourceRowNumber = headerIndex + offset + 2;
      if (!hasAnyValue(row)) {
        return;
      }
      const parsed = templateRowBase({ headers, importKind, row, sheetName, sourceRowNumber });
      if (!parsed.fullName) {
        errors.push({
          id: parsed.id,
          message: "Row is missing SURNAME/GIVEN NAME or passenger name.",
          sourceRowNumber,
          sourceSheet: sheetName,
        });
        return;
      }

      const duplicateKey = parsed.passport.number
        ? `passport:${parsed.passport.number.toUpperCase()}`
        : `row:${parsed.importKey}`;
      if (seenPassengerKeys.has(duplicateKey)) {
        skipped.push({
          fullName: parsed.fullName,
          id: parsed.id,
          reason: "Duplicate passenger row already included in this upload.",
          sourceRowNumber,
          sourceSheet: sheetName,
          status: "Duplicate",
        });
        return;
      }
      seenPassengerKeys.add(duplicateKey);
      rows.push(parsed);
    });
  }

  return { errors, rows, skipped };
}

export function parseRoomingWorkbook(workbook: WorkbookRows): TravellerWorkbookParseResult {
  return parseTemplateWorkbook(workbook, {
    importKind: "rooming",
    preferredSheetNames: ["Rooming"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "ROOMING Category"],
  });
}

export function parseTravellerMasterWorkbook(workbook: WorkbookRows): TravellerWorkbookParseResult {
  return parseTemplateWorkbook(workbook, {
    importKind: "traveller",
    preferredSheetNames: ["Master list"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "Dealer Name"],
  });
}

export function parsePassportWorkbook(workbook: WorkbookRows): TravellerWorkbookParseResult {
  return parseTemplateWorkbook(workbook, {
    importKind: "passport",
    preferredSheetNames: ["Passport"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "Passport Number"],
  });
}

export function parseVisaWorkbook(workbook: WorkbookRows): TravellerWorkbookParseResult {
  return parseTemplateWorkbook(workbook, {
    importKind: "visa",
    preferredSheetNames: ["Visa"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "Status Of Visa"],
  });
}

interface PassengerRowParseInput {
  headers: HeaderMap;
  isTicketingTemplate: boolean;
  row: WorkbookRow;
  seenPassengerKeys: Set<string>;
  sheetName: string;
  sourceRowNumber: number;
}

type PassengerRowParseResult =
  | { kind: "empty" }
  | { kind: "error"; value: SpreadsheetImportError }
  | { kind: "row"; value: ImportedTravellerRow }
  | { kind: "skipped"; value: SpreadsheetSkippedRow };

function duplicatePassengerKey(passportNumber: string, importKey: string): string {
  return passportNumber ? `passport:${passportNumber.toUpperCase()}` : `row:${importKey}`;
}

function parsePassengerDataRow({
  headers,
  isTicketingTemplate,
  row,
  seenPassengerKeys,
  sheetName,
  sourceRowNumber,
}: PassengerRowParseInput): PassengerRowParseResult {
  const status = isTicketingTemplate
    ? "CONFIRMED"
    : clean(getByHeader(row, headers, ["WILLING TO GO", "Status"])).toUpperCase();
  const fullName = passengerFullName(row, headers);
  const nameParts = passengerNameParts(row, headers);
  const sourceRef = `${sheetName}:${sourceRowNumber}`;

  if (!(fullName || status)) {
    return { kind: "empty" };
  }
  if (status !== "CONFIRMED") {
    return {
      kind: "skipped",
      value: {
        fullName: fullName || clean(getByHeader(row, headers, ["Name"])),
        id: sourceRef,
        reason: "Only CONFIRMED passenger rows are imported.",
        sourceRowNumber,
        sourceSheet: sheetName,
        status: status || "Blank",
      },
    };
  }
  if (!fullName) {
    return {
      kind: "error",
      value: {
        id: sourceRef,
        message: "Confirmed row is missing Name As per Govt. ID Proof.",
        sourceRowNumber,
        sourceSheet: sheetName,
      },
    };
  }

  const dateOfBirth = normalizeImportedDate(getByHeader(row, headers, ["Date of Birth", "DOB"]));
  const contactNo = clean(
    getByHeader(row, headers, ["Contact No.", "Contact No", "Mobile", "Phone"])
  );
  const passportNumber = clean(
    getByHeader(row, headers, ["Passport no", "Passport no ", "Passport No.", "Passport Number"])
  );
  const passportExpiryDate = normalizeImportedDate(
    getByHeader(row, headers, ["Passport Exp", "Passport Expiry", "Passport Expiry Date"])
  );
  const passportIssueDate = normalizeImportedDate(
    getByHeader(row, headers, [
      "Passport Issus date",
      "Passport Issue Date",
      "Passport Issued Date",
    ])
  );
  const importKey = passengerImportKey({ contactNo, dateOfBirth, fullName });
  const duplicateKey = duplicatePassengerKey(passportNumber, importKey);

  if (seenPassengerKeys.has(duplicateKey)) {
    return {
      kind: "skipped",
      value: {
        fullName,
        id: sourceRef,
        reason: "Duplicate passenger row already included in this upload.",
        sourceRowNumber,
        sourceSheet: sheetName,
        status,
      },
    };
  }
  seenPassengerKeys.add(duplicateKey);

  const ticketing = passengerTicketingFromRow(row, headers);
  return {
    kind: "row",
    value: {
      contactNo,
      domesticTravelRequired: Boolean(
        ticketing.domesticTicket || ticketing.domesticPnr || ticketing.domesticVendor
      ),
      foodPreference: normalizeFoodPreference(
        getByHeader(row, headers, ["Meal Preference", "Food Preference"])
      ),
      fullName,
      gender: normalizeTravellerGender(getByHeader(row, headers, ["Gender"])),
      givenName: nameParts.givenName,
      guestType: "Client",
      id: sourceRef,
      importKey,
      importKind: "passenger",
      passport: {
        dateOfBirth,
        expiryDate: passportExpiryDate,
        issueDate: passportIssueDate,
        nationality: "UNKNOWN",
        number: passportNumber,
      },
      passportStatus: passportNumber ? "Received" : "Pending",
      paymentType: "Company Paid",
      roomType: "Twin",
      sourceDealerCode: clean(getByHeader(row, headers, ["Code", "Dealer Code"])),
      sourceDealerName: clean(getByHeader(row, headers, ["Name", "Dealer Name"])),
      sourceDescription: clean(getByHeader(row, headers, ["Description"])),
      sourceGroup: clean(getByHeader(row, headers, ["GROUP", "Group"])),
      sourceRowNumber,
      sourceRsoName: clean(getByHeader(row, headers, ["RSO Name"])),
      sourceSheet: sheetName,
      sourceSoName: clean(getByHeader(row, headers, ["SO Name"])),
      specialRequests: clean(getByHeader(row, headers, ["REMARKS", "REMARKS 2", "Remarks"])),
      surname: nameParts.surname,
      ticketing,
      travelBatchReference: travelBatchReferenceFromRow(row, headers),
      travelHub: clean(getByHeader(row, headers, ["Boarding Airport", "Travel Hub"])),
      visaRequired: true,
    },
  };
}

export function parsePassengerWorkbook(workbook: WorkbookRows): TravellerWorkbookParseResult {
  const rows: ImportedTravellerRow[] = [];
  const skipped: SpreadsheetSkippedRow[] = [];
  const errors: SpreadsheetImportError[] = [];
  const seenPassengerKeys = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName] ?? []);
    const headerIndex = findRowIndex(rawRows, hasPassengerHeaders);
    if (headerIndex < 0) {
      continue;
    }

    const isTicketingTemplate = hasTicketingTemplateHeaders(rawRows[headerIndex]);
    const headers = rowToHeaderMap(rawRows[headerIndex]);
    rawRows.slice(headerIndex + 1).forEach((row, offset) => {
      const sourceRowNumber = headerIndex + offset + 2;
      const parsed = parsePassengerDataRow({
        headers,
        isTicketingTemplate,
        row,
        seenPassengerKeys,
        sheetName,
        sourceRowNumber,
      });
      if (parsed.kind === "row") {
        rows.push(parsed.value);
      } else if (parsed.kind === "skipped") {
        skipped.push(parsed.value);
      } else if (parsed.kind === "error") {
        errors.push(parsed.value);
      }
    });
  }

  return { errors, rows, skipped };
}

function isFlightHeaderSlice(row: WorkbookRow, startIndex: number): boolean {
  return FLIGHT_EXPORT_HEADER.every(
    (header, offset) => headerKey(row[startIndex + offset]) === headerKey(header)
  );
}

function findFlightHeaderStart(row: WorkbookRow): number {
  for (let index = 0; index <= row.length - FLIGHT_EXPORT_HEADER.length; index += 1) {
    if (isFlightHeaderSlice(row, index)) {
      return index;
    }
  }
  return -1;
}

function hasAnyValue(row: WorkbookRow): boolean {
  return row.some((cell) => clean(cell));
}

export function parseFlightWorkbook(workbook: WorkbookRows): FlightWorkbookParseResult {
  const groups: MutableImportedFlightGroup[] = [];
  const errors: SpreadsheetImportError[] = [];

  for (const sheetName of workbook.SheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName] ?? []);
    let current: MutableImportedFlightGroup | null = null;
    let groupIndex = 0;
    let pendingTravelBatchReference = "";

    rawRows.forEach((row, rowIndex) => {
      if (headerKey(clean(row[0])) === headerKey("Travel Batch")) {
        pendingTravelBatchReference = clean(row[1]);
        return;
      }

      const headerStart = findFlightHeaderStart(row);
      if (headerStart >= 0) {
        current = {
          groupIndex,
          headerStart,
          id: `${sheetName}:${groupIndex + 1}`,
          name: `${sheetName} itinerary ${groupIndex + 1}`,
          segments: [],
          sourceSheet: sheetName,
          travelBatchReference: pendingTravelBatchReference || undefined,
        };
        pendingTravelBatchReference = "";
        groups.push(current);
        groupIndex += 1;
        return;
      }

      if (!current) {
        return;
      }
      if (!hasAnyValue(row)) {
        current = null;
        return;
      }

      const start = current.headerStart;
      const dateLabel = clean(row[start]);
      const airline = clean(row[start + 1]);
      const flightNumber = clean(row[start + 2]);
      const sourceRowNumber = rowIndex + 1;

      if (!(dateLabel || airline || flightNumber)) {
        return;
      }
      if (!flightNumber) {
        errors.push({
          id: `${sheetName}:${sourceRowNumber}`,
          message: "Flight row is missing Flight No.",
          sourceRowNumber,
          sourceSheet: sheetName,
        });
        return;
      }

      const segmentIndex = current.segments.length;
      const origin = clean(row[start + 4]);
      const destination = clean(row[start + 6]);
      current.segments.push({
        airline,
        arriveTime: formatTime(row[start + 5]),
        dateLabel,
        departTime: formatTime(row[start + 3]),
        destination,
        duration: clean(row[start + 7]),
        flightNumber,
        id: `${sheetName}:${current.groupIndex + 1}:${segmentIndex + 1}`,
        importKey: [
          normalizedKey(sheetName),
          current.groupIndex,
          segmentIndex,
          normalizedKey(flightNumber),
          normalizedKey(dateLabel),
          normalizedKey(origin),
          normalizedKey(destination),
        ].join("|"),
        origin,
        segmentIndex,
        sourceGroupIndex: current.groupIndex,
        sourceRowNumber,
        sourceSheet: sheetName,
        transit: clean(row[start + 8]),
      });
    });
  }

  return {
    errors,
    groups: groups.flatMap(({ headerStart, ...group }) =>
      group.segments.length > 0 ? [group] : []
    ),
  };
}

/** Count passengers by room type for import preview / post-upload summary. */
export function summarizeRoomTypes(
  rows: Array<{ roomType?: unknown }> | undefined
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const row of rows || []) {
    const roomType = String(row?.roomType ?? "").trim();
    if (!roomType) {
      continue;
    }
    summary[roomType] = (summary[roomType] ?? 0) + 1;
  }
  return summary;
}

export function formatRoomSummaryText(
  summary: Record<string, number> | undefined,
  jobCode?: string
): string {
  const entries = Object.entries(summary || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return "";
  }
  const prefix = jobCode ? `${jobCode}: ` : "";
  const parts = entries.map(([roomType, count]) => `${roomType} ${count}`);
  return `${prefix}${parts.join(", ")}`;
}
