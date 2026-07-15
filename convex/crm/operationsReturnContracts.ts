import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { roomTypeValidator } from "../lib/roomTypeValidators";

const isoDateTimeValidator = v.string();
const callingStatusValidator = v.union(
  v.literal("Pending"),
  v.literal("Done"),
  v.literal("No response")
);
const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan")
);
const guestTypeValidator = v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP"));
const paymentTypeValidator = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid")
);

export const travellerOutputValidator = v.object({
  arrivingEarly: v.boolean(),
  biometricAppointmentDate: v.string(),
  callingStatus: callingStatusValidator,
  cancellation: v.boolean(),
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  domesticTravelRequired: v.boolean(),
  extensionOfTour: v.boolean(),
  foodPreference: foodPreferenceValidator,
  fullName: v.string(),
  gender: v.string(),
  givenName: v.string(),
  guestCompanions: v.string(),
  guestType: guestTypeValidator,
  hasPassportScan: v.boolean(),
  hotelAllocation: v.string(),
  id: v.id("travellers"),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  lastMinuteDrop: v.boolean(),
  passportExpiryDate: v.string(),
  passportStatus: v.string(),
  paymentType: paymentTypeValidator,
  roomType: roomTypeValidator,
  specialRequests: v.string(),
  surname: v.string(),
  ticketStatus: v.string(),
  travelBatchCode: v.string(),
  travelBatchId: v.union(v.id("travelBatches"), v.literal("")),
  travelBatchReference: v.string(),
  travelDate: v.string(),
  travelHub: v.string(),
  travelStartDate: v.string(),
  updatedAt: isoDateTimeValidator,
  visaRequired: v.boolean(),
  visaStatus: v.string(),
});

export const travellerListPageResultValidator = paginationResultValidator(travellerOutputValidator);
export const travellerListRowResultValidator = v.union(travellerOutputValidator, v.null());
export const travellerIdResultValidator = v.object({ id: v.id("travellers") });

const roomTypeCountValidator = v.object({
  assignments: v.number(),
  roomType: v.string(),
});

export const roomCountSummaryResultValidator = v.object({
  breakdownComplete: v.boolean(),
  complete: v.boolean(),
  jobBreakdown: v.array(
    v.object({
      assignments: v.number(),
      clientName: v.string(),
      id: v.id("jobCards"),
      jobCode: v.string(),
      roomTypes: v.array(roomTypeCountValidator),
    })
  ),
  roomTypes: v.array(roomTypeCountValidator),
  scope: v.union(
    v.literal("selected-job"),
    v.literal("all-visible"),
    v.literal("visible-job-page")
  ),
  totalAssignments: v.number(),
  updatedAt: v.number(),
});

export const visaStatusOutputValidator = v.union(
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

export const visaOutputValidator = v.object({
  appointmentDate: v.string(),
  approvedAt: v.union(isoDateTimeValidator, v.null()),
  checklistSharedAt: v.union(isoDateTimeValidator, v.null()),
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  id: v.id("visaRecords"),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  notes: v.string(),
  rejectedAt: v.union(isoDateTimeValidator, v.null()),
  status: visaStatusOutputValidator,
  submittedAt: v.union(isoDateTimeValidator, v.null()),
  travelBatchCode: v.string(),
  travelBatchId: v.union(v.id("travelBatches"), v.literal("")),
  travelBatchReference: v.string(),
  travelHub: v.string(),
  travellerId: v.id("travellers"),
  travellerName: v.string(),
  updatedAt: isoDateTimeValidator,
});
export const visaListResultValidator = v.array(visaOutputValidator);
export const visaListPageResultValidator = paginationResultValidator(visaOutputValidator);
export const visaIdResultValidator = v.object({ id: v.id("visaRecords") });
export const travellerWithoutVisaListResultValidator = v.array(
  v.object({
    clientName: v.string(),
    fullName: v.string(),
    id: v.id("travellers"),
    jobCode: v.string(),
  })
);

export const hotelOutputValidator = v.object({
  checkInDate: v.string(),
  checkOutDate: v.string(),
  city: v.string(),
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  earlyCheckIn: v.boolean(),
  id: v.id("hotels"),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  lateCheckout: v.boolean(),
  name: v.string(),
  specialInstructions: v.string(),
});
export const hotelListResultValidator = v.array(hotelOutputValidator);
export const hotelListPageResultValidator = paginationResultValidator(hotelOutputValidator);
export const hotelIdResultValidator = v.object({ id: v.id("hotels") });

export const tourManagerOutputValidator = v.object({
  availabilityDate: v.string(),
  callingStatus: callingStatusValidator,
  createdAt: isoDateTimeValidator,
  currentTour: v.string(),
  email: v.string(),
  id: v.id("tourManagerAssignments"),
  jobCardId: v.union(v.id("jobCards"), v.null()),
  jobCode: v.string(),
  languages: v.array(v.string()),
  name: v.string(),
  notes: v.string(),
  phone: v.string(),
  reportingInstructions: v.string(),
  staffId: v.union(v.id("staffUsers"), v.literal("")),
  status: v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive")),
  travelBatchId: v.union(v.id("travelBatches"), v.null()),
});
export const tourManagerListResultValidator = v.array(tourManagerOutputValidator);
export const tourManagerListPageResultValidator = paginationResultValidator(
  tourManagerOutputValidator
);
export const tourManagerIdResultValidator = v.object({ id: v.id("tourManagerAssignments") });

export const deletedCountResultValidator = v.object({ deletedCount: v.number() });

export const passportMetadataResultValidator = v.union(
  v.null(),
  v.object({
    createdAt: isoDateTimeValidator,
    expiryDate: v.string(),
    fileName: v.optional(v.string()),
    id: v.id("passportDetails"),
    lastFour: v.string(),
    mimeType: v.optional(v.string()),
    status: v.string(),
    storageId: v.optional(v.id("_storage")),
    travellerId: v.id("travellers"),
  })
);
export const passportDocumentResultValidator = v.object({
  bytes: v.bytes(),
  fileName: v.string(),
  mimeType: v.string(),
  success: v.literal(true),
});
