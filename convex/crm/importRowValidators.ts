import { v } from "convex/values";
import { roomTypeValidator } from "../lib/roomTypeValidators";

const importKindValidator = v.union(
  v.literal("passenger"),
  v.literal("traveller"),
  v.literal("rooming"),
  v.literal("passport"),
  v.literal("visa")
);

export const exportKindValidator = importKindValidator;

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan")
);

const visaStatusValidator = v.union(
  v.literal("Not Required"),
  v.literal("Not Started"),
  v.literal("Checklist Shared"),
  v.literal("Documents Pending"),
  v.literal("Documents Verified"),
  v.literal("Appointment Scheduled"),
  v.literal("Submitted"),
  v.literal("Awaiting"),
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Re-applied")
);

const canonicalGenderValidator = v.optional(
  v.union(v.literal(""), v.literal("Male"), v.literal("Female"))
);

const importedGenderValidator = v.optional(
  v.union(
    v.literal(""),
    v.literal("Male"),
    v.literal("Female"),
    v.literal("M"),
    v.literal("F"),
    v.literal("male"),
    v.literal("female")
  )
);

const importedRoomTypeValidator = v.union(
  roomTypeValidator,
  v.literal("SGL"),
  v.literal("TPL"),
  v.literal("DBL")
);

const ticketingImportRow = v.optional(
  v.object({
    domesticPnr: v.optional(v.string()),
    domesticTicket: v.optional(v.string()),
    domesticVendor: v.optional(v.string()),
    internationalFare: v.optional(v.string()),
    internationalPnr: v.optional(v.string()),
    internationalVendor: v.optional(v.string()),
  })
);

export const internalPassengerImportRow = v.object({
  biometricAppointmentDate: v.optional(v.string()),
  contactNo: v.optional(v.string()),
  domesticTravelRequired: v.optional(v.boolean()),
  encryptedPassportPayload: v.optional(v.string()),
  foodPreference: foodPreferenceValidator,
  fullName: v.string(),
  gender: canonicalGenderValidator,
  givenName: v.optional(v.string()),
  guestType: v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP")),
  hotelAllocation: v.optional(v.string()),
  id: v.string(),
  importKey: v.string(),
  importKind: v.optional(importKindValidator),
  passportContentFingerprint: v.optional(v.string()),
  passportExpiryDate: v.optional(v.string()),
  passportLastFour: v.optional(v.string()),
  passportNumberHash: v.optional(v.string()),
  passportStatus: v.optional(v.string()),
  paymentType: v.union(
    v.literal("Company Paid"),
    v.literal("Self Paid"),
    v.literal("Upgraded Self Paid")
  ),
  roomType: roomTypeValidator,
  sourceDealerCode: v.optional(v.string()),
  sourceDealerName: v.optional(v.string()),
  sourceDescription: v.optional(v.string()),
  sourceGroup: v.optional(v.string()),
  sourceRowNumber: v.number(),
  sourceRsoName: v.optional(v.string()),
  sourceSheet: v.string(),
  sourceSoName: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  surname: v.optional(v.string()),
  ticketing: ticketingImportRow,
  travelBatchId: v.optional(v.string()),
  travelBatchReference: v.optional(v.string()),
  travelHub: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
  visaRequired: v.boolean(),
  visaStatus: v.optional(visaStatusValidator),
});

export const publicPassengerImportRow = v.object({
  biometricAppointmentDate: v.optional(v.string()),
  contactNo: v.optional(v.string()),
  domesticTravelRequired: v.optional(v.boolean()),
  foodPreference: foodPreferenceValidator,
  fullName: v.string(),
  gender: importedGenderValidator,
  givenName: v.optional(v.string()),
  guestType: v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP")),
  hotelAllocation: v.optional(v.string()),
  id: v.string(),
  importKey: v.string(),
  importKind: v.optional(importKindValidator),
  passport: v.object({
    dateOfBirth: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    nationality: v.optional(v.string()),
    number: v.optional(v.string()),
  }),
  passportStatus: v.optional(v.string()),
  paymentType: v.union(
    v.literal("Company Paid"),
    v.literal("Self Paid"),
    v.literal("Upgraded Self Paid")
  ),
  roomType: importedRoomTypeValidator,
  sourceDealerCode: v.optional(v.string()),
  sourceDealerName: v.optional(v.string()),
  sourceDescription: v.optional(v.string()),
  sourceGroup: v.optional(v.string()),
  sourceRowNumber: v.number(),
  sourceRsoName: v.optional(v.string()),
  sourceSheet: v.string(),
  sourceSoName: v.optional(v.string()),
  sourceStatus: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  surname: v.optional(v.string()),
  ticketing: ticketingImportRow,
  travelBatchId: v.optional(v.string()),
  travelBatchReference: v.optional(v.string()),
  travelHub: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
  visaRequired: v.boolean(),
  visaStatus: v.optional(visaStatusValidator),
});
