import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

export type PortalPermission = (typeof P)[keyof typeof P];

export const TRAVEL_BATCH_MODAL = "travelBatch";

export const SPREADSHEET_MODALS = [
  "passengerImport",
  "flightImport",
  "passengerExport",
  "flightExport",
  "travellerImport",
  "travellerExport",
  "roomingImport",
  "roomingExport",
  "passportImport",
  "passportExport",
  "visaImport",
  "visaExport",
] as const;

export type SpreadsheetModalId = (typeof SPREADSHEET_MODALS)[number];

export interface PortalViewMeta {
  permission: PortalPermission;
  subtitle: string;
  title: string;
}

export const VIEW_META = {
  "accounts-job-cards": {
    permission: P.MANAGE_JOB_CARDS,
    subtitle: "Create Job Card numbers only after order confirmation.",
    title: "Accounts / Job Card Creation",
  },
  activity: {
    permission: P.VIEW_ACTIVITY,
    subtitle: "Audit trail for CRM status changes and workflow triggers.",
    title: "Notifications / Activity Log",
  },
  approvals: {
    permission: P.VIEW_APPROVALS,
    subtitle: "Unified approval queue for expenses and finance handoffs.",
    title: "Approvals",
  },
  contracting: {
    permission: P.VIEW_CONTRACTING,
    subtitle: "Assign contracting SPOCs and move proposals through contracting statuses.",
    title: "Contracting Dashboard",
  },
  dashboard: {
    permission: P.VIEW_DASHBOARD,
    subtitle: "",
    title: "Dashboard",
  },
  "employees-on-leave": {
    permission: P.VIEW_LEAVE,
    subtitle: "Leave requests, approvals, and team availability.",
    title: "Employees on Leave",
  },
  expenses: {
    permission: P.VIEW_EXPENSES,
    subtitle: "Tour-wise expenses, approval, and reimbursement tracking.",
    title: "Expense Management",
  },
  finance: {
    permission: P.VIEW_FINANCE,
    subtitle: "Fund projections, invoices, received amounts, balances, and closure status.",
    title: "Finance",
  },
  flights: {
    permission: P.VIEW_TICKETING,
    subtitle: "Manage PNRs, routes, fare types, group seats, and airline records.",
    title: "Flights & PNR",
  },
  hotels: {
    permission: P.VIEW_OPERATIONS,
    subtitle: "Hotel arrangements, rooming, special instructions, and ground planning.",
    title: "Hotel / Rooming List",
  },
  "job-cards": {
    permission: P.VIEW_JOB_CARDS,
    subtitle: "Operational file control, progress, and pre-departure checklist status.",
    title: "Job Cards",
  },
  passport: {
    permission: P.VIEW_VISA,
    subtitle: "Upload, encrypt, and manage traveller passport scans.",
    title: "Passport Documents",
  },
  pipeline: {
    permission: P.VIEW_QUERIES,
    subtitle: "Track query movement from contracting to confirmed or lost.",
    title: "Pipeline View",
  },
  proposals: {
    permission: P.VIEW_PROPOSALS,
    subtitle: "Create, cost, and send proposals linked to active queries.",
    title: "Proposals",
  },
  queries: {
    permission: P.VIEW_QUERIES,
    subtitle: "Manage incoming MICE, group travel, FIT, B2B, cement, and spiritual enquiries.",
    title: "All Sales Queries",
  },
  reports: {
    permission: P.VIEW_REPORTS,
    subtitle: "Revenue, headcount, and conversion snapshots for leadership review.",
    title: "Reports",
  },
  "seat-allocation": {
    permission: P.VIEW_TICKETING,
    subtitle: "Manual stored seat assignments, holds, and blocks.",
    title: "Seat Allocation",
  },
  settings: {
    permission: P.MANAGE_STAFF,
    subtitle: "Staff allowlist and workflow dropdown reference values.",
    title: "Settings / Dropdown Management",
  },
  team: {
    permission: P.VIEW_TEAM,
    subtitle: "Read-only staff directory by department, role, and location.",
    title: "Team Directory",
  },
  ticketing: {
    permission: P.VIEW_TICKETING,
    subtitle: "Ticket status summary across active Job Cards.",
    title: "Ticket Dashboard",
  },
  tickets: {
    permission: P.VIEW_TICKETING,
    subtitle: "Issue, reissue, cancellation, name correction, and refund tracking.",
    title: "All Tickets",
  },
  "tour-managers": {
    permission: P.VIEW_TOUR_MANAGERS,
    subtitle: "TM assignment, calling status, availability, and active tour visibility.",
    title: "Tour Managers",
  },
  travellers: {
    permission: P.VIEW_TRAVELLERS,
    subtitle:
      "Guest details, hubs, food preferences, rooming, visa, ticket, and TM calling status.",
    title: "Traveller Master Sheet",
  },
  visa: {
    permission: P.VIEW_VISA,
    subtitle:
      "Checklist, appointments, submission, approval, rejection, and re-application tracking.",
    title: "Visa Tracking",
  },
} satisfies Record<string, PortalViewMeta>;

export type PortalViewId = keyof typeof VIEW_META;

export const INITIAL_FORM = {
  airfarePerPax: "",
  airline: "",
  amount: "",
  appointmentDate: "",
  approvalId: "",
  approvalStatus: "Rejected",
  approxMargin: "",
  arrivingEarly: "No",
  batchingNotes: "",
  batchReference: "",
  biometricAppointmentDate: "",
  budgetAmount: "",
  cabinClass: "Economy",
  cardAmount: "",
  cashAmount: "",
  category: "",
  checkInDate: "",
  checkOutDate: "",
  city: "",
  clientName: "",
  confirmationDate: "",
  confirmedPax: "1",
  contactMobile: "",
  contactPerson: "",
  contractingAirlinesCost: "",
  contractingLandCost: "",
  contractingOwnerId: "",
  contractingOwnerName: "",
  contractingStatus: "Proposal in progress",
  contractingVisaCost: "",
  costPrice: "",
  currency: "INR",
  decisionNote: "",
  department: "",
  destination: "",
  domesticTravelRequired: "No",
  dueDate: "",
  emailAlertRoles: [] as string[],
  employmentStatus: "Confirmed",
  endDate: "",
  entityId: "",
  epayAmount: "",
  expectedAmount: "",
  expenseDate: "",
  expenseType: "jobCard",
  extensionOfTour: "No",
  fareType: "",
  foodPreference: "Veg",
  fullName: "",
  gender: "",
  givenName: "",
  guestCompanions: "",
  guestType: "Employee",
  hotelAllocation: "",
  hotelName: "",
  invoiceNumber: "",
  itinerarySummary: "",
  jobCardId: "",
  joiningDate: "",
  landCostPerPax: "",
  leadStage: "Inquiry",
  leaveHeadApproverId: "",
  leavePolicyGroup: "",
  leaveType: "Casual",
  location: "",
  lostReason: "Price",
  marriageLeaveUsed: false,
  maternityEventsUsed: "0",
  mobile: "",
  notes: "",
  operationsOwnerId: "",
  operationsOwnerName: "",
  ownerName: "",
  paidBy: "",
  particulars: "",
  passportStatus: "Pending",
  paternityEventsUsed: "0",
  paxCount: "1",
  paymentType: "Company Paid",
  pnrCode: "",
  pnrId: "",
  proposalId: "",
  queryCode: "",
  queryId: "",
  queryIds: [] as string[],
  queryType: "MICE",
  reason: "",
  receivedAmount: "",
  reportingManagerName: "",
  reportingManagerStaffId: "",
  roomCount: "",
  roomType: "Twin",
  route: "",
  salesDecision: "Proposal in discussion",
  salesOwnerName: "",
  salesOwnerStaffId: "",
  salesStatus: "Proposal in discussion",
  seatNumber: "",
  seatPreference: "",
  seatStatus: "Assigned",
  sellingPrice: "",
  source: "Client",
  staffActive: true,
  staffEmail: "",
  staffFunction: "",
  staffId: "",
  staffName: "",
  staffRoles: ["Sales"] as string[],
  startDate: "",
  status: "Pending",
  surname: "",
  taxRate: "",
  ticketingOwnerId: "",
  ticketingOwnerName: "",
  ticketingScope: "",
  ticketingStaffId: "",
  ticketNumber: "",
  ticketStatus: "Issued",
  ticketType: "FIT Ticket",
  totalSeats: "1",
  tourManagerName: "",
  travelBatchId: "",
  travelDate: "",
  travelEndDate: "",
  travelHub: "",
  travelInBatches: "No",
  travellerId: "",
  travelStartDate: "",
  travelType: "International Travel",
  visaCostPerPax: "",
  visaRecordId: "",
  visaRequired: "Yes",
  visaStatus: "Checklist Shared",
};

export type PortalFormState = typeof INITIAL_FORM;

export interface TravelBatchOwnerSource {
  batchReference?: string;
  confirmedPax?: number | string;
  contractingOwnerId?: string;
  contractingOwnerName?: string;
  destination?: string;
  id?: string;
  jobCardId?: string;
  operationsOwnerId?: string;
  operationsOwnerName?: string;
  roomCount?: number | string;
  status?: string;
  ticketingOwnerId?: string;
  ticketingOwnerName?: string;
  tourManagerName?: string;
  travelEndDate?: string;
  travelStartDate?: string;
}

export type TravelBatchModalInitial = Partial<
  Pick<
    PortalFormState,
    | "batchReference"
    | "confirmedPax"
    | "contractingOwnerId"
    | "contractingOwnerName"
    | "destination"
    | "entityId"
    | "jobCardId"
    | "operationsOwnerId"
    | "operationsOwnerName"
    | "roomCount"
    | "status"
    | "ticketingOwnerId"
    | "ticketingOwnerName"
    | "tourManagerName"
    | "travelEndDate"
    | "travelStartDate"
  >
>;

function travelBatchOwnerInitial(source: TravelBatchOwnerSource): TravelBatchModalInitial {
  return {
    confirmedPax: String(source.confirmedPax ?? ""),
    contractingOwnerId: source.contractingOwnerId || "",
    contractingOwnerName: source.contractingOwnerName || "",
    destination: source.destination || "",
    operationsOwnerId: source.operationsOwnerId || "",
    operationsOwnerName: source.operationsOwnerName || "",
    roomCount: String(source.roomCount ?? ""),
    status: source.status || "Open",
    ticketingOwnerId: source.ticketingOwnerId || "",
    ticketingOwnerName: source.ticketingOwnerName || "",
    tourManagerName: source.tourManagerName || "",
    travelEndDate: source.travelEndDate || "",
    travelStartDate: source.travelStartDate || "",
  };
}

export function buildTravelBatchModalInitial({
  job,
  batch,
}: {
  job?: TravelBatchOwnerSource;
  batch?: TravelBatchOwnerSource;
} = {}): TravelBatchModalInitial {
  if (batch) {
    return {
      ...travelBatchOwnerInitial(batch),
      batchReference: batch.batchReference || "",
      entityId: batch.id,
      jobCardId: batch.jobCardId,
    };
  }
  if (job) {
    return {
      ...travelBatchOwnerInitial(job),
      jobCardId: job.id,
    };
  }
  return {};
}

export function formatTravelBatchOwnerSummary(batch: TravelBatchOwnerSource): string {
  const owners = [
    batch.contractingOwnerName,
    batch.operationsOwnerName,
    batch.ticketingOwnerName,
  ].filter(Boolean);
  return owners.length > 0 ? owners.join(" · ") : "Unassigned";
}
