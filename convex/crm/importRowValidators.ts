import { v } from "convex/values";

const importKindValidator = v.union(
  v.literal("passenger"),
  v.literal("traveller"),
  v.literal("rooming"),
  v.literal("passport"),
  v.literal("visa"),
);

export const exportKindValidator = importKindValidator;

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
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
  v.literal("Re-applied"),
);

const ticketingImportRow = v.optional(
  v.object({
    internationalFare: v.optional(v.string()),
    internationalPnr: v.optional(v.string()),
    internationalVendor: v.optional(v.string()),
    domesticTicket: v.optional(v.string()),
    domesticPnr: v.optional(v.string()),
    domesticVendor: v.optional(v.string()),
  }),
);

export const internalPassengerImportRow = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  importKind: v.optional(importKindValidator),
  importKey: v.string(),
  fullName: v.string(),
  travelHub: v.optional(v.string()),
  foodPreference: foodPreferenceValidator,
  guestType: v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP")),
  paymentType: v.union(
    v.literal("Company Paid"),
    v.literal("Self Paid"),
    v.literal("Upgraded Self Paid"),
  ),
  roomType: v.union(
    v.literal("SGL"),
    v.literal("Twin"),
    v.literal("DBL"),
    v.literal("Child with Bed"),
    v.literal("Family Room"),
  ),
  visaRequired: v.boolean(),
  domesticTravelRequired: v.optional(v.boolean()),
  passportStatus: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  sourceDealerCode: v.optional(v.string()),
  sourceDealerName: v.optional(v.string()),
  sourceDescription: v.optional(v.string()),
  sourceSoName: v.optional(v.string()),
  sourceRsoName: v.optional(v.string()),
  sourceGroup: v.optional(v.string()),
  gender: v.optional(v.string()),
  contactNo: v.optional(v.string()),
  hotelAllocation: v.optional(v.string()),
  visaStatus: v.optional(visaStatusValidator),
  biometricAppointmentDate: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
  passportNumberHash: v.optional(v.string()),
  encryptedPassportPayload: v.optional(v.string()),
  passportLastFour: v.optional(v.string()),
  passportExpiryDate: v.optional(v.string()),
  ticketing: ticketingImportRow,
});

export const publicPassengerImportRow = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  sourceStatus: v.optional(v.string()),
  importKind: v.optional(importKindValidator),
  importKey: v.string(),
  fullName: v.string(),
  travelHub: v.optional(v.string()),
  foodPreference: foodPreferenceValidator,
  guestType: v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP")),
  paymentType: v.union(
    v.literal("Company Paid"),
    v.literal("Self Paid"),
    v.literal("Upgraded Self Paid"),
  ),
  roomType: v.union(
    v.literal("SGL"),
    v.literal("Twin"),
    v.literal("DBL"),
    v.literal("Child with Bed"),
    v.literal("Family Room"),
  ),
  visaRequired: v.boolean(),
  domesticTravelRequired: v.optional(v.boolean()),
  passportStatus: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  sourceDealerCode: v.optional(v.string()),
  sourceDealerName: v.optional(v.string()),
  sourceDescription: v.optional(v.string()),
  sourceSoName: v.optional(v.string()),
  sourceRsoName: v.optional(v.string()),
  sourceGroup: v.optional(v.string()),
  gender: v.optional(v.string()),
  contactNo: v.optional(v.string()),
  hotelAllocation: v.optional(v.string()),
  visaStatus: v.optional(visaStatusValidator),
  biometricAppointmentDate: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
  passport: v.object({
    number: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    nationality: v.optional(v.string()),
  }),
  ticketing: ticketingImportRow,
});
