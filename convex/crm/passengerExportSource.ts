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
      airline: pnr?.airline ?? "",
      fareType: pnr?.fareType ?? "",
      pnrCode: pnr?.pnrCode ?? "",
      route: pnr?.route ?? "",
      ticketNumber: ticket.ticketNumber ?? "",
      ticketType: ticket.ticketType ?? "",
    };
  });
  return {
    cancellation: traveller.cancellation ?? false,
    contactNo: traveller.contactNo ?? "",
    createdAt: traveller.createdAt,
    encryptedPassportPayload: passport?.encryptedPayload ?? "",
    foodPreference: traveller.foodPreference,
    fullName: traveller.fullName,
    gender: traveller.gender ?? "",
    givenName: traveller.givenName ?? "",
    hotelAllocation: traveller.hotelAllocation ?? "",
    lastMinuteDrop: traveller.lastMinuteDrop ?? false,
    paymentType: traveller.paymentType,
    roomType: traveller.roomType,
    sourceDealerCode: traveller.sourceDealerCode ?? "",
    sourceDealerName: traveller.sourceDealerName ?? "",
    sourceDescription: traveller.sourceDescription ?? "",
    sourceGroup: traveller.sourceGroup ?? "",
    sourceRowNumber: traveller.sourceRowNumber ?? null,
    sourceRsoName: traveller.sourceRsoName ?? "",
    sourceSheet: traveller.sourceSheet ?? "",
    sourceSoName: traveller.sourceSoName ?? "",
    specialRequests: traveller.specialRequests ?? "",
    surname: traveller.surname ?? "",
    tickets,
    travelBatchCode: travelBatch?.batchCode ?? "",
    travelBatchId: traveller.travelBatchId ?? "",
    travelBatchReference: travelBatch?.batchReference ?? "",
    travelHub: traveller.travelHub ?? "",
    travellerId: traveller._id,
    visa: visaRecord
      ? {
          appointmentDate: visaRecord.appointmentDate ?? "",
          notes: visaRecord.notes ?? "",
          status: visaRecord.status,
        }
      : {
          appointmentDate: traveller.biometricAppointmentDate ?? "",
          notes: "",
          status: traveller.visaStatus,
        },
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
