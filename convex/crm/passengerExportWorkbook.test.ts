import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import ExcelJS from "exceljs";
import type { PassengerExportKind } from "../../src/lib/portal/passengerExportContract";
import { PASSENGER_EXPORT_KINDS } from "../../src/lib/portal/passengerExportContract";
import {
  PASSENGER_EXPORT_HEADERS,
  PASSPORT_EXPORT_HEADERS,
  ROOMING_EXPORT_HEADERS,
  TRAVELLER_MASTER_EXPORT_HEADERS,
  VISA_EXPORT_HEADERS,
} from "../../src/lib/portal/passengerSpreadsheetHeaders";
import {
  parsePassengerWorkbook,
  parsePassportWorkbook,
  parseRoomingWorkbook,
  parseTravellerMasterWorkbook,
  parseVisaWorkbook,
} from "../../src/lib/portal/spreadsheetImports";
import { workbookFromSheets } from "../../src/lib/portal/workbookAdapter";
import { buildPassengerExportFile, buildPassengerExportRows } from "./passengerExportWorkbook";

const row = {
  contactNo: "9999999999",
  foodPreference: "Non-Veg",
  fullName: "Asha Rao",
  gender: "Female",
  givenName: "Asha",
  hotelAllocation: "Twin",
  passport: {
    dateOfBirth: "1990-02-03",
    expiryDate: "2032-04-05",
    issueDate: "2022-04-06",
    number: "P1234567",
  },
  paymentType: "Self Paid",
  roomType: "Twin",
  sourceDealerCode: "D01",
  sourceDealerName: "Dealer",
  sourceDescription: "Branch",
  sourceRsoName: "RSO",
  sourceSoName: "SO",
  specialRequests: "Window seat",
  surname: "Rao",
  ticketing: {
    domesticPnr: "DPNR",
    domesticTicket: "DTICKET",
    domesticVendor: "",
    internationalFare: "",
    internationalPnr: "IPNR",
    internationalVendor: "",
  },
  travelBatchReference: "JC-0001 / B01",
  travelHub: "Delhi",
  visa: { appointmentDate: "2026-06-18", notes: "Stamped", status: "Approved" },
  visaStatus: "Approved",
};

const CASES = {
  passenger: {
    file: "JC-0001-ticketing-passengers.xlsx",
    headers: PASSENGER_EXPORT_HEADERS,
    sheet: "Passengers",
  },
  passport: {
    file: "JC-0001-passport.xlsx",
    headers: PASSPORT_EXPORT_HEADERS,
    sheet: "Passport",
  },
  rooming: {
    file: "JC-0001-rooming.xlsx",
    headers: ROOMING_EXPORT_HEADERS,
    sheet: "Rooming",
  },
  traveller: {
    file: "JC-0001-traveller-master.xlsx",
    headers: TRAVELLER_MASTER_EXPORT_HEADERS,
    sheet: "Master list",
  },
  visa: { file: "JC-0001-visa.xlsx", headers: VISA_EXPORT_HEADERS, sheet: "Visa" },
} satisfies Record<
  PassengerExportKind,
  { file: string; headers: readonly string[]; sheet: string }
>;

describe("Server passenger export workbooks", () => {
  for (const kind of PASSENGER_EXPORT_KINDS) {
    test(`Owns the exact ${kind} template outside browser memory`, async () => {
      const expected = CASES[kind];
      const rows = buildPassengerExportRows(kind, [row]);
      const file = await buildPassengerExportFile(kind, "JC-0001", [row]);
      const workbook = new ExcelJS.Workbook();
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await workbook.xlsx.load(fromAny<never, unknown>(file.buffer));

      expect(file.fileName).toBe(expected.file);
      expect(rows[0]).toEqual(expected.headers);
      expect(rows[1]).toHaveLength(expected.headers.length);
      expect(workbook.getWorksheet(expected.sheet)?.rowCount).toBe(2);
    });
  }

  test("Preserves representative passenger values and parser compatibility", () => {
    const rows = buildPassengerExportRows("passenger", [row]);
    expect(rows[1]).toEqual([
      1,
      "MS",
      "Rao",
      "Asha",
      "FEMALE",
      "P1234567",
      "03/02/1990",
      "06/04/2022",
      "05/04/2032",
      "NON VEG",
      "9999999999",
      "",
      "IPNR",
      "",
      "DTICKET",
      "DPNR",
      "",
      "JC-0001 / B01",
    ]);
    const parsed = parsePassengerWorkbook(workbookFromSheets({ Passengers: rows }));
    expect(parsed.rows[0]).toMatchObject({
      contactNo: "9999999999",
      foodPreference: "Non-Veg",
      fullName: "Asha Rao",
      gender: "Female",
    });
  });

  test("Round-trips every server-owned operational template", () => {
    const traveller = parseTravellerMasterWorkbook(
      workbookFromSheets({ "Master list": buildPassengerExportRows("traveller", [row]) })
    );
    const rooming = parseRoomingWorkbook(
      workbookFromSheets({ Rooming: buildPassengerExportRows("rooming", [row]) })
    );
    const passport = parsePassportWorkbook(
      workbookFromSheets({ Passport: buildPassengerExportRows("passport", [row]) })
    );
    const visa = parseVisaWorkbook(
      workbookFromSheets({ Visa: buildPassengerExportRows("visa", [row]) })
    );

    expect(traveller.rows[0]).toMatchObject({
      fullName: "Rao Asha",
      importKind: "traveller",
      travelBatchReference: "JC-0001 / B01",
    });
    expect(rooming.rows[0]).toMatchObject({
      fullName: "Rao Asha",
      importKind: "rooming",
      roomType: "Twin",
    });
    expect(passport.rows[0]).toMatchObject({
      fullName: "Rao Asha",
      importKind: "passport",
      passportStatus: "Received",
    });
    expect(visa.rows[0]).toMatchObject({
      biometricAppointmentDate: "2026-06-18",
      fullName: "Rao Asha",
      importKind: "visa",
      paymentType: "Self Paid",
      visaStatus: "Approved",
    });
  });
});
