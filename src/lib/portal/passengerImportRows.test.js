import { describe, expect, test } from "bun:test";
import { toPassengerImportInput } from "./passengerImportRows";

describe("toPassengerImportInput", () => {
  test("preserves the workbook row contract sent to Convex actions", () => {
    const row = {
      biometricAppointmentDate: "2026-05-01",
      contactNo: "9932929359",
      domesticTravelRequired: true,
      foodPreference: "Veg",
      fullName: "ANSHIKA AGARWAL",
      gender: "FEMALE",
      guestType: "Client",
      hotelAllocation: "Twin",
      id: "Sheet1:2",
      importKey: "anshika|1987-07-26|9932929359",
      importKind: "passenger",
      passport: {
        dateOfBirth: "1987-07-26",
        expiryDate: "2036-02-11",
        issueDate: "2026-02-12",
        nationality: "INDIAN",
        number: "AK429734",
      },
      passportStatus: "Received",
      paymentType: "Company Paid",
      roomType: "Twin",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceGroup: "Group A",
      sourceRowNumber: 2,
      sourceRsoName: "Airline",
      sourceSheet: "Sheet1",
      sourceSoName: "Base",
      sourceStatus: "CONFIRMED",
      specialRequests: "Window seat",
      ticketing: {
        domesticPnr: "7V3C5J",
        domesticTicket: "15281",
        domesticVendor: "TBO",
        internationalFare: "55168",
        internationalPnr: "ICQULJ",
        internationalVendor: "LAXMINARAYAN",
      },
      travelHub: "KOLKATA",
      visaNotes: "Carry old passport",
      visaRequired: true,
      visaStatus: "Appointment Scheduled",
    };

    expect(toPassengerImportInput(row)).toEqual({
      biometricAppointmentDate: "2026-05-01",
      contactNo: "9932929359",
      domesticTravelRequired: true,
      foodPreference: "Veg",
      fullName: "ANSHIKA AGARWAL",
      gender: "FEMALE",
      guestType: "Client",
      hotelAllocation: "Twin",
      id: "Sheet1:2",
      importKey: "anshika|1987-07-26|9932929359",
      importKind: "passenger",
      passport: {
        dateOfBirth: "1987-07-26",
        expiryDate: "2036-02-11",
        issueDate: "2026-02-12",
        nationality: "INDIAN",
        number: "AK429734",
      },
      passportStatus: "Received",
      paymentType: "Company Paid",
      roomType: "Twin",
      sourceDealerCode: "MUM",
      sourceDealerName: "AGGARWAL APPLIANCES",
      sourceDescription: "Mumbai",
      sourceGroup: "Group A",
      sourceRowNumber: 2,
      sourceRsoName: "Airline",
      sourceSheet: "Sheet1",
      sourceSoName: "Base",
      specialRequests: "Window seat",
      ticketing: row.ticketing,
      travelHub: "KOLKATA",
      visaNotes: "Carry old passport",
      visaRequired: true,
      visaStatus: "Appointment Scheduled",
    });
  });

  test("normalizes blank optional nested passport fields to undefined", () => {
    expect(toPassengerImportInput({ passport: {}, ticketing: undefined })).toMatchObject({
      passport: {
        dateOfBirth: undefined,
        expiryDate: undefined,
        issueDate: undefined,
        nationality: undefined,
        number: undefined,
      },
      ticketing: undefined,
    });
  });
});
