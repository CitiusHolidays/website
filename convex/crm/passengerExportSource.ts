import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { PassengerExportKind } from "../../src/lib/portal/passengerExportContract";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getVisibleJob } from "./importProcessor";
import type { PortalAccess } from "./lib";
import { mapInBoundedBatches } from "./paginationPolicy";
import { PASSENGER_EXPORT_MAX_TICKETS_PER_TRAVELLER } from "./passengerExportPolicy";
import { canViewPassengerKinds } from "./passengerKindPolicy";

export interface PassengerExportSourcePageArgs {
  access: PortalAccess;
  exportKind: PassengerExportKind;
  jobCardId: Id<"jobCards">;
  paginationOpts: PaginationOptions;
}

function textOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

function booleanOrFalse(value: boolean | undefined) {
  return value ?? false;
}

function presentVisa(traveller: Doc<"travellers">, visaRecord: Doc<"visaRecords"> | null) {
  if (visaRecord) {
    return {
      appointmentDate: textOrEmpty(visaRecord.appointmentDate),
      notes: textOrEmpty(visaRecord.notes),
      status: visaRecord.status,
    };
  }
  return {
    appointmentDate: textOrEmpty(traveller.biometricAppointmentDate),
    notes: "",
    status: traveller.visaStatus,
  };
}

async function passengerExportSourceRow(ctx: QueryCtx, traveller: Doc<"travellers">) {
  const [passport, visaRecord, ticketRows, travelBatch] = await Promise.all([
    ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .unique(),
    ctx.db
      .query("visaRecords")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .unique(),
    ctx.db
      .query("tickets")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .take(PASSENGER_EXPORT_MAX_TICKETS_PER_TRAVELLER + 1),
    traveller.travelBatchId ? ctx.db.get("travelBatches", traveller.travelBatchId) : null,
  ]);
  if (ticketRows.length > PASSENGER_EXPORT_MAX_TICKETS_PER_TRAVELLER) {
    throw new ConvexError(
      `Traveller export ticket relations exceed ${PASSENGER_EXPORT_MAX_TICKETS_PER_TRAVELLER}`
    );
  }
  const tickets = await mapInBoundedBatches(ticketRows, async (ticket) => {
    const pnr = ticket.pnrId ? await ctx.db.get("pnrs", ticket.pnrId) : null;
    return {
      airline: textOrEmpty(pnr?.airline),
      fareType: textOrEmpty(pnr?.fareType),
      pnrCode: textOrEmpty(pnr?.pnrCode),
      route: textOrEmpty(pnr?.route),
      ticketNumber: textOrEmpty(ticket.ticketNumber),
      ticketType: textOrEmpty(ticket.ticketType),
    };
  });
  return {
    cancellation: booleanOrFalse(traveller.cancellation),
    contactNo: textOrEmpty(traveller.contactNo),
    createdAt: traveller.createdAt,
    encryptedPassportPayload: textOrEmpty(passport?.encryptedPayload),
    foodPreference: traveller.foodPreference,
    fullName: traveller.fullName,
    gender: textOrEmpty(traveller.gender),
    givenName: textOrEmpty(traveller.givenName),
    hotelAllocation: textOrEmpty(traveller.hotelAllocation),
    lastMinuteDrop: booleanOrFalse(traveller.lastMinuteDrop),
    paymentType: traveller.paymentType,
    roomType: traveller.roomType,
    sourceDealerCode: textOrEmpty(traveller.sourceDealerCode),
    sourceDealerName: textOrEmpty(traveller.sourceDealerName),
    sourceDescription: textOrEmpty(traveller.sourceDescription),
    sourceGroup: textOrEmpty(traveller.sourceGroup),
    sourceRowNumber: traveller.sourceRowNumber ?? null,
    sourceRsoName: textOrEmpty(traveller.sourceRsoName),
    sourceSheet: textOrEmpty(traveller.sourceSheet),
    sourceSoName: textOrEmpty(traveller.sourceSoName),
    specialRequests: textOrEmpty(traveller.specialRequests),
    surname: textOrEmpty(traveller.surname),
    tickets,
    travelBatchCode: textOrEmpty(travelBatch?.batchCode),
    travelBatchId: textOrEmpty(traveller.travelBatchId),
    travelBatchReference: textOrEmpty(travelBatch?.batchReference),
    travelHub: textOrEmpty(traveller.travelHub),
    travellerId: traveller._id,
    visa: presentVisa(traveller, visaRecord),
    visaRequired: traveller.visaRequired,
    visaStatus: traveller.visaStatus,
  };
}

export async function getPassengerExportSourcePageHandler(
  ctx: QueryCtx,
  args: PassengerExportSourcePageArgs
) {
  if (!canViewPassengerKinds(args.access, [args.exportKind])) {
    throw new ConvexError("FORBIDDEN");
  }
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, args.access, jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const page = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .paginate(args.paginationOpts);
  const rows = await mapInBoundedBatches(page.page, (traveller) =>
    passengerExportSourceRow(ctx, traveller)
  );
  return {
    ...page,
    clientName: job.clientName,
    jobCode: job.jobCode,
    page: rows,
  };
}
