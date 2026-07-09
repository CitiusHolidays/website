import { describe, expect, test } from "bun:test";
import {
  normalizeFoodPreference,
  normalizeRoomType,
  parseFlightWorkbook,
  parsePassengerWorkbook,
  parsePassportWorkbook,
  parseRoomingWorkbook,
  parseTravellerMasterWorkbook,
  parseVisaWorkbook,
} from "./spreadsheetImports";
import { workbookFromSheets } from "./workbookAdapter";

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
          9_121_004_953,
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
          9_836_184_644,
          "",
          "04-12 FEB",
        ],
        [
          "ACL",
          9_121_004_882,
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
      foodPreference: "Non-Veg",
      fullName: "PRADIP SEN",
      passportStatus: "Received",
      sourceDealerCode: "9121004953",
      sourceDealerName: "SUDIP CEMENT SUPPLY",
      sourceGroup: "04-12 FEB",
      travelHub: "KOLKATA",
    });
    expect(result.rows[0].passport).toMatchObject({
      dateOfBirth: "1967-06-12",
      expiryDate: "2028-03-22",
      issueDate: "2018-03-23",
      number: "Z4619953",
    });
  });

  test("reads optional travel batch reference from template rows", () => {
    const workbook = workbookFromSheets({
      Rooming: [
        ["SURNAME", "GIVEN NAME", "ROOMING Category", "Travel Batch"],
        ["GARG", "SANJAY", "TWIN", "JC-0001 / B01"],
      ],
    });

    const result = parseRoomingWorkbook(workbook);
    expect(result.rows[0]).toMatchObject({
      fullName: "GARG SANJAY",
      travelBatchReference: "JC-0001 / B01",
    });
  });

  test("omits travelBatchReference when the Travel Batch column is absent", () => {
    const workbook = workbookFromSheets({
      Rooming: [
        ["SURNAME", "GIVEN NAME", "ROOMING Category"],
        ["GARG", "SANJAY", "TWIN"],
      ],
    });

    const result = parseRoomingWorkbook(workbook);
    expect(result.rows[0].travelBatchReference).toBeUndefined();
  });

  test("keeps blank Travel Batch column as empty string for intentional unbatching", () => {
    const workbook = workbookFromSheets({
      Rooming: [
        ["SURNAME", "GIVEN NAME", "ROOMING Category", "Travel Batch"],
        ["GARG", "SANJAY", "TWIN", ""],
      ],
    });

    const result = parseRoomingWorkbook(workbook);
    expect(result.rows[0].travelBatchReference).toBe("");
  });

  test("normalizes meal preferences", () => {
    expect(normalizeFoodPreference("NON VEG")).toBe("Non-Veg");
    expect(normalizeFoodPreference("Jain Meal")).toBe("Jain");
    expect(normalizeFoodPreference("vegan")).toBe("Vegan");
    expect(normalizeFoodPreference("")).toBe("Veg");
  });

  test("normalizes room types to portal labels", () => {
    expect(normalizeRoomType("SGL")).toBe("Single");
    expect(normalizeRoomType("single")).toBe("Single");
    expect(normalizeRoomType("DBL")).toBe("Double");
    expect(normalizeRoomType("double")).toBe("Double");
    expect(normalizeRoomType("TPL")).toBe("Triple");
    expect(normalizeRoomType("triple sharing")).toBe("Triple");
    expect(normalizeRoomType("family")).toBe("Family Room");
  });

  test("deduplicates repeated passenger rows within one workbook", () => {
    const header = [
      "WILLING TO GO ",
      "Name As per Govt. ID Proof",
      "Date of Birth",
      "Passport no ",
      "Meal Preference",
    ];
    const duplicate = ["CONFIRMED", "PRADIP SEN", "1967-06-12", "Z4619953", "VEG"];
    const workbook = workbookFromSheets({
      G2: [header, duplicate],
      Sheet5: [header, duplicate],
    });
    const result = parsePassengerWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("Duplicate");
  });

  test("does not cap confirmed passenger rows in the parser", () => {
    const header = [
      "WILLING TO GO ",
      "Name As per Govt. ID Proof",
      "Date of Birth",
      "Passport no ",
      "Meal Preference",
    ];
    const rows = Array.from({ length: 150 }, (_, index) => [
      "CONFIRMED",
      `PASSENGER ${index + 1}`,
      "1967-06-12",
      `P${String(index + 1).padStart(4, "0")}`,
      "VEG",
    ]);
    const result = parsePassengerWorkbook(workbookFromSheets({ Sheet1: [header, ...rows] }));
    expect(result.rows).toHaveLength(150);
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
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

  test("imports ticketing template rows without a willing-to-go column", () => {
    const workbook = workbookFromSheets({
      Sheet1: [
        [
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
        ],
        [
          1,
          "MS",
          "AGARWAL",
          "ANSHIKA",
          "FEMALE",
          "AK429734",
          "1987-07-26",
          "2026-02-12",
          "2036-02-11",
          "VEG",
          9_932_929_359,
          55_168,
          "ICQULJ",
          "LAXMINARAYAN",
          15_281,
          "7V3C5J",
          "TBO",
        ],
      ],
    });

    const result = parsePassengerWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      contactNo: "9932929359",
      domesticTravelRequired: true,
      fullName: "ANSHIKA AGARWAL",
      gender: "Female",
      givenName: "ANSHIKA",
      passportStatus: "Received",
      surname: "AGARWAL",
      ticketing: {
        domesticPnr: "7V3C5J",
        domesticTicket: "15281",
        domesticVendor: "TBO",
        internationalFare: "55168",
        internationalPnr: "ICQULJ",
        internationalVendor: "LAXMINARAYAN",
      },
    });
    expect(result.rows[0].passport).toMatchObject({
      dateOfBirth: "1987-07-26",
      expiryDate: "2036-02-11",
      issueDate: "2026-02-12",
      number: "AK429734",
    });
  });
});

describe("master-list sheet imports", () => {
  test("parses traveller master rows from the master list sheet", () => {
    const workbook = workbookFromSheets({
      "Master list": [
        [
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
        ],
        [
          1,
          "Mumbai",
          "MUM",
          "AGGARWAL APPLIANCES",
          "MALE",
          "GARG",
          "SANJAY",
          "Z4619953",
          "2018-03-23",
          "2028-03-22",
          "1967-06-12",
          "Mumbai",
          "9836184644",
          "sanjay@example.com",
          "Mumbai",
          "NON VEG",
          "BOM",
          "Kenya Airlines",
        ],
      ],
    });

    const result = parseTravellerMasterWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      foodPreference: "Non-Veg",
      fullName: "GARG SANJAY",
      gender: "Male",
      importKind: "traveller",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceRsoName: "Kenya Airlines",
      sourceSoName: "Mumbai",
      travelHub: "BOM",
    });
    expect(result.rows[0].passport).toMatchObject({
      dateOfBirth: "1967-06-12",
      expiryDate: "2028-03-22",
      issueDate: "2018-03-23",
      number: "Z4619953",
    });
  });

  test("parses rooming rows from the rooming sheet", () => {
    const workbook = workbookFromSheets({
      Rooming: [
        [
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
        ],
        [
          1,
          "AGGARWAL APPLIANCES",
          "MALE",
          "GARG",
          "SANJAY",
          "TWIN",
          "ADJACENT ROOMS",
          "Z4619953",
          "2018-03-23",
          "2028-03-22",
          "1967-06-12",
          "",
          "9836184644",
          "",
          "NON VEG",
          "KOLKATA",
        ],
      ],
    });

    const result = parseRoomingWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      foodPreference: "Non-Veg",
      fullName: "GARG SANJAY",
      hotelAllocation: "Twin",
      importKind: "rooming",
      roomType: "Twin",
      specialRequests: "ADJACENT ROOMS",
      travelHub: "KOLKATA",
    });
  });

  test("parses passport rows from the passport sheet", () => {
    const workbook = workbookFromSheets({
      Passport: [
        [
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
        ],
        [
          1,
          "AGGARWAL APPLIANCES",
          "MALE",
          "GARG",
          "SANJAY",
          "Z4619953",
          "2018-03-23",
          "2028-03-22",
          "Yes",
          "1967-06-12",
          "Mumbai",
          "",
          "9836184644",
        ],
      ],
    });

    const result = parsePassportWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      fullName: "GARG SANJAY",
      importKind: "passport",
      passportStatus: "Received",
    });
    expect(result.rows[0].passport).toMatchObject({
      dateOfBirth: "1967-06-12",
      expiryDate: "2028-03-22",
      issueDate: "2018-03-23",
      number: "Z4619953",
    });
  });

  test("parses visa rows from the visa sheet", () => {
    const workbook = workbookFromSheets({
      Visa: [
        [
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
        ],
        [
          1,
          "AGGARWAL APPLIANCES",
          "MALE",
          "GARG",
          "SANJAY",
          "Z4619953",
          "2018-03-23",
          "2028-03-22",
          "Yes",
          "1967-06-12",
          "Mumbai",
          "",
          "9836184644",
          "Yes",
          "2026-06-18",
          "Delhi",
          "Approved",
          "Self Paid",
          1000,
          "Stamped",
        ],
      ],
    });

    const result = parseVisaWorkbook(workbook);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      biometricAppointmentDate: "2026-06-18",
      fullName: "GARG SANJAY",
      importKind: "visa",
      paymentType: "Self Paid",
      visaNotes: "Stamped",
      visaStatus: "Approved",
    });
  });
});

describe("flight spreadsheet imports", () => {
  test("parses repeated flight blocks into itinerary groups", () => {
    const workbook = workbookFromSheets({
      BOM: [
        [],
        [
          "",
          "Date",
          "Airline",
          "Flight No",
          "Depart",
          "from",
          "Arrive",
          "at",
          "Duration",
          "Transit",
        ],
        [
          "",
          "Thu 1 Oct",
          "Kenya Airlines",
          203,
          "02:40:00",
          "Mumbai",
          "06:25:00",
          "Nairobi",
          "6h 15m",
          "-",
        ],
        [
          "",
          "Sun 4 Oct",
          "Kenya Airlines",
          202,
          "16:45:00",
          "Nairobi",
          "01:40:00",
          "Mumbai",
          "6h 25m",
          "-",
        ],
        [],
        [
          "",
          "Date",
          "Airline",
          "Flight No",
          "Depart",
          "from",
          "Arrive",
          "at",
          "Duration",
          "Transit",
        ],
        [
          "",
          "Thu 1 Oct",
          "Kenya Airlines",
          205,
          "06:45:00",
          "Mumbai",
          "10:30:00",
          "Nairobi",
          "6h 15m",
          "-",
        ],
      ],
    });

    const result = parseFlightWorkbook(workbook);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].segments).toHaveLength(2);
    expect(result.groups[0].segments[0]).toMatchObject({
      airline: "Kenya Airlines",
      dateLabel: "Thu 1 Oct",
      destination: "Nairobi",
      flightNumber: "203",
      origin: "Mumbai",
    });
    expect(result.errors).toHaveLength(0);
  });

  test("reports flight rows missing flight numbers", () => {
    const workbook = workbookFromSheets({
      DEL: [
        [
          "",
          "Date",
          "Airline",
          "Flight No",
          "Depart",
          "from",
          "Arrive",
          "at",
          "Duration",
          "Transit",
        ],
        [
          "",
          "Thu 1 Oct",
          "Ethiopian Airlines",
          "",
          "02:30:00",
          "Delhi",
          "06:30:00",
          "Addis Ababa",
          "6h 30m",
          "4h 15m",
        ],
      ],
    });
    const result = parseFlightWorkbook(workbook);
    expect(result.groups).toHaveLength(0);
    expect(result.errors[0].message).toContain("Flight No");
  });
});
