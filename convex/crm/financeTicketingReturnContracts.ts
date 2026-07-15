import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { expenseCurrencyValidator } from "./financeValidators";
import {
  foodPreferenceValidator,
  paymentTypeValidator,
  seatStatusValidator,
  ticketStatusValidator,
  ticketTypeValidator,
} from "./ticketingValidators";

const isoDateTimeValidator = v.string();
const reviewStatusValidator = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected")
);

export const invoiceOutputValidator = v.object({
  balanceAmount: v.number(),
  clientName: v.string(),
  dueDate: v.string(),
  expectedAmount: v.number(),
  generatedAt: v.union(isoDateTimeValidator, v.null()),
  id: v.id("invoices"),
  invoiceNumber: v.string(),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  receivedAmount: v.number(),
  status: v.union(
    v.literal("Draft"),
    v.literal("Generated"),
    v.literal("Part Paid"),
    v.literal("Paid"),
    v.literal("Overdue")
  ),
});
export const invoiceListResultValidator = v.array(invoiceOutputValidator);
export const invoiceListPageResultValidator = paginationResultValidator(invoiceOutputValidator);
export const invoiceIdResultValidator = v.object({ id: v.id("invoices") });

const expenseProofValidator = v.union(
  v.null(),
  v.object({
    createdAt: isoDateTimeValidator,
    fileName: v.string(),
    id: v.id("attachments"),
    mimeType: v.string(),
  })
);
export const expenseOutputValidator = v.object({
  amount: v.number(),
  approvalStatus: reviewStatusValidator,
  canApproveFinance: v.boolean(),
  canApproveManager: v.boolean(),
  cardAmount: v.number(),
  cashAmount: v.number(),
  category: v.string(),
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  currency: expenseCurrencyValidator,
  epayAmount: v.number(),
  expenseDate: v.string(),
  financeReviewedAt: v.union(isoDateTimeValidator, v.null()),
  financeReviewedByName: v.string(),
  financeReviewStatus: reviewStatusValidator,
  id: v.id("expenseEntries"),
  jobCardId: v.union(v.id("jobCards"), v.null()),
  jobCode: v.string(),
  managerApproverStaffId: v.union(v.id("staffUsers"), v.literal("")),
  managerReviewedAt: v.union(isoDateTimeValidator, v.null()),
  managerReviewedByName: v.string(),
  managerReviewStatus: reviewStatusValidator,
  notes: v.string(),
  paidBy: v.string(),
  particulars: v.string(),
  proofAttachment: expenseProofValidator,
  reimbursementStatus: v.union(
    v.literal("Not Submitted"),
    v.literal("Pending"),
    v.literal("Reimbursed")
  ),
  submittedForApprovalAt: v.union(isoDateTimeValidator, v.null()),
  tourManagerName: v.string(),
});
export const expenseListResultValidator = v.array(expenseOutputValidator);
export const expenseListPageResultValidator = paginationResultValidator(expenseOutputValidator);
export const expenseListRowResultValidator = v.union(expenseOutputValidator, v.null());
export const expenseIdResultValidator = v.object({ id: v.id("expenseEntries") });

export const financeOverviewResultValidator = v.object({
  fundProjections: v.object({
    advancePipeline: v.number(),
    expectedCollections: v.number(),
    pendingExpenseApprovals: v.number(),
    pendingReimbursements: v.number(),
  }),
  outstanding: v.array(
    v.object({
      clientName: v.string(),
      dueAmount: v.number(),
      dueDate: v.string(),
      id: v.id("invoices"),
      jobCode: v.string(),
      status: v.union(v.literal("Overdue"), v.literal("Upcoming"), v.literal("Future")),
    })
  ),
  pnl: v.array(
    v.object({
      clientName: v.string(),
      expense: v.number(),
      id: v.id("jobCards"),
      jobCode: v.string(),
      marginPercent: v.number(),
      profit: v.number(),
      revenue: v.number(),
    })
  ),
  summary: v.object({
    approvedExpenses: v.number(),
    clientOutstanding: v.number(),
    totalRevenue: v.number(),
  }),
});

export const pnrOutputValidator = v.object({
  airline: v.string(),
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  fareType: v.string(),
  flightGroupId: v.union(v.id("flightGroups"), v.null()),
  id: v.id("pnrs"),
  issuedSeats: v.number(),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  pnrCode: v.string(),
  route: v.string(),
  status: v.string(),
  totalSeats: v.number(),
  updatedAt: isoDateTimeValidator,
});
export const pnrListResultValidator = v.array(pnrOutputValidator);
export const pnrListPageResultValidator = paginationResultValidator(pnrOutputValidator);
export const pnrIdResultValidator = v.object({ id: v.id("pnrs") });

export const ticketOutputValidator = v.object({
  cabinClass: v.string(),
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  id: v.id("tickets"),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  mealPreference: v.union(foodPreferenceValidator, v.literal("")),
  paymentType: paymentTypeValidator,
  pnrCode: v.string(),
  pnrId: v.union(v.id("pnrs"), v.null()),
  seatNumber: v.string(),
  seatPreference: v.string(),
  ticketNumber: v.string(),
  ticketStatus: ticketStatusValidator,
  ticketType: v.union(ticketTypeValidator, v.literal("")),
  travelBatchCode: v.string(),
  travelBatchId: v.union(v.id("travelBatches"), v.literal("")),
  travelBatchReference: v.string(),
  travellerId: v.union(v.id("travellers"), v.null()),
  travellerName: v.string(),
  updatedAt: isoDateTimeValidator,
});
export const ticketListResultValidator = v.array(ticketOutputValidator);
export const ticketListPageResultValidator = paginationResultValidator(ticketOutputValidator);
export const ticketListRowResultValidator = v.union(ticketOutputValidator, v.null());
export const ticketIdResultValidator = v.object({ id: v.id("tickets") });

export const seatAllocationOutputValidator = v.object({
  clientName: v.string(),
  createdAt: isoDateTimeValidator,
  id: v.id("seatAllocations"),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  notes: v.string(),
  pnrId: v.union(v.id("pnrs"), v.null()),
  seatNumber: v.string(),
  status: seatStatusValidator,
  travellerId: v.union(v.id("travellers"), v.null()),
  travellerName: v.string(),
});
export const seatAllocationListResultValidator = v.array(seatAllocationOutputValidator);
export const seatAllocationListPageResultValidator = paginationResultValidator(
  seatAllocationOutputValidator
);
export const seatAllocationIdResultValidator = v.object({ id: v.id("seatAllocations") });

export const ticketingDashboardResultValidator = v.object({
  attention: v.number(),
  cancelled: v.number(),
  fitTickets: v.number(),
  groupTickets: v.number(),
  issued: v.number(),
  issuedSeats: v.number(),
  pending: v.number(),
  pnrCount: v.number(),
  refunded: v.number(),
  totalSeats: v.number(),
});

export const jobCardIdResultValidator = v.object({ id: v.id("jobCards") });
export const deletedCountResultValidator = v.object({ deletedCount: v.number() });
