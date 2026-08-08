import ExcelJS from "exceljs";
import {
  PASSENGER_EXPORT_HEADERS,
  PASSPORT_EXPORT_HEADERS,
  ROOMING_EXPORT_HEADERS,
  TRAVELLER_MASTER_EXPORT_HEADERS,
  VISA_EXPORT_HEADERS,
} from "../../src/lib/portal/passengerSpreadsheetHeaders";

type ExportKind = "passport" | "passenger" | "rooming" | "traveller" | "visa";
type ExportRow = Record<string, any>;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WHITESPACE_PATTERN = /\s+/;

function date(value: unknown) {
  const match = String(value ?? "").match(DATE_ONLY_PATTERN);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? "");
}

function gender(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized.startsWith("m")) {
    return "MALE";
  }
  if (normalized.startsWith("f")) {
    return "FEMALE";
  }
  return String(value ?? "");
}

function food(value: unknown) {
  if (value === "Non-Veg") {
    return "NON VEG";
  }
  if (value === "Jain") {
    return "JAIN";
  }
  if (value === "Vegan") {
    return "VEGAN";
  }
  return "VEG";
}

function names(row: ExportRow, surnameFirst = false) {
  if (row.surname || row.givenName) {
    return { givenName: row.givenName || row.fullName || "", surname: row.surname || "" };
  }
  const parts = String(row.fullName ?? "")
    .trim()
    .split(WHITESPACE_PATTERN)
    .filter(Boolean);
  if (parts.length <= 1) {
    return { givenName: parts[0] || "", surname: "" };
  }
  const lastName = parts.reduce((_previous, part) => part, "");
  return surnameFirst
    ? { givenName: parts.slice(1).join(" "), surname: parts[0] }
    : { givenName: parts.slice(0, -1).join(" "), surname: lastName };
}

function base(row: ExportRow) {
  const passport = row.passport || {};
  return {
    contact: row.contactNo || "",
    dealer: row.sourceDealerName || "",
    gender: gender(row.gender),
    names: names(row, true),
    passport,
    passportValid: passport.number && passport.expiryDate ? "Yes" : "",
    remarks: row.specialRequests || "",
  };
}

function passengerRow(row: ExportRow, index: number) {
  const passport = row.passport || {};
  const passengerNames = names(row);
  const ticketing = row.ticketing || {};
  const normalizedGender = gender(row.gender);
  let honorific = "";
  if (normalizedGender === "MALE") {
    honorific = "MR";
  } else if (normalizedGender === "FEMALE") {
    honorific = "MS";
  }
  return [
    index + 1,
    honorific,
    passengerNames.surname,
    passengerNames.givenName,
    gender(row.gender),
    passport.number || "",
    date(passport.dateOfBirth),
    date(passport.issueDate),
    date(passport.expiryDate),
    food(row.foodPreference),
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

function travellerRow(row: ExportRow, index: number) {
  const item = base(row);
  return [
    index + 1,
    row.sourceDescription || "",
    row.sourceDealerCode || "",
    item.dealer,
    item.gender,
    item.names.surname,
    item.names.givenName,
    item.passport.number || "",
    date(item.passport.issueDate),
    date(item.passport.expiryDate),
    date(item.passport.dateOfBirth),
    "",
    item.contact,
    "",
    row.sourceSoName || "",
    food(row.foodPreference),
    row.travelHub || "",
    row.sourceRsoName || "",
    row.travelBatchReference || "",
    "",
  ];
}

function roomType(value: unknown) {
  const labels: Record<string, string> = {
    "Child with Bed": "Child with Bed",
    Double: "DOUBLE",
    "Family Room": "FAMILY ROOM",
    Single: "SINGLE",
    Triple: "TRIPLE",
    Twin: "TWIN",
  };
  return labels[String(value ?? "")] ?? "TWIN";
}

function roomingRow(row: ExportRow, index: number) {
  const item = base(row);
  return [
    index + 1,
    item.dealer,
    item.gender,
    item.names.surname,
    item.names.givenName,
    roomType(row.roomType),
    row.hotelAllocation || item.remarks,
    item.passport.number || "",
    date(item.passport.issueDate),
    date(item.passport.expiryDate),
    date(item.passport.dateOfBirth),
    "",
    item.contact,
    "",
    food(row.foodPreference),
    row.travelHub || "",
    "",
    "",
    row.travelBatchReference || "",
    "",
  ];
}

function passportRow(row: ExportRow, index: number) {
  const item = base(row);
  return [
    index + 1,
    item.dealer,
    item.gender,
    item.names.surname,
    item.names.givenName,
    item.passport.number || "",
    date(item.passport.issueDate),
    date(item.passport.expiryDate),
    item.passportValid,
    date(item.passport.dateOfBirth),
    "",
    item.remarks,
    item.contact,
    row.travelBatchReference || "",
  ];
}

function visaRow(row: ExportRow, index: number) {
  const item = base(row);
  const visa = row.visa || {};
  const payment = ["Self Paid", "Upgraded Self Paid"].includes(row.paymentType)
    ? row.paymentType
    : "Company Paid";
  return [
    index + 1,
    item.dealer,
    item.gender,
    item.names.surname,
    item.names.givenName,
    item.passport.number || "",
    date(item.passport.issueDate),
    date(item.passport.expiryDate),
    item.passportValid,
    date(item.passport.dateOfBirth),
    "",
    item.remarks,
    item.contact,
    visa.appointmentDate ? "Yes" : "",
    date(visa.appointmentDate),
    "",
    visa.status || row.visaStatus || "",
    payment,
    "",
    visa.notes || "",
    row.travelBatchReference || "",
  ];
}

const CONFIG = {
  passenger: {
    headers: PASSENGER_EXPORT_HEADERS,
    row: passengerRow,
    sheet: "Passengers",
    suffix: "ticketing-passengers",
  },
  passport: {
    headers: PASSPORT_EXPORT_HEADERS,
    row: passportRow,
    sheet: "Passport",
    suffix: "passport",
  },
  rooming: {
    headers: ROOMING_EXPORT_HEADERS,
    row: roomingRow,
    sheet: "Rooming",
    suffix: "rooming",
  },
  traveller: {
    headers: TRAVELLER_MASTER_EXPORT_HEADERS,
    row: travellerRow,
    sheet: "Master list",
    suffix: "traveller-master",
  },
  visa: { headers: VISA_EXPORT_HEADERS, row: visaRow, sheet: "Visa", suffix: "visa" },
} satisfies Record<
  ExportKind,
  {
    headers: string[];
    row: (row: ExportRow, index: number) => any[];
    sheet: string;
    suffix: string;
  }
>;

export async function buildPassengerExportFile(
  kind: ExportKind,
  jobCode: string,
  rows: ExportRow[]
) {
  const config = CONFIG[kind];
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(config.sheet);
  worksheet.addRow(config.headers);
  rows.forEach((row, index) => {
    worksheet.addRow(config.row(row, index));
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    fileName: `${jobCode}-${config.suffix}.xlsx`,
  };
}
