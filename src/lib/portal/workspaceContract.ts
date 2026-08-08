import type { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

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
