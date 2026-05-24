import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import {
  normalizeFoodPreference,
  parseFlightWorkbook,
  parsePassengerWorkbook,
} from "./spreadsheetImports";

function workbookFromSheets(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return workbook;
}

describe("passenger spreadsheet imports", () => {
  test("imports confirmed passenger rows and skips other statuses", () => {
    const workbook = workbookFromSheets({
      Sheet5: [
        [],
        [
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
        ],
        [
          "ACL",
          9121004953,
          "SUDIP CEMENT SUPPLY",
          "24 PGNS(NORTH)",
          "Cossipore",
          "Rest of Bengal",
          1,
          "South Africa/Equivalent",
          "CONFIRMED",
          "KOLKATA",
          "PRADIP SEN",
          "MALE",
          "1967-06-12",
          "Z4619953",
          "2018-03-23",
          "2028-03-22",
          "NON VEG",
          9836184644,
          "",
          "04-12 FEB",
        ],
        [
          "ACL",
          9121004882,
          "DIBYENDU KUNDU",
          "CALCUTTA [ N ]",
          "Cossipore",
          "Rest of Bengal",
          1,
          "South Africa/Equivalent",
          "UNABLE TO GO",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "FAMILY PROBLEM",
          "UNABLE TO GO",
        ],
      ],
    });

    const result = parsePassengerWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      fullName: "PRADIP SEN",
      travelHub: "KOLKATA",
      foodPreference: "Non-Veg",
      passportStatus: "Received",
      sourceDealerCode: "9121004953",
      sourceDealerName: "SUDIP CEMENT SUPPLY",
      sourceGroup: "04-12 FEB",
    });
    expect(result.rows[0].passport).toMatchObject({
      number: "Z4619953",
      dateOfBirth: "1967-06-12",
      issueDate: "2018-03-23",
      expiryDate: "2028-03-22",
    });
  });

  test("normalizes meal preferences", () => {
    expect(normalizeFoodPreference("NON VEG")).toBe("Non-Veg");
    expect(normalizeFoodPreference("Jain Meal")).toBe("Jain");
    expect(normalizeFoodPreference("vegan")).toBe("Vegan");
    expect(normalizeFoodPreference("")).toBe("Veg");
  });

  test("deduplicates repeated passenger rows within one workbook", () => {
    const header = ["WILLING TO GO ", "Name As per Govt. ID Proof", "Date of Birth", "Passport no ", "Meal Preference"];
    const duplicate = ["CONFIRMED", "PRADIP SEN", "1967-06-12", "Z4619953", "VEG"];
    const workbook = workbookFromSheets({
      Sheet5: [header, duplicate],
      G2: [header, duplicate],
    });
    const result = parsePassengerWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("Duplicate");
  });

  test("reports confirmed rows missing passenger names", () => {
    const workbook = workbookFromSheets({
      G2: [
        ["WILLING TO GO ", "Name As per Govt. ID Proof"],
        ["CONFIRMED", ""],
      ],
    });
    const result = parsePassengerWorkbook(workbook);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain("missing");
  });
});

describe("flight spreadsheet imports", () => {
  test("parses repeated flight blocks into itinerary groups", () => {
    const workbook = workbookFromSheets({
      BOM: [
        [],
        ["", "Date", "Airline", "Flight No", "Depart", "from", "Arrive", "at", "Duration", "Transit"],
        ["", "Thu 1 Oct", "Kenya Airlines", 203, "02:40:00", "Mumbai", "06:25:00", "Nairobi", "6h 15m", "-"],
        ["", "Sun 4 Oct", "Kenya Airlines", 202, "16:45:00", "Nairobi", "01:40:00", "Mumbai", "6h 25m", "-"],
        [],
        ["", "Date", "Airline", "Flight No", "Depart", "from", "Arrive", "at", "Duration", "Transit"],
        ["", "Thu 1 Oct", "Kenya Airlines", 205, "06:45:00", "Mumbai", "10:30:00", "Nairobi", "6h 15m", "-"],
      ],
    });

    const result = parseFlightWorkbook(workbook);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].segments).toHaveLength(2);
    expect(result.groups[0].segments[0]).toMatchObject({
      dateLabel: "Thu 1 Oct",
      airline: "Kenya Airlines",
      flightNumber: "203",
      origin: "Mumbai",
      destination: "Nairobi",
    });
    expect(result.errors).toHaveLength(0);
  });

  test("reports flight rows missing flight numbers", () => {
    const workbook = workbookFromSheets({
      DEL: [
        ["", "Date", "Airline", "Flight No", "Depart", "from", "Arrive", "at", "Duration", "Transit"],
        ["", "Thu 1 Oct", "Ethiopian Airlines", "", "02:30:00", "Delhi", "06:30:00", "Addis Ababa", "6h 30m", "4h 15m"],
      ],
    });
    const result = parseFlightWorkbook(workbook);
    expect(result.groups).toHaveLength(0);
    expect(result.errors[0].message).toContain("Flight No");
  });
});
