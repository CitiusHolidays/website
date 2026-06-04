import { describe, expect, test } from "bun:test";
import { toPassengerImportInput } from "./passengerImportRows";

describe("toPassengerImportInput", () => {
  test("preserves the workbook row contract sent to Convex actions", () => {
    const row = {
      id: "Sheet1:2",
      sourceSheet: "Sheet1",
      sourceRowNumber: 2,
      sourceStatus: "CONFIRMED",
      importKind: "passenger",
      importKey: "anshika|1987-07-26|9932929359",
      fullName: "ANSHIKA AGARWAL",
      travelHub: "KOLKATA",
      foodPreference: "Veg",
      guestType: "Client",
      paymentType: "Company Paid",
      roomType: "Twin",
      visaRequired: true,
      domesticTravelRequired: true,
      passportStatus: "Received",
      specialRequests: "Window seat",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceSoName: "Base",
      sourceRsoName: "Airline",
      sourceGroup: "Group A",
      gender: "FEMALE",
      contactNo: "9932929359",
      hotelAllocation: "Twin",
      visaStatus: "Appointment Scheduled",
      biometricAppointmentDate: "2026-05-01",
      visaNotes: "Carry old passport",
      passport: {
        number: "AK429734",
        dateOfBirth: "1987-07-26",
        issueDate: "2026-02-12",
        expiryDate: "2036-02-11",
        nationality: "INDIAN",
      },
      ticketing: {
        internationalFare: "55168",
        internationalPnr: "ICQULJ",
        internationalVendor: "LAXMINARAYAN",
        domesticTicket: "15281",
        domesticPnr: "7V3C5J",
        domesticVendor: "TBO",
      },
    };

    expect(toPassengerImportInput(row)).toEqual({
      id: "Sheet1:2",
      sourceSheet: "Sheet1",
      sourceRowNumber: 2,
      importKind: "passenger",
      importKey: "anshika|1987-07-26|9932929359",
      fullName: "ANSHIKA AGARWAL",
      travelHub: "KOLKATA",
      foodPreference: "Veg",
      guestType: "Client",
      paymentType: "Company Paid",
      roomType: "Twin",
      visaRequired: true,
      domesticTravelRequired: true,
      passportStatus: "Received",
      specialRequests: "Window seat",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceSoName: "Base",
      sourceRsoName: "Airline",
      sourceGroup: "Group A",
      gender: "FEMALE",
      contactNo: "9932929359",
      hotelAllocation: "Twin",
      visaStatus: "Appointment Scheduled",
      biometricAppointmentDate: "2026-05-01",
      visaNotes: "Carry old passport",
      passport: {
        number: "AK429734",
        dateOfBirth: "1987-07-26",
        issueDate: "2026-02-12",
        expiryDate: "2036-02-11",
        nationality: "INDIAN",
      },
      ticketing: row.ticketing,
    });
  });

  test("normalizes blank optional nested passport fields to undefined", () => {
    expect(toPassengerImportInput({ passport: {}, ticketing: undefined })).toMatchObject({
      passport: {
        number: undefined,
        dateOfBirth: undefined,
        issueDate: undefined,
        expiryDate: undefined,
        nationality: undefined,
      },
      ticketing: undefined,
    });
  });
});
