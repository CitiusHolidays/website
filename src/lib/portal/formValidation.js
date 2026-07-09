import { PORTAL_PERMISSIONS as P, TICKETING_SCOPE_OPTIONS } from "@/lib/portal/constants";
import { assertDateRangeOrder } from "@/lib/portal/dateValidation";
import { canHeadAssignQueryTeams, isSalesQueryAssigner } from "@/lib/portal/permissions";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";

function assertValidTicketingScope(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return;
  }
  if (!TICKETING_SCOPE_OPTIONS.includes(trimmed)) {
    throw new Error("Select a valid Ticketing Scope.");
  }
  return trimmed;
}

const MAX_QUERY_NOTES_WORDS = 30;
const WORD_SPLIT_RE = /\s+/;
export const PROPOSAL_HANDOFF_TO_SALES_ERROR =
  "Enter selling price and cost price on the proposal before sending it to Sales.";
export const PROPOSAL_MARK_SENT_ERROR =
  "Enter selling price and cost price on the proposal before marking it sent.";

function countWords(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(WORD_SPLIT_RE).length;
}

function assertPositiveInt(value, label, { min = 1 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }
}

function assertNonNegativeNumber(value, label) {
  const parsed = Number(value);
  if (value === "" || value === null || value === undefined) {
    return;
  }
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
}

function proposalCostPrice(form) {
  if (form.costPrice !== "" && form.costPrice !== null && form.costPrice !== undefined) {
    return Number(form.costPrice);
  }
  return (
    Math.max(Number(form.landCostPerPax) || 0, 0) +
    Math.max(Number(form.airfarePerPax) || 0, 0) +
    Math.max(Number(form.visaCostPerPax) || 0, 0)
  );
}

export function isProposalPricingComplete(form) {
  return Number(form.sellingPrice) > 0 && proposalCostPrice(form) > 0;
}

export function assertProposalPricingComplete(form, message = PROPOSAL_HANDOFF_TO_SALES_ERROR) {
  if (!isProposalPricingComplete(form)) {
    throw new Error(message);
  }
}

function assertMaxWords(value, maxWords, label) {
  if (countWords(value) > maxWords) {
    throw new Error(`${label} must be ${maxWords} words or fewer.`);
  }
}

/**
 * Client-side validation before portal modal mutations run.
 * @param {string} modal
 * @param {Record<string, unknown>} form
 * @param {{ has?: (permission: string) => boolean }} [deps]
 */
export function validateModalForm(modal, form, deps = {}) {
  const has = deps.has || (() => false);

  if (modal === "query") {
    if (!String(form.clientName ?? "").trim()) {
      throw new Error("Client name is required.");
    }
    assertPositiveInt(form.paxCount, "Pax count");
    assertMaxWords(form.notes, MAX_QUERY_NOTES_WORDS, "Notes");
    assertDateRangeOrder(form.travelStartDate, form.travelEndDate, {
      endLabel: "Travel end date",
      startLabel: "Travel start date",
    });
    assertNonNegativeNumber(form.budgetAmount, "Budget");
    const contractingStaffId = String(form.staffId ?? "").trim();
    const ticketingScope = assertValidTicketingScope(form.ticketingScope);
    if (contractingStaffId && !ticketingScope) {
      throw new Error("Select a Ticketing Scope.");
    }
    if (!contractingStaffId && ticketingScope) {
      throw new Error("Select a Contracting SPOC.");
    }
  }

  if (modal === "travelBatch") {
    if (!String(form.jobCardId ?? "").trim()) {
      throw new Error("Select a job card.");
    }
    assertPositiveInt(form.confirmedPax, "Confirmed pax");
    if (form.roomCount !== "" && form.roomCount !== null && form.roomCount !== undefined) {
      assertNonNegativeNumber(form.roomCount, "Room count");
    }
    assertDateRangeOrder(form.travelStartDate, form.travelEndDate, {
      endLabel: "Travel end date",
      startLabel: "Travel start date",
    });
  }

  if (modal === "jobCard") {
    if (!(form.entityId || String(form.queryId ?? "").trim())) {
      throw new Error("Select a confirmed query before opening a job card.");
    }
    assertPositiveInt(form.confirmedPax, "Confirmed pax");
    if (form.roomCount !== "" && form.roomCount !== null && form.roomCount !== undefined) {
      assertNonNegativeNumber(form.roomCount, "Room count");
    }
    assertDateRangeOrder(form.travelStartDate, form.travelEndDate, {
      endLabel: "Travel end date",
      startLabel: "Travel start date",
    });
  }

  if (modal === "traveller" && !String(form.fullName ?? "").trim()) {
    throw new Error("Traveller name is required.");
  }

  if (modal === "visa" && !String(form.visaRecordId ?? "").trim()) {
    throw new Error("Select a visa record.");
  }

  if (modal === "visa_create" && !String(form.travellerId ?? "").trim()) {
    throw new Error("Select a traveller.");
  }

  if (modal === "seat" && !String(form.seatNumber ?? "").trim()) {
    throw new Error("Seat number is required.");
  }

  if (modal === "tourManager") {
    if (!String(form.jobCardId ?? "").trim()) {
      throw new Error("Select a job card.");
    }
    if (!(String(form.staffId ?? "").trim() || String(form.tourManagerName ?? "").trim())) {
      throw new Error("Select a tour manager.");
    }
  }

  if (modal === "invoice") {
    if (!String(form.invoiceNumber ?? "").trim()) {
      throw new Error("Invoice number is required.");
    }
    assertNonNegativeNumber(form.expectedAmount, "Expected amount");
    assertNonNegativeNumber(form.receivedAmount, "Received amount");
  }

  if (modal === "assignJobCardCreator") {
    if (!String(form.queryId ?? "").trim()) {
      throw new Error("Select a confirmed query.");
    }
    if (!String(form.staffId ?? "").trim()) {
      throw new Error("Select the Accounts person who will create the job card.");
    }
  }

  if (modal === "addProposalCollaborator" || modal === "removeProposalCollaborator") {
    if (!String(form.proposalId || form.entityId || "").trim()) {
      throw new Error("Select a proposal.");
    }
    if (!String(form.staffId ?? "").trim()) {
      throw new Error("Select a collaborator.");
    }
  }

  if (modal === "addJobCardCollaborator" || modal === "removeJobCardCollaborator") {
    if (!String(form.jobCardId || form.entityId || "").trim()) {
      throw new Error("Select a job card.");
    }
    if (!String(form.staffId ?? "").trim()) {
      throw new Error("Select a collaborator.");
    }
  }

  if (modal === "hotel") {
    if (!String(form.hotelName ?? "").trim()) {
      throw new Error("Hotel name is required.");
    }
    assertDateRangeOrder(form.checkInDate, form.checkOutDate, {
      endLabel: "Check-out date",
      startLabel: "Check-in date",
    });
  }

  if (modal === "leave_create") {
    if (!(String(form.startDate ?? "").trim() && String(form.endDate ?? "").trim())) {
      throw new Error("Start and end dates are required.");
    }
    assertDateRangeOrder(form.startDate, form.endDate, {
      endLabel: "Leave end date",
      startLabel: "Leave start date",
    });
    if (!String(form.reason ?? "").trim()) {
      throw new Error("Reason is required.");
    }
  }

  if (modal === "assignContracting") {
    if (!String(form.queryId ?? "").trim()) {
      throw new Error("Select a query.");
    }
    if (!String(form.staffId ?? "").trim()) {
      throw new Error("Select a contracting SPOC.");
    }
  }

  if (modal === "assignQueryTicketing") {
    if (!String(form.queryId ?? "").trim()) {
      throw new Error("Select a query.");
    }
    if (!String(form.ticketingStaffId ?? form.staffId ?? "").trim()) {
      throw new Error("Select a ticketing SPOC.");
    }
  }

  if (modal === "assignQueryTeams") {
    if (!String(form.queryId ?? "").trim()) {
      throw new Error("Select a query.");
    }
    const contractingStaffId = String(form.staffId ?? "").trim();
    const ticketingStaffId = String(form.ticketingStaffId ?? "").trim();
    const ticketingScopeRaw = String(form.ticketingScope ?? "").trim();
    const access = deps.access || {};
    const salesInitial = isSalesQueryAssigner(access) && !canHeadAssignQueryTeams(access);

    if (salesInitial) {
      if (!contractingStaffId) {
        throw new Error("Select a Contracting SPOC.");
      }
      if (!ticketingScopeRaw) {
        throw new Error("Select a Ticketing Scope.");
      }
      if (ticketingStaffId) {
        throw new Error("Only heads can assign ticketing SPOCs.");
      }
    } else if (!(contractingStaffId || ticketingStaffId || ticketingScopeRaw)) {
      throw new Error("Select a contracting SPOC, ticketing SPOC, or Ticketing Scope.");
    }

    assertValidTicketingScope(ticketingScopeRaw);
  }

  if (
    modal === "assignContractingOwner" ||
    modal === "assignOperationsOwner" ||
    modal === "assignTicketingOwner"
  ) {
    if (!String(form.jobCardId ?? "").trim()) {
      throw new Error("Select a job card.");
    }
    if (!String(form.staffId ?? "").trim()) {
      throw new Error("Select a team member.");
    }
  }

  if (modal === "salesDecision") {
    const decision = form.salesDecision || form.salesStatus || "Proposal in discussion";
    if (decision === "Order Lost" && !String(form.lostReason ?? "").trim()) {
      throw new Error("Select a lost reason.");
    }
  }

  if (modal === "pnr") {
    if (!String(form.pnrCode ?? "").trim()) {
      throw new Error("PNR code is required.");
    }
    assertPositiveInt(form.totalSeats, "Total seats");
  }

  if (modal === "expense") {
    if (form.expenseType === "jobCard" && !String(form.jobCardId ?? "").trim()) {
      throw new Error("Select a job card.");
    }
    if (!String(form.expenseDate ?? "").trim()) {
      throw new Error("Expense date is required.");
    }
    if (!String(form.category ?? "").trim()) {
      throw new Error("Select a category.");
    }
    if (!String(form.paidBy ?? "").trim()) {
      throw new Error("Paid by is required.");
    }
    assertNonNegativeNumber(form.cardAmount, "Card amount");
    assertNonNegativeNumber(form.cashAmount, "Cash amount");
    assertNonNegativeNumber(form.epayAmount, "E-pay amount");
    const total = getExpenseSplitTotal({
      cardAmount: form.cardAmount,
      cashAmount: form.cashAmount,
      epayAmount: form.epayAmount,
    });
    if (total <= 0) {
      throw new Error("Enter at least one expense amount greater than zero.");
    }
  }

  if (modal === "proposal") {
    let queryIds = [];
    if (Array.isArray(form.queryIds) && form.queryIds.length > 0) {
      queryIds = form.queryIds;
    } else if (form.queryId) {
      queryIds = [form.queryId];
    }
    if (queryIds.length === 0) {
      throw new Error("Select at least one linked query.");
    }
    assertNonNegativeNumber(form.landCostPerPax, "Land cost per pax");
    assertNonNegativeNumber(form.airfarePerPax, "Airfare per pax");
    assertNonNegativeNumber(form.visaCostPerPax, "Visa cost per pax");
    assertNonNegativeNumber(form.sellingPrice, "Selling price");
    if (form.taxRate !== "" && form.taxRate !== null && form.taxRate !== undefined) {
      assertNonNegativeNumber(form.taxRate, "Tax rate");
    }
  }

  if (modal === "proposalHandoff") {
    assertProposalPricingComplete(form, PROPOSAL_HANDOFF_TO_SALES_ERROR);
  }

  if (modal === "staff") {
    if (!String(form.staffEmail ?? "").trim()) {
      throw new Error("Email is required.");
    }
    if (!String(form.staffName ?? "").trim()) {
      throw new Error("Name is required.");
    }
  }

  if (modal === "queryStatus" && has(P.MANAGE_CONTRACTING)) {
    assertNonNegativeNumber(form.contractingLandCost, "Land cost");
    assertNonNegativeNumber(form.contractingAirlinesCost, "Airlines cost");
    assertNonNegativeNumber(form.contractingVisaCost, "Visa cost");
  }

  if (modal === "approvalDecide") {
    const status = form.approvalStatus;
    if (
      (status === "Rejected" || status === "Needs Info") &&
      !String(form.decisionNote ?? "").trim()
    ) {
      throw new Error("A decision note is required when rejecting or requesting details.");
    }
  }
}
