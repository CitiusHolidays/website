import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { buildPassengerExportFile } from "./passengerExportWorkbook";

const row = {
  contactNo: "9999999999",
  foodPreference: "Veg",
  fullName: "Asha Rao",
  gender: "Female",
  givenName: "Asha",
  hotelAllocation: "",
  passport: {
    dateOfBirth: "1990-02-03",
    expiryDate: "2032-04-05",
    issueDate: "2022-04-06",
    number: "P1234567",
  },
  paymentType: "Company Paid",
  roomType: "Twin",
  sourceDealerCode: "D01",
  sourceDealerName: "Dealer",
  sourceDescription: "Branch",
  sourceRsoName: "RSO",
  sourceSoName: "SO",
  specialRequests: "",
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
  visa: { appointmentDate: "", notes: "", status: "Not Started" },
  visaStatus: "Not Started",
};

describe("server passenger export workbooks", () => {
  for (const [kind, expected] of Object.entries({
    passenger: { file: "JC-0001-ticketing-passengers.xlsx", sheet: "Passengers" },
    passport: { file: "JC-0001-passport.xlsx", sheet: "Passport" },
    rooming: { file: "JC-0001-rooming.xlsx", sheet: "Rooming" },
    traveller: { file: "JC-0001-traveller-master.xlsx", sheet: "Master list" },
    visa: { file: "JC-0001-visa.xlsx", sheet: "Visa" },
  })) {
    test(`builds the ${kind} workbook outside browser memory`, async () => {
      const file = await buildPassengerExportFile(kind as never, "JC-0001", [row]);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as never);
      expect(file.fileName).toBe(expected.file);
      expect(workbook.getWorksheet(expected.sheet)?.rowCount).toBe(2);
    });
  }
});
