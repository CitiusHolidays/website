import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";

type DetailRow = {
  label: string;
  value: string;
};

type DetailSection = {
  title: string;
  rows: DetailRow[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function addRow(rows: DetailRow[], label: string, value: unknown) {
  const nextValue = text(value);
  if (nextValue) {
    rows.push({ label, value: nextValue });
  }
}

function formatDate(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return raw;
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateRange(startDate: unknown, endDate: unknown) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end) {
    return `${start} to ${end}`;
  }
  return start || end;
}

function formatAmount(value: unknown, currency = "INR") {
  if (typeof value !== "number") {
    return "";
  }
  return `${currency} ${value.toLocaleString("en-IN")}`;
}

function formatPercent(value: unknown) {
  if (typeof value !== "number") {
    return "";
  }
  return `${value}%`;
}

async function getJob(ctx: QueryCtx, jobCardId?: Id<"jobCards">) {
  return jobCardId ? await ctx.db.get(jobCardId) : null;
}

async function getTravelBatch(ctx: QueryCtx, travelBatchId?: Id<"travelBatches">) {
  return travelBatchId ? await ctx.db.get(travelBatchId) : null;
}

async function getQuery(ctx: QueryCtx, queryId?: Id<"queries">) {
  return queryId ? await ctx.db.get(queryId) : null;
}

async function getTraveller(ctx: QueryCtx, travellerId?: Id<"travellers">) {
  return travellerId ? await ctx.db.get(travellerId) : null;
}

async function getPnr(ctx: QueryCtx, pnrId?: Id<"pnrs">) {
  return pnrId ? await ctx.db.get(pnrId) : null;
}

async function getFlightGroup(ctx: QueryCtx, flightGroupId?: Id<"flightGroups">) {
  return flightGroupId ? await ctx.db.get(flightGroupId) : null;
}

async function linkedQueriesForProposal(ctx: QueryCtx, proposal: Doc<"proposals">) {
  const queryIds = new Set<Id<"queries">>();
  if (proposal.queryId) {
    queryIds.add(proposal.queryId);
  }
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
    .collect();
  for (const link of links) {
    queryIds.add(link.queryId);
  }

  const queryResults = await Promise.all([...queryIds].map((queryId) => ctx.db.get(queryId)));
  return queryResults.filter((query): query is Doc<"queries"> => Boolean(query));
}

function addQueryRows(rows: DetailRow[], query: Doc<"queries">) {
  addRow(rows, "Query", query.queryCode);
  addRow(rows, "Client", query.clientName);
  addRow(rows, "Destination", query.destination);
  addRow(rows, "Pax", query.paxCount);
  addRow(rows, "Travel dates", formatDateRange(query.travelStartDate, query.travelEndDate));
  addRow(rows, "Query type", query.queryType);
  addRow(rows, "Travel type", query.travelType);
  addRow(rows, "Sales stage", query.leadStage);
  addRow(rows, "Sales decision", query.salesStatus);
  addRow(rows, "Contracting status", query.contractingStatus);
  addRow(rows, "Sales SPOC", query.salesOwnerName);
  addRow(rows, "Contracting SPOC", query.contractingOwnerName);
  addRow(rows, "Ticketing SPOC", query.ticketingOwnerName);
  addRow(rows, "Ticketing Scope", query.ticketingScope);
  addRow(rows, "Budget per Person", formatAmount(query.budgetAmount));
  addRow(rows, "Notes", query.notes);
}

async function queryDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const queryId = ctx.db.normalizeId("queries", entityId);
  if (!queryId) {
    return null;
  }
  const query = await ctx.db.get(queryId);
  if (!query) {
    return null;
  }

  const rows: DetailRow[] = [];
  addQueryRows(rows, query);
  return { rows, title: "Query details" };
}

async function proposalDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const proposalId = ctx.db.normalizeId("proposals", entityId);
  if (!proposalId) {
    return null;
  }
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) {
    return null;
  }

  const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
  const rows: DetailRow[] = [];
  addRow(rows, "Proposal", proposal.proposalCode);
  addRow(rows, "Client", proposal.clientName);
  addRow(rows, "Status", proposal.status);
  addRow(rows, "Prepared by", proposal.preparedBy);
  addRow(rows, "Linked queries", linkedQueries.map((query) => query.queryCode).join(", "));
  addRow(
    rows,
    "Destinations",
    linkedQueries.flatMap((query) => (query.destination ? [query.destination] : [])).join(", ")
  );
  addRow(
    rows,
    "Travel dates",
    linkedQueries
      .flatMap((query) => {
        const range = formatDateRange(query.travelStartDate, query.travelEndDate);
        return range ? [range] : [];
      })
      .join("; ")
  );
  addRow(rows, "Cost price / pax", formatAmount(proposal.costPrice));
  addRow(rows, "Selling Price per Person", formatAmount(proposal.sellingPrice));
  addRow(rows, "Tax rate", formatPercent(proposal.taxRate));
  addRow(rows, "Itinerary summary", proposal.itinerarySummary);
  return { rows, title: "Proposal details" };
}

async function jobCardDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const jobCardId = ctx.db.normalizeId("jobCards", entityId);
  if (!jobCardId) {
    return null;
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    return null;
  }
  const [query, proposal] = await Promise.all([
    getQuery(ctx, job.queryId),
    job.proposalId ? ctx.db.get(job.proposalId) : null,
  ]);

  const rows: DetailRow[] = [];
  addRow(rows, "Job Card", job.jobCode);
  addRow(rows, "Query", query?.queryCode);
  addRow(rows, "Proposal", proposal?.proposalCode);
  addRow(rows, "Client", job.clientName);
  addRow(rows, "Destination", job.destination);
  addRow(rows, "Confirmed pax", job.confirmedPax);
  addRow(rows, "Rooms", job.roomCount);
  addRow(rows, "Travel dates", formatDateRange(job.travelStartDate, job.travelEndDate));
  addRow(rows, "Query type", job.queryType);
  addRow(rows, "Status", job.status);
  addRow(rows, "Contracting SPOC", job.contractingOwnerName);
  addRow(rows, "Operations owner", job.operationsOwnerName);
  addRow(rows, "Ticketing SPOC", job.ticketingOwnerName);
  addRow(rows, "Tour manager", job.tourManagerName);
  return { rows, title: "Job Card details" };
}

async function travellerDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const travellerId = ctx.db.normalizeId("travellers", entityId);
  if (!travellerId) {
    return null;
  }
  const traveller = await ctx.db.get(travellerId);
  if (!traveller) {
    return null;
  }
  const job = await getJob(ctx, traveller.jobCardId);

  const rows: DetailRow[] = [];
  addRow(rows, "Traveller", traveller.fullName);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Travel hub", traveller.travelHub);
  addRow(rows, "Guest type", traveller.guestType);
  addRow(rows, "Room type", traveller.roomType);
  addRow(rows, "Travel date", formatDate(traveller.travelDate));
  addRow(rows, "Passport status", traveller.passportStatus);
  addRow(rows, "Visa status", traveller.visaStatus);
  addRow(rows, "Ticket status", traveller.ticketStatus);
  addRow(rows, "Calling status", traveller.callingStatus);
  return { rows, title: "Traveller details" };
}

async function ticketDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const ticketId = ctx.db.normalizeId("tickets", entityId);
  if (!ticketId) {
    return null;
  }
  const ticket = await ctx.db.get(ticketId);
  if (!ticket) {
    return null;
  }
  const [job, traveller, pnr] = await Promise.all([
    getJob(ctx, ticket.jobCardId),
    getTraveller(ctx, ticket.travellerId),
    getPnr(ctx, ticket.pnrId),
  ]);

  const rows: DetailRow[] = [];
  addRow(rows, "Ticket", ticket.ticketNumber || "Pending ticket number");
  addRow(rows, "Traveller", traveller?.fullName);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "PNR", pnr?.pnrCode);
  addRow(rows, "Status", ticket.ticketStatus);
  addRow(rows, "Type", ticket.ticketType);
  addRow(rows, "Payment type", ticket.paymentType);
  addRow(rows, "Cabin class", ticket.cabinClass);
  addRow(rows, "Seat", ticket.seatNumber || ticket.seatPreference);
  addRow(rows, "Meal", ticket.mealPreference);
  addRow(rows, "Name change", ticket.nameChangeStatus);
  addRow(rows, "Reissue", ticket.reissueStatus);
  addRow(rows, "Cancellation", ticket.cancellationStatus);
  return { rows, title: "Ticket details" };
}

async function pnrDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const pnrId = ctx.db.normalizeId("pnrs", entityId);
  if (!pnrId) {
    return null;
  }
  const pnr = await ctx.db.get(pnrId);
  if (!pnr) {
    return null;
  }
  const [job, flightGroup] = await Promise.all([
    getJob(ctx, pnr.jobCardId),
    getFlightGroup(ctx, pnr.flightGroupId),
  ]);

  const rows: DetailRow[] = [];
  addRow(rows, "PNR", pnr.pnrCode);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Flight group", flightGroup?.name);
  addRow(rows, "Airline", pnr.airline);
  addRow(rows, "Route", pnr.route);
  addRow(rows, "Fare type", pnr.fareType);
  addRow(rows, "Status", pnr.status);
  addRow(rows, "Issued seats", `${pnr.issuedSeats}/${pnr.totalSeats}`);
  return { rows, title: "PNR details" };
}

async function passportDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const passportId = ctx.db.normalizeId("passportDetails", entityId);
  if (!passportId) {
    return null;
  }
  const passport = await ctx.db.get(passportId);
  if (!passport) {
    return null;
  }
  const traveller = await getTraveller(ctx, passport.travellerId);
  const job = await getJob(ctx, traveller?.jobCardId);

  const rows: DetailRow[] = [];
  addRow(rows, "Traveller", traveller?.fullName);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Status", passport.status);
  addRow(rows, "Expiry date", formatDate(passport.expiryDate));
  addRow(rows, "Passport last four", passport.lastFour);
  addRow(rows, "File", passport.fileName);
  return { rows, title: "Passport details" };
}

async function visaDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const visaId = ctx.db.normalizeId("visaRecords", entityId);
  if (!visaId) {
    return null;
  }
  const visa = await ctx.db.get(visaId);
  if (!visa) {
    return null;
  }
  const [traveller, job] = await Promise.all([
    getTraveller(ctx, visa.travellerId),
    getJob(ctx, visa.jobCardId),
  ]);

  const rows: DetailRow[] = [];
  addRow(rows, "Traveller", traveller?.fullName);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Status", visa.status);
  addRow(rows, "Appointment date", formatDate(visa.appointmentDate));
  addRow(
    rows,
    "Submitted",
    visa.submittedAt ? new Date(visa.submittedAt).toLocaleDateString("en-GB") : ""
  );
  addRow(
    rows,
    "Approved",
    visa.approvedAt ? new Date(visa.approvedAt).toLocaleDateString("en-GB") : ""
  );
  addRow(
    rows,
    "Rejected",
    visa.rejectedAt ? new Date(visa.rejectedAt).toLocaleDateString("en-GB") : ""
  );
  addRow(rows, "Notes", visa.notes);
  return { rows, title: "Visa details" };
}

async function flightGroupDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const flightGroupId = ctx.db.normalizeId("flightGroups", entityId);
  if (!flightGroupId) {
    return null;
  }
  const flight = await ctx.db.get(flightGroupId);
  if (!flight) {
    return null;
  }
  const job = await getJob(ctx, flight.jobCardId);

  const rows: DetailRow[] = [];
  addRow(rows, "Flight group", flight.name);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Route", flight.route);
  addRow(rows, "Airline", flight.airline);
  addRow(rows, "Flight number", flight.flightNumber);
  addRow(rows, "Departure", formatDate(flight.departureDate));
  addRow(rows, "Arrival", formatDate(flight.arrivalDate));
  addRow(rows, "Ticketing type", flight.ticketingType);
  addRow(rows, "Total seats", flight.totalSeats);
  return { rows, title: "Flight details" };
}

async function seatDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const seatId = ctx.db.normalizeId("seatAllocations", entityId);
  if (!seatId) {
    return null;
  }
  const seat = await ctx.db.get(seatId);
  if (!seat) {
    return null;
  }
  const [job, traveller, pnr, flightGroup] = await Promise.all([
    getJob(ctx, seat.jobCardId),
    getTraveller(ctx, seat.travellerId),
    getPnr(ctx, seat.pnrId),
    getFlightGroup(ctx, seat.flightGroupId),
  ]);

  const rows: DetailRow[] = [];
  addRow(rows, "Seat", seat.seatNumber);
  addRow(rows, "Status", seat.status);
  addRow(rows, "Traveller", traveller?.fullName);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "PNR", pnr?.pnrCode);
  addRow(rows, "Flight group", flightGroup?.name);
  addRow(rows, "Notes", seat.notes);
  return { rows, title: "Seat details" };
}

async function invoiceDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const invoiceId = ctx.db.normalizeId("invoices", entityId);
  if (!invoiceId) {
    return null;
  }
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) {
    return null;
  }
  const job = await getJob(ctx, invoice.jobCardId);

  const rows: DetailRow[] = [];
  addRow(rows, "Invoice", invoice.invoiceNumber);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Status", invoice.status);
  addRow(rows, "Due date", formatDate(invoice.dueDate));
  addRow(rows, "Expected amount", formatAmount(invoice.expectedAmount));
  addRow(rows, "Received amount", formatAmount(invoice.receivedAmount));
  addRow(rows, "Balance amount", formatAmount(invoice.balanceAmount));
  return { rows, title: "Invoice details" };
}

async function expenseDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const expenseId = ctx.db.normalizeId("expenseEntries", entityId);
  if (!expenseId) {
    return null;
  }
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    return null;
  }
  const job = await getJob(ctx, expense.jobCardId);

  const rows: DetailRow[] = [];
  addRow(rows, "Category", expense.category);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Tour manager", expense.tourManagerName);
  addRow(rows, "Expense date", formatDate(expense.expenseDate));
  addRow(rows, "Particulars", expense.particulars);
  addRow(rows, "Amount", formatAmount(expense.amount, expense.currency ?? "INR"));
  addRow(rows, "Paid by", expense.paidBy);
  addRow(rows, "Approval status", expense.approvalStatus);
  addRow(rows, "Reimbursement status", expense.reimbursementStatus);
  addRow(rows, "Notes", expense.notes);
  return { rows, title: "Expense details" };
}

async function approvalDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const approvalId = ctx.db.normalizeId("approvalRequests", entityId);
  if (!approvalId) {
    return null;
  }
  const approval = await ctx.db.get(approvalId);
  if (!approval) {
    return null;
  }

  const rows: DetailRow[] = [];
  addRow(rows, "Approval", approval.requestCode);
  addRow(rows, "Type", approval.type);
  addRow(rows, "Status", approval.status);
  addRow(rows, "Summary", approval.summary);
  addRow(rows, "Amount", formatAmount(approval.amount));
  addRow(rows, "Requested by", approval.requestedByName);
  addRow(rows, "Decision by", approval.decidedByName);
  addRow(rows, "Decision note", approval.decisionNote);
  return { rows, title: "Approval details" };
}

async function leaveDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const leaveId = ctx.db.normalizeId("staffLeaveRecords", entityId);
  if (!leaveId) {
    return null;
  }
  const leave = await ctx.db.get(leaveId);
  if (!leave) {
    return null;
  }
  const staff = await ctx.db.get(leave.staffId);

  const rows: DetailRow[] = [];
  addRow(rows, "Staff member", staff?.name);
  addRow(rows, "Department", staff?.department);
  addRow(rows, "Leave type", leave.leaveType);
  addRow(rows, "Dates", formatDateRange(leave.startDate, leave.endDate));
  addRow(rows, "Status", leave.status);
  addRow(rows, "Head approver", leave.headApproverName);
  addRow(rows, "Head review", leave.headReviewStatus);
  addRow(rows, "Final authority", leave.finalAuthorityName);
  addRow(rows, "Final authority review", leave.finalReviewStatus);
  addRow(rows, "HR copy", leave.hrCopyName);
  addRow(rows, "HR review", leave.hrReviewStatus);
  addRow(rows, "Reason", leave.reason);
  addRow(rows, "Decision note", leave.decisionNote);
  return { rows, title: "Leave details" };
}

async function hotelDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const hotelId = ctx.db.normalizeId("hotels", entityId);
  if (!hotelId) {
    return null;
  }
  const hotel = await ctx.db.get(hotelId);
  if (!hotel) {
    return null;
  }
  const job = await getJob(ctx, hotel.jobCardId);

  const rows: DetailRow[] = [];
  addRow(rows, "Hotel", hotel.name);
  addRow(rows, "City", hotel.city);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Check-in", formatDate(hotel.checkInDate));
  addRow(rows, "Check-out", formatDate(hotel.checkOutDate));
  addRow(rows, "Special instructions", hotel.specialInstructions);
  return { rows, title: "Hotel details" };
}

async function tourManagerDetails(ctx: QueryCtx, entityId: string): Promise<DetailSection | null> {
  const tourManagerId = ctx.db.normalizeId("tourManagerAssignments", entityId);
  if (!tourManagerId) {
    return null;
  }
  const tourManager = await ctx.db.get(tourManagerId);
  if (!tourManager) {
    return null;
  }
  const [job, batch] = await Promise.all([
    getJob(ctx, tourManager.jobCardId),
    getTravelBatch(ctx, tourManager.travelBatchId),
  ]);
  const destination = batch?.destination ?? job?.destination;
  const pax = batch?.confirmedPax ?? job?.confirmedPax;
  const travelDates = formatDateRange(
    batch?.travelStartDate ?? job?.travelStartDate,
    batch?.travelEndDate ?? job?.travelEndDate
  );

  const rows: DetailRow[] = [];
  addRow(rows, "Tour manager", tourManager.name);
  addRow(rows, "Job Card", job?.jobCode);
  addRow(rows, "Travel Batch", batch?.batchReference);
  addRow(rows, "Client", job?.clientName);
  addRow(rows, "Tour name", job?.clientName);
  addRow(rows, "Travel dates", travelDates);
  addRow(rows, "Destination", destination);
  addRow(rows, "Pax", pax);
  addRow(rows, "Reporting instructions", tourManager.reportingInstructions);
  addRow(rows, "Status", tourManager.status);
  addRow(rows, "Email", tourManager.email);
  addRow(rows, "Phone", tourManager.phone);
  addRow(rows, "Languages", tourManager.languages?.join(", "));
  addRow(rows, "Availability date", formatDate(tourManager.availabilityDate));
  addRow(rows, "Calling status", tourManager.callingStatus);
  addRow(rows, "Notes", tourManager.notes);
  return { rows, title: "Tour manager details" };
}

export const getNotificationEmailDetails = internalQuery({
  args: {
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DetailSection | null> => {
    if (!(args.entityType && args.entityId)) {
      return null;
    }

    switch (args.entityType) {
      case "query":
        return await queryDetails(ctx, args.entityId);
      case "proposal":
        return await proposalDetails(ctx, args.entityId);
      case "jobCard":
        return await jobCardDetails(ctx, args.entityId);
      case "traveller":
        return await travellerDetails(ctx, args.entityId);
      case "ticket":
        return await ticketDetails(ctx, args.entityId);
      case "pnr":
        return await pnrDetails(ctx, args.entityId);
      case "passport":
        return await passportDetails(ctx, args.entityId);
      case "visaRecord":
        return await visaDetails(ctx, args.entityId);
      case "flightGroup":
        return await flightGroupDetails(ctx, args.entityId);
      case "seatAllocation":
        return await seatDetails(ctx, args.entityId);
      case "invoice":
        return await invoiceDetails(ctx, args.entityId);
      case "expense":
        return await expenseDetails(ctx, args.entityId);
      case "approval":
        return await approvalDetails(ctx, args.entityId);
      case "leave":
        return await leaveDetails(ctx, args.entityId);
      case "hotel":
        return await hotelDetails(ctx, args.entityId);
      case "tourManager":
        return await tourManagerDetails(ctx, args.entityId);
      default:
        return null;
    }
  },
});
