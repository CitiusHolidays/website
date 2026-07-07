import { describe, expect, test } from "bun:test";
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
          contactNo: "9836184644",
          foodPreference: "Non-Veg",
          fullName: "PRADIP SEN",
          gender: "Male",
          passport: {
            dateOfBirth: "1967-06-12",
            expiryDate: "2028-03-22",
            issueDate: "2018-03-23",
            number: "Z4619953",
          },
          sourceDealerCode: "9121004953",
          sourceDealerName: "SUDIP CEMENT SUPPLY",
          sourceDescription: "24 PGNS(NORTH)",
          sourceGroup: "04-12 FEB",
          sourceRsoName: "Rest of Bengal",
          sourceSoName: "Cossipore",
          specialRequests: "",
          travelHub: "KOLKATA",
          willingToGo: "CONFIRMED",
        },
      ],
      { sheetName: "JC-0001-NS" }
    );

    const parsed = parsePassengerWorkbook(workbook);
    const rows = workbook.Sheets["JC-0001-NS"];
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
      "Travel Batch",
    ]);
    expect(rows[1]).toEqual([
      1,
      "MR",
      "SEN",
      "PRADIP",
      "MALE",
      "Z4619953",
      "12/06/1967",
      "23/03/2018",
      "22/03/2028",
      "NON VEG",
      "9836184644",
      "",
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
      contactNo: "9836184644",
      foodPreference: "Non-Veg",
      fullName: "PRADIP SEN",
      gender: "Male",
    });
    expect(parsed.rows[0].passport).toMatchObject({
      dateOfBirth: "1967-06-12",
      expiryDate: "2028-03-22",
      issueDate: "2018-03-23",
      number: "Z4619953",
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
    contactNo: "9836184644",
    foodPreference: "Non-Veg",
    fullName: "GARG SANJAY",
    gender: "MALE",
    hotelAllocation: "Twin",
    passport: {
      dateOfBirth: "1967-06-12",
      expiryDate: "2028-03-22",
      issueDate: "2018-03-23",
      number: "Z4619953",
    },
    paymentType: "Self Paid",
    roomType: "Twin",
    sourceDealerCode: "MUM",
    sourceDealerName: "AGGARWAL APPLIANCES",
    sourceDescription: "Mumbai",
    sourceRsoName: "Kenya Airlines",
    sourceSoName: "Mumbai",
    travelBatchReference: "JC-0001 / B01",
    travelHub: "KOLKATA",
    visa: {
      appointmentDate: "2026-06-18",
      notes: "Stamped",
      status: "Approved",
    },
  };

  test("builds a traveller master workbook that the master-list parser reads", () => {
    const parsed = parseTravellerMasterWorkbook(
      buildTravellerMasterWorkbook([{ ...row, givenName: "SANJAY", surname: "GARG" }])
    );
    expect(parsed.rows[0]).toMatchObject({
      fullName: "GARG SANJAY",
      givenName: "SANJAY",
      importKind: "traveller",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceRsoName: "Kenya Airlines",
      sourceSoName: "Mumbai",
      surname: "GARG",
      travelBatchReference: "JC-0001 / B01",
      travelHub: "KOLKATA",
    });
  });

  test("builds a rooming workbook that the rooming parser reads", () => {
    const parsed = parseRoomingWorkbook(buildRoomingWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      foodPreference: "Non-Veg",
      fullName: "GARG SANJAY",
      importKind: "rooming",
      roomType: "Twin",
      travelBatchReference: "JC-0001 / B01",
    });
  });

  test("builds a passport workbook that the passport parser reads", () => {
    const parsed = parsePassportWorkbook(buildPassportWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      fullName: "GARG SANJAY",
      importKind: "passport",
      passportStatus: "Received",
      travelBatchReference: "JC-0001 / B01",
    });
    expect(parsed.rows[0].passport.number).toBe("Z4619953");
  });

  test("builds a visa workbook that the visa parser reads", () => {
    const parsed = parseVisaWorkbook(buildVisaWorkbook([row]));
    expect(parsed.rows[0]).toMatchObject({
      biometricAppointmentDate: "2026-06-18",
      fullName: "GARG SANJAY",
      importKind: "visa",
      paymentType: "Self Paid",
      travelBatchReference: "JC-0001 / B01",
      visaNotes: "Stamped",
      visaStatus: "Approved",
    });
  });
});

describe("flight spreadsheet exports", () => {
  test("builds a workbook that round-trips through the import parser", () => {
    const workbook = buildFlightWorkbook(
      [
        {
          segments: [
            {
              airline: "Kenya Airlines",
              arriveTime: "06:25",
              dateLabel: "Thu 1 Oct",
              departTime: "02:40",
              destination: "Nairobi",
              duration: "6h 15m",
              flightNumber: "203",
              origin: "Mumbai",
              transit: "-",
            },
            {
              airline: "Kenya Airlines",
              arriveTime: "01:40",
              dateLabel: "Sun 4 Oct",
              departTime: "16:45",
              destination: "Mumbai",
              duration: "6h 25m",
              flightNumber: "202",
              origin: "Nairobi",
              transit: "-",
            },
          ],
          sourceSheet: "BOM",
          travelBatchReference: "JC-0001 / B01",
        },
        {
          segments: [
            {
              airline: "Kenya Airlines",
              arriveTime: "10:30",
              dateLabel: "Thu 1 Oct",
              departTime: "06:45",
              destination: "Nairobi",
              duration: "6h 15m",
              flightNumber: "205",
              origin: "Mumbai",
              transit: "-",
            },
          ],
          sourceSheet: "BOM",
        },
      ],
      { defaultSheetName: "JC-0001-NS" }
    );

    const parsed = parseFlightWorkbook(workbook);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0].travelBatchReference).toBe("JC-0001 / B01");
    expect(parsed.groups[0].segments).toHaveLength(2);
    expect(parsed.groups[0].segments[0]).toMatchObject({
      airline: "Kenya Airlines",
      dateLabel: "Thu 1 Oct",
      destination: "Nairobi",
      flightNumber: "203",
      origin: "Mumbai",
    });
    expect(parsed.errors).toHaveLength(0);
  });
});
