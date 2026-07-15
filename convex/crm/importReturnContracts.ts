import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { roomTypeValidator } from "../lib/roomTypeValidators";
import { foodPreferenceValidator, paymentTypeValidator } from "./ticketingValidators";

export const passengerImportPreviewResultValidator = v.object({
  roomSummary: v.record(v.string(), v.number()),
  rows: v.array(
    v.object({
      action: v.union(v.literal("create"), v.literal("update")),
      id: v.string(),
      travellerId: v.union(v.id("travellers"), v.null()),
      travellerName: v.string(),
    })
  ),
});

const importErrorValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("retryable"), v.literal("terminal")),
  message: v.string(),
});
export const passengerImportCommitResultValidator = v.object({
  accepted: v.number(),
  batches: v.array(
    v.object({
      batchId: v.string(),
      errors: v.array(importErrorValidator),
      status: v.string(),
    })
  ),
  completed: v.boolean(),
  created: v.number(),
  failed: v.number(),
  processed: v.number(),
  remaining: v.number(),
  roomSummary: v.record(v.string(), v.number()),
  total: v.number(),
  updated: v.number(),
});

const passportExportValidator = v.object({
  dateOfBirth: v.string(),
  expiryDate: v.string(),
  issueDate: v.string(),
  number: v.string(),
});
const ticketingExportValidator = v.object({
  domesticPnr: v.string(),
  domesticTicket: v.string(),
  domesticVendor: v.string(),
  internationalFare: v.string(),
  internationalPnr: v.string(),
  internationalVendor: v.string(),
});
const visaExportValidator = v.object({
  appointmentDate: v.string(),
  notes: v.string(),
  status: v.string(),
});
export const passengerExportResultValidator = v.object({
  clientName: v.string(),
  jobCode: v.string(),
  rows: v.array(
    v.object({
      contactNo: v.string(),
      foodPreference: foodPreferenceValidator,
      fullName: v.string(),
      gender: v.string(),
      givenName: v.string(),
      hotelAllocation: v.string(),
      passport: passportExportValidator,
      paymentType: paymentTypeValidator,
      roomType: roomTypeValidator,
      sourceDealerCode: v.string(),
      sourceDealerName: v.string(),
      sourceDescription: v.string(),
      sourceGroup: v.string(),
      sourceRowNumber: v.union(v.number(), v.null()),
      sourceRsoName: v.string(),
      sourceSheet: v.string(),
      sourceSoName: v.string(),
      specialRequests: v.string(),
      surname: v.string(),
      ticketing: ticketingExportValidator,
      travelBatchCode: v.string(),
      travelBatchId: v.string(),
      travelBatchReference: v.string(),
      travelHub: v.string(),
      visa: visaExportValidator,
      visaRequired: v.boolean(),
      visaStatus: v.string(),
      willingToGo: v.union(v.literal("UNABLE TO GO"), v.literal("CONFIRMED")),
    })
  ),
});

export const flightImportResultValidator = v.object({
  createdGroups: v.number(),
  createdSegments: v.number(),
  totalGroups: v.number(),
  totalSegments: v.number(),
  updatedGroups: v.number(),
  updatedSegments: v.number(),
});

const flightSegmentOutputValidator = v.object({
  airline: v.string(),
  arriveTime: v.string(),
  dateLabel: v.string(),
  departTime: v.string(),
  destination: v.string(),
  duration: v.string(),
  flightNumber: v.string(),
  id: v.id("flightSegments"),
  importKey: v.string(),
  origin: v.string(),
  transit: v.string(),
});
const flightItineraryOutputValidator = v.object({
  airline: v.string(),
  arrivalDate: v.string(),
  clientName: v.string(),
  departureDate: v.string(),
  id: v.id("flightGroups"),
  importKey: v.string(),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  name: v.string(),
  route: v.string(),
  segments: v.array(flightSegmentOutputValidator),
  sourceGroupIndex: v.number(),
  sourceSheet: v.string(),
  travelBatchCode: v.string(),
  travelBatchId: v.string(),
  travelBatchReference: v.string(),
  updatedAt: v.string(),
});
export const flightItineraryListResultValidator = v.array(flightItineraryOutputValidator);
export const flightItineraryListPageResultValidator = paginationResultValidator(
  flightItineraryOutputValidator
);
