import { describe, expect, test } from "bun:test";
import {
  buildFlightWorkbook,
  buildPassengerWorkbook,
  buildPassportWorkbook,
  buildRoomingWorkbook,
  buildVisaWorkbook,
  formatFoodPreferenceForExport,
} from "./spreadsheetExports";
import {
  parseFlightWorkbook,
  parsePassengerWorkbook,
  parsePassportWorkbook,
  parseRoomingWorkbook,
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
        {
          fullName: "SKIPPED GUEST",
          willingToGo: "UNABLE TO GO",
          foodPreference: "Veg",
        },
      ],
      { sheetName: "JC-0001-NS" },
    );

    const parsed = parsePassengerWorkbook(workbook);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.skipped).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      fullName: "PRADIP SEN",
      travelHub: "KOLKATA",
      foodPreference: "Non-Veg",
      sourceDealerCode: "9121004953",
      sourceDealerName: "SUDIP CEMENT SUPPLY",
      sourceGroup: "04-12 FEB",
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
