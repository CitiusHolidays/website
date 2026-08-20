import type { Doc, Id } from "../_generated/dataModel";

function publicMealPreference(value: string | undefined) {
  switch (value) {
    case "Jain":
    case "Non-Veg":
    case "Veg":
    case "Vegan":
      return value;
    default:
      return "" as const;
  }
}

function publicTicketType(value: string | undefined): "" | "FIT Ticket" | "Group Ticket" {
  return value === "FIT Ticket" || value === "Group Ticket" ? value : ("" as const);
}

function publicTravelBatchId(value: Id<"travelBatches"> | undefined): "" | Id<"travelBatches"> {
  return value ?? "";
}

export const publicPnr = (pnr: Doc<"pnrs">, job: Doc<"jobCards">) => ({
  airline: pnr.airline,
  clientName: job?.clientName ?? "",
  createdAt: new Date(pnr.createdAt).toISOString(),
  fareType: pnr.fareType ?? "",
  flightGroupId: pnr.flightGroupId ?? null,
  id: pnr._id,
  issuedSeats: pnr.issuedSeats,
  jobCardId: pnr.jobCardId,
  jobCode: job?.jobCode ?? "",
  pnrCode: pnr.pnrCode,
  route: pnr.route,
  status: pnr.status ?? "",
  totalSeats: pnr.totalSeats,
  updatedAt: new Date(pnr.updatedAt).toISOString(),
});

export const publicTicket = (
  ticket: Doc<"tickets">,
  traveller: Doc<"travellers"> | null,
  pnr: Doc<"pnrs"> | null,
  job: Doc<"jobCards">,
  travelBatch: Doc<"travelBatches"> | null = null
) => ({
  cabinClass: ticket.cabinClass ?? "",
  clientName: job?.clientName ?? "",
  createdAt: new Date(ticket.createdAt).toISOString(),
  id: ticket._id,
  jobCardId: ticket.jobCardId,
  jobCode: job?.jobCode ?? "",
  mealPreference: publicMealPreference(ticket.mealPreference),
  paymentType: ticket.paymentType,
  pnrCode: pnr?.pnrCode ?? "",
  pnrId: ticket.pnrId ?? null,
  seatNumber: ticket.seatNumber ?? "",
  seatPreference: ticket.seatPreference ?? "",
  ticketNumber: ticket.ticketNumber ?? "",
  ticketStatus: ticket.ticketStatus,
  ticketType: publicTicketType(ticket.ticketType),
  travelBatchCode: travelBatch?.batchCode ?? "",
  travelBatchId: publicTravelBatchId(traveller?.travelBatchId),
  travelBatchReference: travelBatch?.batchReference ?? "",
  travellerId: ticket.travellerId ?? null,
  travellerName: traveller?.fullName ?? "",
  updatedAt: new Date(ticket.updatedAt).toISOString(),
});
