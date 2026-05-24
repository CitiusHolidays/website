import * as XLSX from "xlsx";

export const PASSENGER_EXPORT_HEADERS = [
  "Opco",
  "Code",
  "Name",
  "Description",
  "SO Name",
  "RSO Name",
  "Pax",
  "Destination",
  "WILLING TO GO ",
  "Boarding Airport",
  "Name As per Govt. ID Proof",
  "Gender",
  "Date of Birth",
  "Passport no ",
  "Passport Issus date",
  "Passport Exp",
  "Meal Preference",
  "Contact No.",
  "REMARKS",
  "GROUP",
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

const PASSENGER_REQUIRED_HEADERS = [
  "Name As per Govt. ID Proof",
  "WILLING TO GO",
];

function clean(value) {
  if (value instanceof Date) {
    return formatDateObject(value);
  }
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function headerKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

function sheetRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
}

function workbookFromArrayBuffer(buffer) {
  return XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: false,
  });
}

export async function parsePassengerWorkbookFile(file) {
  return parsePassengerWorkbook(workbookFromArrayBuffer(await file.arrayBuffer()));
}

export async function parseFlightWorkbookFile(file) {
  return parseFlightWorkbook(workbookFromArrayBuffer(await file.arrayBuffer()));
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

export function normalizeImportedDate(value) {
  if (value instanceof Date) {
    return formatDateObject(value);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
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
    const parsed = XLSX.SSF.parse_date_code(value);
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
  const headers = row.map(headerKey);
  return PASSENGER_REQUIRED_HEADERS.every((header) => headers.includes(headerKey(header)));
}

export function parsePassengerWorkbook(workbook) {
  const rows = [];
  const skipped = [];
  const errors = [];
  const seenPassengerKeys = new Set();

  for (const sheetName of workbook.SheetNames) {
    const rawRows = sheetRows(workbook.Sheets[sheetName]);
    const headerIndex = rawRows.findIndex(hasPassengerHeaders);
    if (headerIndex < 0) continue;

    const headers = rowToHeaderMap(rawRows[headerIndex]);
    rawRows.slice(headerIndex + 1).forEach((row, offset) => {
      const sourceRowNumber = headerIndex + offset + 2;
      const status = clean(getByHeader(row, headers, ["WILLING TO GO", "Status"])).toUpperCase();
      const fullName = clean(getByHeader(row, headers, ["Name As per Govt. ID Proof", "Passenger Name", "Full Name"]));
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

      const dateOfBirth = normalizeImportedDate(getByHeader(row, headers, ["Date of Birth", "DOB"]));
      const contactNo = clean(getByHeader(row, headers, ["Contact No.", "Contact No", "Mobile", "Phone"]));
      const passportNumber = clean(getByHeader(row, headers, ["Passport no", "Passport no ", "Passport No.", "Passport Number"]));
      const passportExpiryDate = normalizeImportedDate(getByHeader(row, headers, ["Passport Exp", "Passport Expiry", "Passport Expiry Date"]));
      const passportIssueDate = normalizeImportedDate(getByHeader(row, headers, ["Passport Issus date", "Passport Issue Date", "Passport Issued Date"]));

      const importKey = passengerImportKey({ fullName, dateOfBirth, contactNo });
      const duplicateKey = passportNumber ? `passport:${passportNumber.toUpperCase()}` : `row:${importKey}`;
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

      rows.push({
        id: sourceRef,
        sourceSheet: sheetName,
        sourceRowNumber,
        importKey,
        fullName,
        travelHub: clean(getByHeader(row, headers, ["Boarding Airport", "Travel Hub"])),
        foodPreference: normalizeFoodPreference(getByHeader(row, headers, ["Meal Preference", "Food Preference"])),
        guestType: "Client",
        paymentType: "Company Paid",
        roomType: "Twin",
        visaRequired: true,
        domesticTravelRequired: false,
        passportStatus: passportNumber ? "Received" : "Pending",
        specialRequests: clean(getByHeader(row, headers, ["REMARKS", "REMARKS 2", "Remarks"])),
        sourceDealerCode: clean(getByHeader(row, headers, ["Code", "Dealer Code"])),
        sourceDealerName: clean(getByHeader(row, headers, ["Name", "Dealer Name"])),
        sourceDescription: clean(getByHeader(row, headers, ["Description"])),
        sourceSoName: clean(getByHeader(row, headers, ["SO Name"])),
        sourceRsoName: clean(getByHeader(row, headers, ["RSO Name"])),
        sourceGroup: clean(getByHeader(row, headers, ["GROUP", "Group"])),
        gender: clean(getByHeader(row, headers, ["Gender"])),
        contactNo,
        passport: {
          number: passportNumber,
          dateOfBirth,
          issueDate: passportIssueDate,
          expiryDate: passportExpiryDate,
          nationality: "UNKNOWN",
        },
      });
    });
  }

  return { rows, skipped, errors };
}

function isFlightHeaderSlice(row, startIndex) {
  return FLIGHT_EXPORT_HEADER.every((header, offset) => headerKey(row[startIndex + offset]) === headerKey(header));
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
    const rawRows = sheetRows(workbook.Sheets[sheetName]);
    let current = null;
    let groupIndex = 0;

    rawRows.forEach((row, rowIndex) => {
      const headerStart = findFlightHeaderStart(row);
      if (headerStart >= 0) {
        current = {
          id: `${sheetName}:${groupIndex + 1}`,
          sourceSheet: sheetName,
          groupIndex,
          headerStart,
          name: `${sheetName} itinerary ${groupIndex + 1}`,
          segments: [],
        };
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
    groups: groups
      .filter((group) => group.segments.length > 0)
      .map(({ headerStart, ...group }) => group),
    errors,
  };
}
