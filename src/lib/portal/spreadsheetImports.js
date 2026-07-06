import { normalizeTravellerGender } from "./travellerSummary";
import { parseExcelDateCode, workbookRowsFromArrayBuffer } from "./workbookAdapter";

export { workbookFromSheets } from "./workbookAdapter";

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

function clean(value) {
  if (value instanceof Date) {
    return formatDateObject(value);
  }
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizedKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rowToHeaderMap(row) {
  const map = new Map();
  row.forEach((cell, index) => {
    const key = headerKey(cell);
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

function getByHeader(row, headers, names) {
  for (const name of names) {
    const index = headers.get(headerKey(name));
    if (index !== undefined) {
      return row[index];
    }
  }
  return "";
}

function sheetRows(rowArrays) {
  return rowArrays ?? [];
}

export async function parsePassengerWorkbookFile(file) {
  return parsePassengerWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

export async function parseFlightWorkbookFile(file) {
  return parseFlightWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

export async function parseTravellerMasterWorkbookFile(file) {
  return parseTravellerMasterWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

export async function parseRoomingWorkbookFile(file) {
  return parseRoomingWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

export async function parsePassportWorkbookFile(file) {
  return parsePassportWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

export async function parseVisaWorkbookFile(file) {
  return parseVisaWorkbook(await workbookRowsFromArrayBuffer(await file.arrayBuffer()));
}

function formatDateObject(value) {
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function normalizeFoodPreference(value) {
  const key = headerKey(value);
  if (!key) return "Veg";
  if (key.includes("nonveg") || key.includes("nonvegetarian")) return "Non-Veg";
  if (key.includes("jain")) return "Jain";
  if (key.includes("vegan")) return "Vegan";
  return "Veg";
}

export function normalizeRoomType(value, fallback = "Twin") {
  const key = headerKey(value);
  if (!key) return fallback;
  if (key.includes("single") || key === "sgl") return "Single";
  if (key.includes("double") || key === "dbl") return "Double";
  if (key.includes("triple") || key === "tpl") return "Triple";
  if (key.includes("child")) return "Child with Bed";
  if (key.includes("family")) return "Family Room";
  if (key.includes("twin")) return "Twin";
  return fallback;
}

export function normalizePaymentType(value, fallback = "Company Paid") {
  const key = headerKey(value);
  if (!key) return fallback;
  if (key.includes("upgrade")) return "Upgraded Self Paid";
  if (key.includes("self")) return "Self Paid";
  if (key.includes("company")) return "Company Paid";
  return fallback;
}

export function normalizeVisaStatus(value) {
  const key = headerKey(value);
  if (!key) return "";
  if (key.includes("notrequired")) return "Not Required";
  if (key.includes("checklist")) return "Checklist Shared";
  if (key.includes("documentpending") || key.includes("docpending")) return "Documents Pending";
  if (key.includes("documentverified") || key.includes("docverified")) return "Documents Verified";
  if (key.includes("appointment")) return "Appointment Scheduled";
  if (key.includes("submitted")) return "Submitted";
  if (key.includes("awaiting")) return "Awaiting";
  if (key.includes("approved")) return "Approved";
  if (key.includes("rejected")) return "Rejected";
  if (key.includes("reapplied") || key.includes("reapply")) return "Re-applied";
  if (key.includes("notstarted") || key.includes("pending")) return "Not Started";
  return "";
}

export function normalizeImportedDate(value) {
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
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
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

function formatTime(value) {
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

function passengerImportKey({ fullName, dateOfBirth, contactNo }) {
  return [normalizedKey(fullName), normalizeImportedDate(dateOfBirth), normalizedKey(contactNo)]
    .filter(Boolean)
    .join("|");
}

function hasPassengerHeaders(row) {
  return hasOldPassengerHeaders(row) || hasTicketingTemplateHeaders(row);
}

function hasOldPassengerHeaders(row) {
  const headers = row.map(headerKey);
  return PASSENGER_REQUIRED_HEADERS.every((header) => headers.includes(headerKey(header)));
}

function hasTicketingTemplateHeaders(row) {
  const headers = row.map(headerKey);
  return TICKETING_TEMPLATE_REQUIRED_HEADERS.every((header) => headers.includes(headerKey(header)));
}

function fullNameFromTemplateRow(row, headers) {
  const fullName = clean(
    getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"]),
  );
  if (fullName) return fullName;
  return [
    clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"])),
    clean(getByHeader(row, headers, ["GIVEN NAME", "Given Name", "First Name"])),
  ]
    .filter(Boolean)
    .join(" ");
}

function templateNameParts(row, headers) {
  const surname = clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"]));
  const givenName = clean(
    getByHeader(row, headers, [
      "GIVEN NAME",
      "Given Name",
      "First Name",
      "Name As per Govt. ID Proof",
      "Passenger Name",
      "Full Name",
    ]),
  );
  return { surname, givenName };
}

function passengerFullName(row, headers) {
  const name = clean(
    getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"]),
  );
  const surname = clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"]));
  const hasTicketingNameParts = Boolean(surname && name && headers.has(headerKey("SURNAME")));
  if (hasTicketingNameParts) return [name, surname].filter(Boolean).join(" ");
  return name || surname;
}

function passengerNameParts(row, headers) {
  const surname = clean(getByHeader(row, headers, ["SURNAME", "Surname", "Last Name"]));
  const givenName = clean(
    getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"]),
  );
  return { surname, givenName };
}

function adjacentCellByHeader(row, headers, header, offset = 1) {
  const index = headers.get(headerKey(header));
  return index === undefined ? "" : row[index + offset];
}

function passengerTicketingFromRow(row, headers) {
  return {
    internationalFare: clean(getByHeader(row, headers, ["International fare"])),
    internationalPnr: clean(getByHeader(row, headers, ["International PNR"])),
    internationalVendor: clean(adjacentCellByHeader(row, headers, "International PNR")),
    domesticTicket: clean(getByHeader(row, headers, ["Domestic ticket", "Domestic Ticket"])),
    domesticPnr: clean(getByHeader(row, headers, ["Domestic PNR"])),
    domesticVendor: clean(adjacentCellByHeader(row, headers, "Domestic PNR")),
  };
}

function isPassportValidForTravel(value) {
  const key = headerKey(value);
  if (!key) return null;
  if (
    key === "no" ||
    key === "n" ||
    key.includes("invalid") ||
    key.includes("renewal") ||
    key.includes("expired")
  )
    return false;
  if (key === "yes" || key === "y" || key.includes("valid")) return true;
  return null;
}

function templateImportKey({ fullName, dateOfBirth, contactNo, passportNumber }) {
  if (passportNumber) return `passport:${passportNumber.toUpperCase()}`;
  return passengerImportKey({ fullName, dateOfBirth, contactNo });
}

const TRAVEL_BATCH_HEADER_NAMES = ["Travel Batch", "Travel Batch Reference", "Batch Reference"];

function travelBatchHeaderIndex(headers) {
  for (const name of TRAVEL_BATCH_HEADER_NAMES) {
    const index = headers.get(headerKey(name));
    if (index !== undefined) {
      return index;
    }
  }
  return undefined;
}

function travelBatchReferenceFromRow(row, headers) {
  const index = travelBatchHeaderIndex(headers);
  if (index === undefined) {
    return undefined;
  }
  return clean(row[index]);
}

function templateRowBase({ row, headers, sheetName, sourceRowNumber, importKind }) {
  const fullName = fullNameFromTemplateRow(row, headers);
  const nameParts = templateNameParts(row, headers);
  const dateOfBirth = normalizeImportedDate(
    getByHeader(row, headers, ["Date of Birth As per passport", "Date of Birth", "DOB"]),
  );
  const contactNo = clean(
    getByHeader(row, headers, ["Contact Number", "Contact No.", "Contact No", "Mobile", "Phone"]),
  );
  const passportNumber = clean(
    getByHeader(row, headers, ["Passport Number", "Passport no", "Passport No.", "Passport no "]),
  );
  const passportIssueDate = normalizeImportedDate(
    getByHeader(row, headers, [
      "Passport Issue date",
      "Passport Issus date",
      "Passport Issue Date",
    ]),
  );
  const passportExpiryDate = normalizeImportedDate(
    getByHeader(row, headers, [
      "Passport expiry date",
      "Passport Exp",
      "Passport Expiry",
      "Passport Expiry Date",
    ]),
  );
  const validForTravel = isPassportValidForTravel(
    getByHeader(row, headers, ["PP Valid for Travel Yes /No", "PP Valid for Travel Yes/No"]),
  );
  const remarks = clean(
    getByHeader(row, headers, [
      "REMARKS",
      "Remarks",
      "REMARKS:  Expiry PP / Under Renewal",
      "Remarks ",
    ]),
  );
  const roomType = normalizeRoomType(
    getByHeader(row, headers, ["ROOMING Category", "Rooming Category", "Room Type"]),
  );
  const visaStatus = normalizeVisaStatus(
    getByHeader(row, headers, ["Status Of Visa", "Visa Status", "Status"]),
  );

  return {
    id: `${sheetName}:${sourceRowNumber}`,
    sourceSheet: sheetName,
    sourceRowNumber,
    importKind,
    importKey: templateImportKey({ fullName, dateOfBirth, contactNo, passportNumber }),
    travelBatchReference: travelBatchReferenceFromRow(row, headers),
    fullName,
    surname: nameParts.surname,
    givenName: nameParts.givenName,
    travelHub: clean(getByHeader(row, headers, ["Hub", "Travel Hub"])),
    foodPreference: normalizeFoodPreference(
      getByHeader(row, headers, ["Meal", "Meal Preference", "Food Preference"]),
    ),
    guestType: "Client",
    paymentType: normalizePaymentType(
      getByHeader(row, headers, ["Company paid/ Self Paid", "Payment Type"]),
    ),
    roomType,
    visaRequired: visaStatus ? visaStatus !== "Not Required" : true,
    domesticTravelRequired: false,
    passportStatus: validForTravel === false ? "Pending" : passportNumber ? "Received" : "Pending",
    specialRequests: remarks,
    hotelAllocation: importKind === "rooming" ? roomType : "",
    sourceDealerCode: clean(getByHeader(row, headers, ["Branch Code", "Code", "Dealer Code"])),
    sourceDealerName: clean(getByHeader(row, headers, ["Dealer Name", "Name"])),
    sourceDescription: clean(getByHeader(row, headers, ["Branch", "Branch "])),
    sourceSoName: clean(getByHeader(row, headers, ["Base Location", "Base"])),
    sourceRsoName: clean(getByHeader(row, headers, ["Airlines", "Airline"])),
    gender: normalizeTravellerGender(getByHeader(row, headers, ["Gender"])),
    contactNo,
    passport: {
      number: passportNumber,
      dateOfBirth,
      issueDate: passportIssueDate,
      expiryDate: passportExpiryDate,
      nationality: "UNKNOWN",
    },
    visaStatus: visaStatus || undefined,
    biometricAppointmentDate: normalizeImportedDate(
      getByHeader(row, headers, [
        "Date of Appointmemt ",
        "Date of Appointment",
        "Appointment Date",
      ]),
    ),
    visaNotes: clean(getByHeader(row, headers, ["Remarks ", "Visa Remarks", "Notes"])),
  };
}

function hasTemplateHeaders(row, requiredHeaders) {
  const headers = row.map(headerKey);
  return requiredHeaders.every((header) => headers.includes(headerKey(header)));
}

function findRowIndex(rows, predicate) {
  for (let index = 0; index < rows.length; index += 1) {
    if (predicate(rows[index])) {
      return index;
    }
  }
  return -1;
}

function parseTemplateWorkbook(workbook, { importKind, preferredSheetNames, requiredHeaders }) {
  const rows = [];
  const skipped = [];
  const errors = [];
  const seenPassengerKeys = new Set();
  const preferred = new Set(preferredSheetNames.map(headerKey));
  const matchingSheetNames = workbook.SheetNames.filter((sheetName) =>
    preferred.has(headerKey(sheetName)),
  );
  const sheetNames = matchingSheetNames.length > 0 ? matchingSheetNames : workbook.SheetNames;

  for (const sheetName of sheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName] ?? []);
    const headerIndex = findRowIndex(rawRows, (row) => hasTemplateHeaders(row, requiredHeaders));
    if (headerIndex < 0) continue;

    const headers = rowToHeaderMap(rawRows[headerIndex]);
    rawRows.slice(headerIndex + 1).forEach((row, offset) => {
      const sourceRowNumber = headerIndex + offset + 2;
      if (!hasAnyValue(row)) return;
      const parsed = templateRowBase({ row, headers, sheetName, sourceRowNumber, importKind });
      if (!parsed.fullName) {
        errors.push({
          id: parsed.id,
          sourceSheet: sheetName,
          sourceRowNumber,
          message: "Row is missing SURNAME/GIVEN NAME or passenger name.",
        });
        return;
      }

      const duplicateKey = parsed.passport.number
        ? `passport:${parsed.passport.number.toUpperCase()}`
        : `row:${parsed.importKey}`;
      if (seenPassengerKeys.has(duplicateKey)) {
        skipped.push({
          id: parsed.id,
          sourceSheet: sheetName,
          sourceRowNumber,
          fullName: parsed.fullName,
          status: "Duplicate",
          reason: "Duplicate passenger row already included in this upload.",
        });
        return;
      }
      seenPassengerKeys.add(duplicateKey);
      rows.push(parsed);
    });
  }

  return { rows, skipped, errors };
}

export function parseRoomingWorkbook(workbook) {
  return parseTemplateWorkbook(workbook, {
    importKind: "rooming",
    preferredSheetNames: ["Rooming"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "ROOMING Category"],
  });
}

export function parseTravellerMasterWorkbook(workbook) {
  return parseTemplateWorkbook(workbook, {
    importKind: "traveller",
    preferredSheetNames: ["Master list"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "Dealer Name"],
  });
}

export function parsePassportWorkbook(workbook) {
  return parseTemplateWorkbook(workbook, {
    importKind: "passport",
    preferredSheetNames: ["Passport"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "Passport Number"],
  });
}

export function parseVisaWorkbook(workbook) {
  return parseTemplateWorkbook(workbook, {
    importKind: "visa",
    preferredSheetNames: ["Visa"],
    requiredHeaders: ["SURNAME", "GIVEN NAME", "Status Of Visa"],
  });
}

export function parsePassengerWorkbook(workbook) {
  const rows = [];
  const skipped = [];
  const errors = [];
  const seenPassengerKeys = new Set();

  for (const sheetName of workbook.SheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName] ?? []);
    const headerIndex = findRowIndex(rawRows, hasPassengerHeaders);
    if (headerIndex < 0) continue;

    const isTicketingTemplate = hasTicketingTemplateHeaders(rawRows[headerIndex]);
    const headers = rowToHeaderMap(rawRows[headerIndex]);
    rawRows.slice(headerIndex + 1).forEach((row, offset) => {
      const sourceRowNumber = headerIndex + offset + 2;
      const status = isTicketingTemplate
        ? "CONFIRMED"
        : clean(getByHeader(row, headers, ["WILLING TO GO", "Status"])).toUpperCase();
      const fullName = passengerFullName(row, headers);
      const nameParts = passengerNameParts(row, headers);
      const sourceRef = `${sheetName}:${sourceRowNumber}`;

      if (!fullName && !status) return;
      if (status !== "CONFIRMED") {
        skipped.push({
          id: sourceRef,
          sourceSheet: sheetName,
          sourceRowNumber,
          fullName: fullName || clean(getByHeader(row, headers, ["Name"])),
          status: status || "Blank",
          reason: "Only CONFIRMED passenger rows are imported.",
        });
        return;
      }
      if (!fullName) {
        errors.push({
          id: sourceRef,
          sourceSheet: sheetName,
          sourceRowNumber,
          message: "Confirmed row is missing Name As per Govt. ID Proof.",
        });
        return;
      }

      const dateOfBirth = normalizeImportedDate(
        getByHeader(row, headers, ["Date of Birth", "DOB"]),
      );
      const contactNo = clean(
        getByHeader(row, headers, ["Contact No.", "Contact No", "Mobile", "Phone"]),
      );
      const passportNumber = clean(
        getByHeader(row, headers, [
          "Passport no",
          "Passport no ",
          "Passport No.",
          "Passport Number",
        ]),
      );
      const passportExpiryDate = normalizeImportedDate(
        getByHeader(row, headers, ["Passport Exp", "Passport Expiry", "Passport Expiry Date"]),
      );
      const passportIssueDate = normalizeImportedDate(
        getByHeader(row, headers, [
          "Passport Issus date",
          "Passport Issue Date",
          "Passport Issued Date",
        ]),
      );

      const importKey = passengerImportKey({ fullName, dateOfBirth, contactNo });
      const duplicateKey = passportNumber
        ? `passport:${passportNumber.toUpperCase()}`
        : `row:${importKey}`;
      if (seenPassengerKeys.has(duplicateKey)) {
        skipped.push({
          id: sourceRef,
          sourceSheet: sheetName,
          sourceRowNumber,
          fullName,
          status,
          reason: "Duplicate passenger row already included in this upload.",
        });
        return;
      }
      seenPassengerKeys.add(duplicateKey);

      const ticketing = passengerTicketingFromRow(row, headers);

      rows.push({
        id: sourceRef,
        sourceSheet: sheetName,
        sourceRowNumber,
        importKind: "passenger",
        importKey,
        travelBatchReference: travelBatchReferenceFromRow(row, headers),
        fullName,
        surname: nameParts.surname,
        givenName: nameParts.givenName,
        travelHub: clean(getByHeader(row, headers, ["Boarding Airport", "Travel Hub"])),
        foodPreference: normalizeFoodPreference(
          getByHeader(row, headers, ["Meal Preference", "Food Preference"]),
        ),
        guestType: "Client",
        paymentType: "Company Paid",
        roomType: "Twin",
        visaRequired: true,
        domesticTravelRequired: Boolean(
          ticketing.domesticTicket || ticketing.domesticPnr || ticketing.domesticVendor,
        ),
        passportStatus: passportNumber ? "Received" : "Pending",
        specialRequests: clean(getByHeader(row, headers, ["REMARKS", "REMARKS 2", "Remarks"])),
        sourceDealerCode: clean(getByHeader(row, headers, ["Code", "Dealer Code"])),
        sourceDealerName: clean(getByHeader(row, headers, ["Name", "Dealer Name"])),
        sourceDescription: clean(getByHeader(row, headers, ["Description"])),
        sourceSoName: clean(getByHeader(row, headers, ["SO Name"])),
        sourceRsoName: clean(getByHeader(row, headers, ["RSO Name"])),
        sourceGroup: clean(getByHeader(row, headers, ["GROUP", "Group"])),
        gender: normalizeTravellerGender(getByHeader(row, headers, ["Gender"])),
        contactNo,
        passport: {
          number: passportNumber,
          dateOfBirth,
          issueDate: passportIssueDate,
          expiryDate: passportExpiryDate,
          nationality: "UNKNOWN",
        },
        ticketing,
      });
    });
  }

  return { rows, skipped, errors };
}

function isFlightHeaderSlice(row, startIndex) {
  return FLIGHT_EXPORT_HEADER.every(
    (header, offset) => headerKey(row[startIndex + offset]) === headerKey(header),
  );
}

function findFlightHeaderStart(row) {
  for (let index = 0; index <= row.length - FLIGHT_EXPORT_HEADER.length; index += 1) {
    if (isFlightHeaderSlice(row, index)) return index;
  }
  return -1;
}

function hasAnyValue(row) {
  return row.some((cell) => clean(cell));
}

export function parseFlightWorkbook(workbook) {
  const groups = [];
  const errors = [];

  for (const sheetName of workbook.SheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName] ?? []);
    let current = null;
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
          id: `${sheetName}:${groupIndex + 1}`,
          sourceSheet: sheetName,
          groupIndex,
          headerStart,
          name: `${sheetName} itinerary ${groupIndex + 1}`,
          travelBatchReference: pendingTravelBatchReference || undefined,
          segments: [],
        };
        pendingTravelBatchReference = "";
        groups.push(current);
        groupIndex += 1;
        return;
      }

      if (!current) return;
      if (!hasAnyValue(row)) {
        current = null;
        return;
      }

      const start = current.headerStart;
      const dateLabel = clean(row[start]);
      const airline = clean(row[start + 1]);
      const flightNumber = clean(row[start + 2]);
      const sourceRowNumber = rowIndex + 1;

      if (!dateLabel && !airline && !flightNumber) return;
      if (!flightNumber) {
        errors.push({
          id: `${sheetName}:${sourceRowNumber}`,
          sourceSheet: sheetName,
          sourceRowNumber,
          message: "Flight row is missing Flight No.",
        });
        return;
      }

      const segmentIndex = current.segments.length;
      const origin = clean(row[start + 4]);
      const destination = clean(row[start + 6]);
      current.segments.push({
        id: `${sheetName}:${current.groupIndex + 1}:${segmentIndex + 1}`,
        sourceSheet: sheetName,
        sourceRowNumber,
        sourceGroupIndex: current.groupIndex,
        segmentIndex,
        importKey: [
          normalizedKey(sheetName),
          current.groupIndex,
          segmentIndex,
          normalizedKey(flightNumber),
          normalizedKey(dateLabel),
          normalizedKey(origin),
          normalizedKey(destination),
        ].join("|"),
        dateLabel,
        airline,
        flightNumber,
        departTime: formatTime(row[start + 3]),
        origin,
        arriveTime: formatTime(row[start + 5]),
        destination,
        duration: clean(row[start + 7]),
        transit: clean(row[start + 8]),
      });
    });
  }

  return {
    groups: groups.flatMap(({ headerStart, ...group }) =>
      group.segments.length > 0 ? [group] : [],
    ),
    errors,
  };
}

/** Count passengers by room type for import preview / post-upload summary. */
export function summarizeRoomTypes(rows) {
  const summary = {};
  for (const row of rows || []) {
    const roomType = String(row?.roomType ?? "").trim();
    if (!roomType) continue;
    summary[roomType] = (summary[roomType] ?? 0) + 1;
  }
  return summary;
}

export function formatRoomSummaryText(summary, jobCode) {
  const entries = Object.entries(summary || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  const prefix = jobCode ? `${jobCode}: ` : "";
  const parts = entries.map(([roomType, count]) => `${roomType} ${count}`);
  return `${prefix}${parts.join(", ")}`;
}
