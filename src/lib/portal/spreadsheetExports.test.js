import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import {
  buildFlightWorkbook,
  buildPassengerWorkbook,
  buildPassportWorkbook,
  buildRoomingWorkbook,
  buildTravellerMasterWorkbook,
  buildVisaWorkbook,
  formatFoodPreferenceForExport,
} from "./spreadsheetExports";
import {
  parseFlightWorkbook,
  parsePassengerWorkbook,
  parsePassportWorkbook,
  parseRoomingWorkbook,
  parseTravellerMasterWorkbook,
  parseVisaWorkbook,
} from "./spreadsheetImports";

describe("passenger spreadsheet exports", () => {
  test("builds a workbook that round-trips through the import parser", () => {
    const workbook = buildPassengerWorkbook(
      [
        {
          fullName: "PRADIP SEN",
          travelHub: "KOLKATA",
          foodPreference: "Non-Veg",
          gender: "MALE",
          contactNo: "9836184644",
          specialRequests: "",
          sourceDealerCode: "9121004953",
          sourceDealerName: "SUDIP CEMENT SUPPLY",
          sourceDescription: "24 PGNS(NORTH)",
          sourceSoName: "Cossipore",
          sourceRsoName: "Rest of Bengal",
          sourceGroup: "04-12 FEB",
          willingToGo: "CONFIRMED",
          passport: {
            number: "Z4619953",
            dateOfBirth: "1967-06-12",
            issueDate: "2018-03-23",
            expiryDate: "2028-03-22",
          },
        },
      ],
      { sheetName: "JC-0001-NS" },
    );

    const parsed = parsePassengerWorkbook(workbook);
    const sheet = workbook.Sheets["JC-0001-NS"];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    expect(rows[0]).toEqual([
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
    ]);
    expect(rows[1]).toEqual([
      1,
      "MR",
      "SEN",
      "PRADIP",
      "MALE",
      "Z4619953",
      "1967-06-12",
      "2018-03-23",
      "2028-03-22",
      "NON VEG",
      "9836184644",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.skipped).toHaveLength(0);
    expect(parsed.rows[0]).toMatchObject({
      fullName: "PRADIP SEN",
      foodPreference: "Non-Veg",
      gender: "MALE",
      contactNo: "9836184644",
    });
    expect(parsed.rows[0].passport).toMatchObject({
      number: "Z4619953",
      dateOfBirth: "1967-06-12",
      issueDate: "2018-03-23",
      expiryDate: "2028-03-22",
    });
  });

  test("formats meal preferences for export", () => {
    expect(formatFoodPreferenceForExport("Non-Veg")).toBe("NON VEG");
    expect(formatFoodPreferenceForExport("Jain")).toBe("JAIN");
    expect(formatFoodPreferenceForExport("Vegan")).toBe("VEGAN");
    expect(formatFoodPreferenceForExport("Veg")).toBe("VEG");
  });
});

describe("master-list sheet exports", () => {
  const row = {
    fullName: "GARG SANJAY",
    sourceDealerName: "AGGARWAL APPLIANCES",
    sourceDealerCode: "MUM",
    sourceDescription: "Mumbai",
    sourceSoName: "Mumbai",
    sourceRsoName: "Kenya Airlines",
    gender: "MALE",
    roomType: "Twin",
    hotelAllocation: "Twin",
    foodPreference: "Non-Veg",
    travelHub: "KOLKATA",
    contactNo: "9836184644",
    paymentType: "Self Paid",
    passport: {
      number: "Z4619953",
      dateOfBirth: "1967-06-12",
      issueDate: "2018-03-23",
      expiryDate: "2028-03-22",
    },
    visa: {
      status: "Approved",
      appointmentDate: "2026-06-18",
      notes: "Stamped",
    },
  };

  test("builds a traveller master workbook that the master-list parser reads", () => {
    const parsed = parseTravellerMasterWorkbook(buildTravellerMasterWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      importKind: "traveller",
      fullName: "GARG SANJAY",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceSoName: "Mumbai",
      sourceRsoName: "Kenya Airlines",
      travelHub: "KOLKATA",
    });
  });

  test("builds a rooming workbook that the rooming parser reads", () => {
    const parsed = parseRoomingWorkbook(buildRoomingWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      importKind: "rooming",
      fullName: "GARG SANJAY",
      roomType: "Twin",
      foodPreference: "Non-Veg",
    });
  });

  test("builds a passport workbook that the passport parser reads", () => {
    const parsed = parsePassportWorkbook(buildPassportWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      importKind: "passport",
      fullName: "GARG SANJAY",
      passportStatus: "Received",
    });
    expect(parsed.rows[0].passport.number).toBe("Z4619953");
  });

  test("builds a visa workbook that the visa parser reads", () => {
    const parsed = parseVisaWorkbook(buildVisaWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      importKind: "visa",
      fullName: "GARG SANJAY",
      visaStatus: "Approved",
      paymentType: "Self Paid",
      biometricAppointmentDate: "2026-06-18",
      visaNotes: "Stamped",
    });
  });
});

describe("flight spreadsheet exports", () => {
  test("builds a workbook that round-trips through the import parser", () => {
    const workbook = buildFlightWorkbook(
      [
        {
          sourceSheet: "BOM",
          segments: [
            {
              dateLabel: "Thu 1 Oct",
              airline: "Kenya Airlines",
              flightNumber: "203",
              departTime: "02:40",
              origin: "Mumbai",
              arriveTime: "06:25",
              destination: "Nairobi",
              duration: "6h 15m",
              transit: "-",
            },
            {
              dateLabel: "Sun 4 Oct",
              airline: "Kenya Airlines",
              flightNumber: "202",
              departTime: "16:45",
              origin: "Nairobi",
              arriveTime: "01:40",
              destination: "Mumbai",
              duration: "6h 25m",
              transit: "-",
            },
          ],
        },
        {
          sourceSheet: "BOM",
          segments: [
            {
              dateLabel: "Thu 1 Oct",
              airline: "Kenya Airlines",
              flightNumber: "205",
              departTime: "06:45",
              origin: "Mumbai",
              arriveTime: "10:30",
              destination: "Nairobi",
              duration: "6h 15m",
              transit: "-",
            },
          ],
        },
      ],
      { defaultSheetName: "JC-0001-NS" },
    );

    const parsed = parseFlightWorkbook(workbook);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0].segments).toHaveLength(2);
    expect(parsed.groups[0].segments[0]).toMatchObject({
      dateLabel: "Thu 1 Oct",
      airline: "Kenya Airlines",
      flightNumber: "203",
      origin: "Mumbai",
      destination: "Nairobi",
    });
    expect(parsed.errors).toHaveLength(0);
  });
});
