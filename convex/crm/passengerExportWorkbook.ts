import ExcelJS from "exceljs";
import type {
  PassengerExportKind,
  PassengerExportRow,
  PassengerExportRowValues,
} from "../../src/lib/portal/passengerExportContract";
import {
  PASSENGER_EXPORT_HEADERS,
  PASSPORT_EXPORT_HEADERS,
  ROOMING_EXPORT_HEADERS,
  TRAVELLER_MASTER_EXPORT_HEADERS,
  VISA_EXPORT_HEADERS,
} from "../../src/lib/portal/passengerSpreadsheetHeaders";
import { hasOwnKey, type RuntimeValue } from "../lib/runtimeValues";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WHITESPACE_PATTERN = /\s+/;

function date(value: RuntimeValue) {
  const match = String(value ?? "").match(DATE_ONLY_PATTERN);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? "");
}

function gender(value: RuntimeValue) {
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

function food(value: RuntimeValue) {
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

function names(row: PassengerExportRow, surnameFirst = false) {
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

function base(row: PassengerExportRow) {
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

function passengerRow(row: PassengerExportRow, index: number): PassengerExportRowValues {
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

function travellerRow(row: PassengerExportRow, index: number): PassengerExportRowValues {
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

function roomType(value: RuntimeValue) {
  const labels = {
    "Child with Bed": "Child with Bed",
    Double: "DOUBLE",
    "Family Room": "FAMILY ROOM",
    Single: "SINGLE",
    Triple: "TRIPLE",
    Twin: "TWIN",
  } satisfies Record<string, string>;
  const label = String(value ?? "");
  return hasOwnKey(labels, label) ? labels[label] : "TWIN";
}

function roomingRow(row: PassengerExportRow, index: number): PassengerExportRowValues {
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

function passportRow(row: PassengerExportRow, index: number): PassengerExportRowValues {
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

function visaRow(row: PassengerExportRow, index: number): PassengerExportRowValues {
  const item = base(row);
  const visa = row.visa || {};
  const payment =
    row.paymentType === "Self Paid" || row.paymentType === "Upgraded Self Paid"
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
  PassengerExportKind,
  {
    headers: string[];
    row: (row: PassengerExportRow, index: number) => PassengerExportRowValues;
    sheet: string;
    suffix: string;
  }
>;

export async function buildPassengerExportFile(
  kind: PassengerExportKind,
  jobCode: string,
  rows: PassengerExportRow[]
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

export async function writePassengerExportFile(
  kind: PassengerExportKind,
  jobCode: string,
  rows: AsyncIterable<PassengerExportRow>,
  outputPath: string
) {
  const config = CONFIG[kind];
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: outputPath,
    useSharedStrings: false,
    useStyles: false,
  });
  const worksheet = workbook.addWorksheet(config.sheet);
  worksheet.addRow(config.headers).commit();
  let rowCount = 0;
  for await (const row of rows) {
    worksheet.addRow(config.row(row, rowCount)).commit();
    rowCount += 1;
  }
  worksheet.commit();
  await workbook.commit();
  return {
    fileName: `${jobCode}-${config.suffix}.xlsx`,
    rowCount,
  };
}

export function buildPassengerExportRows(
  kind: PassengerExportKind,
  rows: PassengerExportRow[]
): PassengerExportRowValues[] {
  const config = CONFIG[kind];
  return [config.headers, ...rows.map((row, index) => config.row(row, index))];
}
