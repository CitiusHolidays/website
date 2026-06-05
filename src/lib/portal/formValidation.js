import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { assertDateRangeOrder, getDateRangeError } from "@/lib/portal/dateValidation";
import { toNumber } from "@/lib/portal/formUtils";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";

const MAX_QUERY_NOTES_WORDS = 30;

function countWords(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function assertPositiveInt(value, label, { min = 1 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }
}

function assertNonNegativeNumber(value, label) {
  const parsed = Number(value);
  if (value === "" || value == null) return;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
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
      startLabel: "Travel start date",
      endLabel: "Travel end date",
    });
    assertNonNegativeNumber(form.budgetAmount, "Budget");
  }

  if (modal === "jobCard") {
    if (!form.entityId && !String(form.queryId ?? "").trim()) {
      throw new Error("Select a confirmed query before opening a job card.");
    }
    assertPositiveInt(form.confirmedPax, "Confirmed pax");
    if (form.roomCount !== "" && form.roomCount != null) {
      assertNonNegativeNumber(form.roomCount, "Room count");
    }
    assertDateRangeOrder(form.travelStartDate, form.travelEndDate, {
      startLabel: "Travel start date",
      endLabel: "Travel end date",
    });
  }

  if (modal === "hotel") {
    if (!String(form.hotelName ?? "").trim()) {
      throw new Error("Hotel name is required.");
    }
    assertDateRangeOrder(form.checkInDate, form.checkOutDate, {
      startLabel: "Check-in date",
      endLabel: "Check-out date",
    });
  }

  if (modal === "leave_create") {
    if (!String(form.startDate ?? "").trim() || !String(form.endDate ?? "").trim()) {
      throw new Error("Start and end dates are required.");
    }
    assertDateRangeOrder(form.startDate, form.endDate, {
      startLabel: "Leave start date",
      endLabel: "Leave end date",
    });
    if (!String(form.reason ?? "").trim()) {
      throw new Error("Reason is required.");
    }
  }

  if (modal === "assignContracting") {
    if (!String(form.queryId ?? "").trim()) throw new Error("Select a query.");
    if (!String(form.staffId ?? "").trim()) throw new Error("Select a contracting SPOC.");
  }

  if (modal === "assignQueryTicketing") {
    if (!String(form.queryId ?? "").trim()) throw new Error("Select a query.");
    if (!String(form.ticketingStaffId ?? form.staffId ?? "").trim()) {
      throw new Error("Select a ticketing SPOC.");
    }
  }

  if (modal === "assignQueryTeams") {
    if (!String(form.queryId ?? "").trim()) throw new Error("Select a query.");
    const contractingStaffId = String(form.staffId ?? "").trim();
    const ticketingStaffId = String(form.ticketingStaffId ?? "").trim();
    if (!contractingStaffId && !ticketingStaffId) {
      throw new Error("Select a contracting and/or ticketing SPOC.");
    }
  }

  if (
    modal === "assignContractingOwner" ||
    modal === "assignOperationsOwner" ||
    modal === "assignTicketingOwner"
  ) {
    if (!String(form.jobCardId ?? "").trim()) throw new Error("Select a job card.");
    if (!String(form.staffId ?? "").trim()) throw new Error("Select a team member.");
  }

  if (modal === "salesDecision") {
    const decision = form.salesDecision || form.salesStatus || "Proposal in discussion";
    if (decision === "Order Lost" && !String(form.lostReason ?? "").trim()) {
      throw new Error("Select a lost reason.");
    }
  }

  if (modal === "pnr") {
    if (!String(form.pnrCode ?? "").trim()) throw new Error("PNR code is required.");
    assertPositiveInt(form.totalSeats, "Total seats");
  }

  if (modal === "expense") {
    if (form.expenseType === "jobCard" && !String(form.jobCardId ?? "").trim()) {
      throw new Error("Select a job card.");
    }
    if (!String(form.expenseDate ?? "").trim()) throw new Error("Expense date is required.");
    if (!String(form.category ?? "").trim()) throw new Error("Category is required.");
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
    const queryIds =
      Array.isArray(form.queryIds) && form.queryIds.length > 0
        ? form.queryIds
        : form.queryId
          ? [form.queryId]
          : [];
    if (queryIds.length === 0) {
      throw new Error("Select at least one linked query.");
    }
    assertNonNegativeNumber(form.landCostPerPax, "Land cost per pax");
    assertNonNegativeNumber(form.airfarePerPax, "Airfare per pax");
    assertNonNegativeNumber(form.visaCostPerPax, "Visa cost per pax");
    assertNonNegativeNumber(form.sellingPrice, "Selling price");
    if (form.taxRate !== "" && form.taxRate != null) {
      assertNonNegativeNumber(form.taxRate, "Tax rate");
    }
  }

  if (modal === "staff") {
    if (!String(form.staffEmail ?? "").trim()) throw new Error("Email is required.");
    if (!String(form.staffName ?? "").trim()) throw new Error("Name is required.");
  }

  if (modal === "queryStatus" && has(P.MANAGE_CONTRACTING)) {
    assertNonNegativeNumber(form.contractingLandCost, "Land cost");
    assertNonNegativeNumber(form.contractingAirlinesCost, "Airlines cost");
    assertNonNegativeNumber(form.contractingVisaCost, "Visa cost");
  }
}

export { getDateRangeError, MAX_QUERY_NOTES_WORDS };
