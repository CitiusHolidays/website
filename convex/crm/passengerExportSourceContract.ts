import { v } from "convex/values";
import type { PassengerExportRow } from "../../src/lib/portal/passengerExportContract";
import type { Id } from "../_generated/dataModel";

export interface PassengerExportSourceTicket {
  airline: string;
  fareType: string;
  pnrCode: string;
  route: string;
  ticketNumber: string;
  ticketType: string;
}

export interface PassengerExportSourceRow {
  cancellation: boolean;
  contactNo: string;
  createdAt: number;
  encryptedPassportPayload: string;
  foodPreference: string;
  fullName: string;
  gender: string;
  givenName: string;
  hotelAllocation: string;
  lastMinuteDrop: boolean;
  paymentType: string;
  roomType: string;
  sourceDealerCode: string;
  sourceDealerName: string;
  sourceDescription: string;
  sourceGroup: string;
  sourceRowNumber: number | null;
  sourceRsoName: string;
  sourceSheet: string;
  sourceSoName: string;
  specialRequests: string;
  surname: string;
  tickets: PassengerExportSourceTicket[];
  travelBatchCode: string;
  travelBatchId: string;
  travelBatchReference: string;
  travelHub: string;
  travellerId: Id<"travellers">;
  visa: { appointmentDate: string; notes: string; status: string };
  visaRequired: boolean;
  visaStatus: string;
}

export interface PassengerExportSortableRow extends PassengerExportRow {
  createdAt: number;
}

export const passengerExportSourceRowValidator = v.object({
  cancellation: v.boolean(),
  contactNo: v.string(),
  createdAt: v.number(),
  encryptedPassportPayload: v.string(),
  foodPreference: v.string(),
  fullName: v.string(),
  gender: v.string(),
  givenName: v.string(),
  hotelAllocation: v.string(),
  lastMinuteDrop: v.boolean(),
  paymentType: v.string(),
  roomType: v.string(),
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
  tickets: v.array(
    v.object({
      airline: v.string(),
      fareType: v.string(),
      pnrCode: v.string(),
      route: v.string(),
      ticketNumber: v.string(),
      ticketType: v.string(),
    })
  ),
  travelBatchCode: v.string(),
  travelBatchId: v.string(),
  travelBatchReference: v.string(),
  travelHub: v.string(),
  travellerId: v.id("travellers"),
  visa: v.object({ appointmentDate: v.string(), notes: v.string(), status: v.string() }),
  visaRequired: v.boolean(),
  visaStatus: v.string(),
});

export const passengerExportSourcePageValidator = v.object({
  clientName: v.string(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  jobCode: v.string(),
  page: v.array(passengerExportSourceRowValidator),
  pageStatus: v.optional(
    v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())
  ),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});
