import type { Key, ReactNode } from "react";
import type { PipelineMode } from "@/components/portal/pipeline/PipelineView";
import type { PortalPermission } from "@/lib/portal/workspaceContract";

export interface PortalAttachmentSummary {
  fileName: string;
  id: string;
}

export interface PortalQueryListRow {
  approxMargin?: number | null;
  attachmentCount?: number;
  attachments?: PortalAttachmentSummary[];
  batchingNotes?: string;
  budgetAmount?: number;
  clientName?: string;
  confirmedAt?: string | null;
  confirmedOffer?: {
    airfarePerPax: number;
    confirmedPax: number;
    destination: string;
    landCostPerPax: number;
    profitPerPax: number;
    proposalId: string;
    sellingPricePerPax: number;
    travelEndDate: string;
    travelStartDate: string;
    visaCostPerPax: number;
  } | null;
  contactMobile?: string;
  contactPerson?: string;
  contractingOwnerId?: string;
  contractingOwnerName?: string;
  contractingStatus?: string;
  createdAt?: string;
  destination?: string;
  id: Key;
  jobCardCode?: string | null;
  jobCardId?: string | null;
  leadStage?: string;
  notes?: string;
  paxCount?: number;
  proposalDocument?: {
    fileName: string;
    proposalId: string;
    uploadedAt?: string | null;
  } | null;
  queryCode?: string;
  queryType?: string;
  salesOwnerName?: string;
  salesStatus?: string;
  source?: string;
  submittedToContractingAt?: string | null;
  ticketingOwnerId?: string;
  ticketingOwnerName?: string;
  ticketingScope?: string;
  travelEndDate?: string;
  travelInBatches?: boolean;
  travelStartDate?: string;
  travelType?: string;
}

export interface PortalProposalListRow {
  airfarePerPax?: number;
  attachmentCount?: number;
  attachments?: PortalAttachmentSummary[];
  clientName?: string;
  collaboratorStaffIds?: string[];
  costPrice?: number;
  createdAt?: string;
  finalizedPdf?: {
    fileName: string;
    uploadedAt?: string;
  } | null;
  id: Key;
  itinerarySummary?: string;
  landCostPerPax?: number;
  lastEditedAt?: string | null;
  lastEditedByName?: string | null;
  preparedBy?: string;
  pricingEnteredAt?: string | null;
  proposalCode?: string;
  queries?: Array<{
    contractingOwnerId?: string | null;
    paxCount?: number;
  }>;
  query?: {
    contractingOwnerId?: string | null;
    paxCount?: number;
  } | null;
  queryId?: string;
  sellingPrice?: number;
  sentToClientAt?: string | null;
  sentToSalesAt?: string | null;
  status?: string;
  taxRate?: number | null;
  updatedAt?: string;
  visaCostPerPax?: number;
}

export interface PortalTeamMemberRow {
  email?: string;
  id: string;
  location?: string;
  name: string;
  roles: string[];
}

export interface PortalContractingTeamRow {
  activeQueries: number;
  email?: string;
  id: string;
  location: string;
  name: string;
}

export type PortalPermissionChecker = (permission: PortalPermission | string) => boolean;

export type PortalModalOpener = (modal: string, initial?: unknown) => void;

export type PortalDeleteHandler = (
  label: string,
  remover: (args: Record<string, string | undefined>) => Promise<unknown>,
  args: Record<string, string | undefined>,
  options?: { confirmMessage?: string }
) => Promise<void>;

export interface PortalAccessSlice {
  roles?: string[];
}

export interface QueriesViewProps {
  access: PortalAccessSlice;
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  getFinalizedPdfUrl: (proposalId: string) => Promise<string>;
  getQueryAttachmentUrl: (attachmentId: string) => Promise<string>;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeQuery: (args: { queryId?: string }) => Promise<unknown>;
  rows: PortalQueryListRow[];
  submitToContracting: (args: { queryId: string }) => Promise<unknown>;
}

export interface ContractingViewProps {
  access: PortalAccessSlice;
  canAssign: boolean;
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  getFinalizedPdfUrl: (proposalId: string) => Promise<string>;
  getQueryAttachmentUrl: (attachmentId: string) => Promise<string>;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  proposals: PortalProposalListRow[];
  removeQuery: (args: { queryId?: string }) => Promise<unknown>;
  rows: PortalQueryListRow[];
  team: PortalTeamMemberRow[];
}

export interface ProposalsViewProps {
  deleteItem: PortalDeleteHandler;
  getFinalizedPdfUrl: (proposalId: string) => Promise<string>;
  getProposalAttachmentUrl: (attachmentId: string) => Promise<string>;
  has: PortalPermissionChecker;
  markProposalSent: (args: { proposalId: string }) => Promise<unknown>;
  openModal: PortalModalOpener;
  removeProposal: (args: { proposalId?: string }) => Promise<unknown>;
  rows: PortalProposalListRow[];
  sendProposalToSales: (args: { proposalId: string }) => Promise<unknown>;
}

export type PilotPortalViewComponent = (
  props: QueriesViewProps | ContractingViewProps | ProposalsViewProps
) => ReactNode;

export interface PortalDateRange {
  from: string | null;
  to: string | null;
}

export interface PortalDashboardSummary {
  activeTours?: Array<{
    clientName?: string;
    destination?: string;
    id: string;
    jobCode?: string;
    pax?: number;
    status?: string;
    ticketProgress?: number;
    visaProgress?: number;
  }>;
  departmentWorkflow?: Array<{ label: string; percent?: number; value?: number | string }>;
  metrics?: Record<string, number>;
  metricTrends?: Record<string, { direction?: string; value?: number }>;
  myTeam?: Array<{
    department?: string;
    email?: string;
    function?: string;
    id: string;
    location?: string;
    name: string;
  }>;
  progress?: {
    guestData?: { percent?: number };
    payment?: { percent?: number };
    rooming?: { percent?: number };
    tickets?: { percent?: number };
    visas?: { percent?: number };
  };
  upcomingDepartures?: Array<{
    clientName?: string;
    id: string;
    jobCode?: string;
    pax?: number;
    readiness?: string;
    tourManagerName?: string;
    travelStartDate?: string;
  }>;
  urgentActions?: Array<{ id: string; label?: string; type?: string }>;
}

export interface DashboardViewProps {
  access: PortalAccessSlice;
  dateRange: PortalDateRange;
  has: PortalPermissionChecker;
  loading: boolean;
  openModal: PortalModalOpener;
  setDateRange: (value: PortalDateRange) => void;
  summary?: PortalDashboardSummary;
}

export interface PipelineViewProps {
  canMoveContractingPipeline?: boolean;
  canMoveSalesPipeline?: boolean;
  mode: PipelineMode;
  moveContractingPipelineStage?: (args: {
    expectedContractingStatus: string;
    queryId: string;
    targetStage: "Proposal sent";
  }) => Promise<unknown>;
  moveSalesPipelineStage?: (args: {
    expectedLeadStage: "Inquiry" | "Proposal" | "Negotiation";
    queryId: string;
    targetStage: string;
  }) => Promise<unknown>;
  rows: PortalQueryListRow[];
  setMode: (value: PipelineMode) => void;
}

export interface PortalAccountsJobCardCreatorRow {
  email?: string;
  id: string;
  jobCardCreatorEnabled?: boolean;
  name: string;
  roles: string[];
}

export interface PortalPaymentTermsReferenceRow {
  advance: string;
  balance: string;
  id: string;
  notify: string;
  type: string;
}

export interface AccountsJobCardViewProps {
  access: PortalAccessSlice;
  creators: PortalAccountsJobCardCreatorRow[];
  jobCards: PortalJobCardListRow[];
  openModal: PortalModalOpener;
  rows: PortalQueryListRow[];
  setJobCardCreatorAccess: (args: { enabled: boolean; staffId: string }) => Promise<unknown>;
}

export type CorePortalViewComponent = (
  props: DashboardViewProps | PipelineViewProps | AccountsJobCardViewProps
) => ReactNode;

export interface PortalJobCardListRow {
  clientName?: string;
  collaboratorStaffIds?: string[];
  confirmedPax?: number;
  contractingOwnerName?: string;
  createdAt?: string;
  destination?: string;
  id: Key;
  jobCode: string;
  lastEditedAt?: string | null;
  lastEditedByName?: string | null;
  operationsOwnerName?: string;
  proposalId?: string;
  queryId?: string;
  roomCount?: number;
  status?: string;
  ticketingOwnerName?: string;
  tourManagerName?: string;
  travelBatchCount?: number;
  travelEndDate?: string;
  travelStartDate?: string;
}

export interface PortalTravellerListRow {
  arrivingEarly?: boolean;
  biometricAppointmentDate?: string;
  callingStatus?: string;
  clientName?: string;
  domesticTravelRequired?: boolean;
  extensionOfTour?: boolean;
  foodPreference?: string;
  fullName: string;
  gender?: string;
  givenName?: string;
  guestCompanions?: string;
  guestType?: string;
  hotelAllocation?: string;
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  notes?: string;
  passportExpiryDate?: string;
  passportStatus?: string;
  paymentType?: string;
  roomType?: string;
  specialRequests?: string;
  surname?: string;
  ticketStatus?: string;
  travelBatchCode?: string;
  travelBatchId?: string;
  travelBatchReference?: string;
  travelDate?: string;
  travelHub?: string;
  travelStartDate?: string;
  visaRequired?: boolean;
  visaStatus?: string;
}

export interface PortalPassportTravellerRow extends PortalTravellerListRow {
  hasPassportScan?: boolean;
}

export interface PortalVisaListRow {
  appointmentDate?: string;
  id: Key;
  jobCode?: string;
  notes?: string;
  status?: string;
  travelBatchCode?: string;
  travelBatchId?: string;
  travelBatchReference?: string;
  travelHub?: string;
  travellerName: string;
}

export interface PortalHotelListRow {
  checkInDate?: string;
  checkOutDate?: string;
  city?: string;
  clientName?: string;
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  name: string;
  specialInstructions?: string;
}

export interface PortalRoomCountSummary {
  breakdownComplete?: boolean;
  complete?: boolean;
  jobBreakdown?: Array<{
    assignments: number;
    clientName?: string;
    id: Key;
    jobCode: string;
    roomTypes: Array<{ assignments: number; roomType: string }>;
  }>;
  roomTypes?: Array<{ assignments: number; roomType: string }>;
  scope?: string;
  totalAssignments?: number;
}

export interface PortalPaginationSlice {
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  loadedCount?: number;
  loadMore?: () => void;
}

export interface PortalTourManagerListRow {
  availabilityDate?: string;
  callingStatus?: string;
  currentTour?: string;
  email?: string;
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  name: string;
  notes?: string;
  phone?: string;
  reportingInstructions?: string;
  staffId?: string;
  status?: string;
  travelBatchId?: string;
}

export interface PortalTourManagerAssignmentRow {
  jobCardId?: Key;
  name: string;
  travelBatchId?: string;
}

export interface PortalCallingBoardRow extends PortalTravellerListRow {
  cancellation?: boolean;
  lastMinuteDrop?: boolean;
}

export type PortalBulkDeleteHandler = <T extends Record<string, string[]>>(
  count: number,
  entityLabel: string,
  remover: (args: T) => Promise<unknown>,
  buildArgs: () => T
) => Promise<void>;

export type PortalGridRow = Record<string, unknown> & { id?: Key };

export type PortalJobCardDeletionStatus = "complete" | "failed" | "running";

export interface PortalJobCardDeletionOperation {
  completedAt?: number;
  deletedCount: number;
  failedAt?: number;
  failureSummary?: string;
  id: string;
  jobCardId: string;
  jobCode: string;
  lastProgressAt: number;
  stage: string;
  stageCounts: Array<{ count: number; stage: string }>;
  stalled: boolean;
  startedAt: number;
  status: PortalJobCardDeletionStatus;
}

export interface JobCardsViewProps {
  access: PortalAccessSlice;
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  jobCardDeletionOperations?: PortalJobCardDeletionOperation[];
  openModal: PortalModalOpener;
  removeJobCard: (args: { jobCardId?: string }) => Promise<unknown>;
  rows: PortalJobCardListRow[];
  updateJobStatus: (args: { jobCardId: string; status: string }) => Promise<unknown>;
}

export interface TravellersViewProps {
  countRows: PortalTravellerListRow[];
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  openModal: PortalModalOpener;
  removeManyTravellers: (args: { travellerIds: string[] }) => Promise<unknown>;
  removeTraveller: (args: { travellerId?: string }) => Promise<unknown>;
  rows: PortalTravellerListRow[];
  setJobCardFilter: (value: string) => void;
}

export interface PortalJobCardOption {
  clientName?: string;
  id: string;
  jobCode: string;
}

export interface PassportDocumentsViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  encryptAndStorePassport: (args: {
    dateOfBirth?: string;
    expiryDate?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    nationality?: string;
    number?: string;
    tempStorageId: string;
    travellerId: string;
  }) => Promise<unknown>;
  filtersActive?: boolean;
  generateUploadUrl: (args: { travellerId: string }) => Promise<string>;
  getPassportDocument: (travellerId: string) => Promise<string>;
  has: PortalPermissionChecker;
  removeManyTravellers: (args: { travellerIds: string[] }) => Promise<unknown>;
  removePassport: (args: { travellerId: string }) => Promise<unknown>;
  removeTraveller: (args: { travellerId?: string }) => Promise<unknown>;
  travellers: PortalPassportTravellerRow[];
}

export interface VisaTrackingViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeManyVisas: (args: { visaRecordIds: string[] }) => Promise<unknown>;
  removeVisa: (args: { visaRecordId?: string }) => Promise<unknown>;
  rows: PortalVisaListRow[];
}

export interface HotelRoomingViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  hotels: PortalHotelListRow[];
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  openModal: PortalModalOpener;
  removeHotel: (args: { hotelId?: string }) => Promise<unknown>;
  removeManyHotels: (args: { hotelIds: string[] }) => Promise<unknown>;
  removeManyTravellers: (args: { travellerIds: string[] }) => Promise<unknown>;
  removeTraveller: (args: { travellerId?: string }) => Promise<unknown>;
  roomCountPagination?: PortalPaginationSlice;
  roomCountSummary?: PortalRoomCountSummary;
  roomingRows: PortalTravellerListRow[];
  setJobCardFilter: (value: string) => void;
}

export interface TourManagersViewProps {
  assignments: PortalTourManagerAssignmentRow[];
  canAssign: boolean;
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeManyTourManagers: (args: { tourManagerIds: string[] }) => Promise<unknown>;
  removeTourManager: (args: { tourManagerId?: string }) => Promise<unknown>;
  rows: PortalTourManagerListRow[];
  travellers: PortalCallingBoardRow[];
  updateCallingStatus: (args: { callingStatus: string; travellerId: string }) => Promise<unknown>;
}

export type OperationsPortalViewComponent = (
  props:
    | JobCardsViewProps
    | TravellersViewProps
    | PassportDocumentsViewProps
    | VisaTrackingViewProps
    | HotelRoomingViewProps
    | TourManagersViewProps
) => ReactNode;

export interface PortalTicketDashboardSummary {
  attention?: number;
  fitTickets?: number;
  groupTickets?: number;
  issued?: number;
  issuedSeats?: number;
  pending?: number;
  pnrCount?: number;
  totalSeats?: number;
}

export interface PortalTicketListRow {
  cabinClass?: string;
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  mealPreference?: string;
  paymentType?: string;
  pnrCode?: string;
  pnrId?: string;
  seatNumber?: string;
  seatPreference?: string;
  ticketNumber?: string;
  ticketStatus?: string;
  ticketType?: string;
  travelBatchCode?: string;
  travelBatchReference?: string;
  travellerId?: string;
  travellerName?: string;
}

export interface PortalPnrListRow {
  airline?: string;
  clientName?: string;
  fareType?: string;
  id: Key;
  issuedSeats?: number;
  jobCardId?: string;
  jobCode?: string;
  pnrCode: string;
  route?: string;
  totalSeats?: number;
}

export interface PortalFlightItineraryGroup {
  clientName: string;
  id: string;
  jobCardId?: string;
  jobCode: string;
  name: string;
  route: string;
  segments: Array<{
    airline: string;
    arriveTime?: string;
    dateLabel: string;
    departTime?: string;
    destination: string;
    duration?: string;
    flightNumber: string;
    id: string;
    origin: string;
    transit?: string;
  }>;
  sourceSheet?: string;
}

export interface PortalSeatListRow {
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  notes?: string;
  pnrId?: string;
  seatNumber: string;
  status?: string;
  travellerId?: string;
  travellerName?: string;
}

export interface TicketDashboardViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeManyTickets: (args: { ticketIds: string[] }) => Promise<unknown>;
  removeTicket: (args: { ticketId?: string }) => Promise<unknown>;
  summary?: PortalTicketDashboardSummary;
  tickets: PortalTicketListRow[];
}

export interface TicketsViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeManyTickets: (args: { ticketIds: string[] }) => Promise<unknown>;
  removeTicket: (args: { ticketId?: string }) => Promise<unknown>;
  rows: PortalTicketListRow[];
}

export interface PnrViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  itinerary: PortalFlightItineraryGroup[];
  openModal: PortalModalOpener;
  removeManyPnrs: (args: { pnrIds: string[] }) => Promise<unknown>;
  removePnr: (args: { pnrId?: string }) => Promise<unknown>;
  rows: PortalPnrListRow[];
}

export interface SeatViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeManySeatAllocations: (args: { seatAllocationIds: string[] }) => Promise<unknown>;
  removeSeatAllocation: (args: { seatAllocationId?: string }) => Promise<unknown>;
  rows: PortalSeatListRow[];
}

export interface PortalFinancePnlRow {
  clientName?: string;
  expense?: number;
  id: Key;
  jobCode?: string;
  marginPercent?: number;
  profit?: number;
  revenue?: number;
}

export interface PortalFinanceOutstandingRow {
  clientName?: string;
  dueAmount?: number;
  dueDate?: string;
  id: Key;
  jobCode?: string;
  status?: string;
}

export interface PortalFinanceOverview {
  fundProjections?: {
    advancePipeline?: number;
    expectedCollections?: number;
    pendingExpenseApprovals?: number;
    pendingReimbursements?: number;
  };
  outstanding?: PortalFinanceOutstandingRow[];
  pnl?: PortalFinancePnlRow[];
  summary: {
    approvedExpenses?: number;
    clientOutstanding?: number;
    totalRevenue?: number;
  };
}

export interface PortalInvoiceListRow {
  balanceAmount?: number;
  clientName?: string;
  dueDate?: string;
  expectedAmount?: number;
  id: Key;
  invoiceNumber: string;
  jobCardId?: string;
  jobCode?: string;
  receivedAmount?: number;
  status?: string;
}

export interface FinanceViewProps {
  deleteItem: PortalDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  overview?: PortalFinanceOverview;
  removeInvoice: (args: { invoiceId?: string }) => Promise<unknown>;
  rows: PortalInvoiceListRow[];
}

export interface PortalExpenseListRow {
  amount?: number;
  approvalStatus?: string;
  canApproveFinance?: boolean;
  canApproveManager?: boolean;
  cardAmount?: number;
  cashAmount?: number;
  category: string;
  currency?: string;
  epayAmount?: number;
  expenseDate?: string;
  financeReviewStatus?: string;
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  managerReviewStatus?: string;
  notes?: string;
  paidBy?: string;
  particulars?: string;
  proofAttachment?: { fileName: string; id: string };
  reimbursementStatus?: string;
  submittedForApprovalAt?: string | null;
  tourManagerName?: string;
}

export interface ExpensesViewProps {
  decideExpenseFinance: (args: {
    expenseId: string;
    reimbursementStatus: string;
    status: string;
  }) => Promise<unknown>;
  decideExpenseManager: (args: { expenseId: string; status: string }) => Promise<unknown>;
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  getExpenseAttachmentUrl: (attachmentId: string) => Promise<string>;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeExpense: (args: { expenseId?: string }) => Promise<unknown>;
  removeExpenseProof: (args: { attachmentId: string }) => Promise<unknown>;
  rows: PortalExpenseListRow[];
  submitExpenseForApproval: (args: { expenseId: string }) => Promise<unknown>;
}

export interface PortalApprovalListRow {
  amount?: number;
  decisionNote?: string;
  id: Key;
  requestCode: string;
  requestedByName?: string;
  status?: string;
  summary?: string;
  type?: string;
}

export interface ApprovalsViewProps {
  decideApproval: (args: { approvalId: string; status: string }) => Promise<unknown>;
  deleteItem: PortalDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeApproval: (args: { approvalId?: string }) => Promise<unknown>;
  rows: PortalApprovalListRow[];
}

export interface PortalReportLocationRow {
  count?: number;
  id: Key;
  location?: string;
}

export interface PortalReportData {
  locationHeadcount: PortalReportLocationRow[];
  revenueByType: Array<{ count?: number; queryType: string; revenue?: number }>;
  summary: {
    confirmedQueries?: number;
    confirmedRevenue?: number;
    lostQueries?: number;
    totalPipelineBudget?: number;
  };
}

export interface ReportsViewProps {
  report?: PortalReportData;
}

export interface PortalTeamDirectoryRow {
  access?: string;
  department?: string;
  email?: string;
  function?: string;
  id: Key;
  isCurrentUser?: boolean;
  location?: string;
  mobile?: string;
  name: string;
  roles: string[];
}

export interface TeamViewProps {
  rows: PortalTeamDirectoryRow[];
}

export interface PortalActivityRow {
  actorName?: string;
  createdAt?: string;
  id: Key;
  message?: string;
}

export interface PortalNotificationRow {
  body?: string;
  createdAt?: string;
  entityId?: string;
  entityType?: string;
  id: Key;
  readAt?: string | null;
  title?: string;
}

export interface ActivityViewProps {
  activity: PortalActivityRow[];
  deleteItem: PortalDeleteHandler;
  markNotificationRead: (args: { notificationId: string }) => Promise<unknown>;
  notifications: PortalNotificationRow[];
  removeNotification: (args: { notificationId?: string }) => Promise<unknown>;
}

export interface PortalLeaveBalanceRow {
  availableDays?: number;
  fiscalYear?: string;
  leaveType: string;
}

export interface PortalLeaveListRow {
  canApproveFinal?: boolean;
  canApproveHead?: boolean;
  canApproveHr?: boolean;
  canReject?: boolean;
  department?: string;
  endDate?: string;
  headReviewerRole?: string;
  headReviewStatus?: string;
  hrReviewStatus?: string;
  id: Key;
  leaveType?: string;
  reason?: string;
  staffId?: string;
  staffName?: string;
  startDate?: string;
  status?: string;
}

export interface LeaveViewProps {
  access: PortalAccessSlice & { staffId?: string };
  decideLeave: (args: { leaveId: string; status: string }) => Promise<unknown>;
  deleteItem: PortalDeleteHandler;
  has: PortalPermissionChecker;
  leaveBalances?: PortalLeaveBalanceRow[];
  openModal: PortalModalOpener;
  removeLeave: (args: { leaveId?: string }) => Promise<unknown>;
  rows: PortalLeaveListRow[];
  staff?: Array<{ id: string; name: string }>;
}

export interface PortalStaffSettingsRow {
  active?: boolean;
  confirmationDate?: string;
  department?: string;
  email: string;
  emailAlertRoles?: string[];
  employmentStatus?: string;
  function?: string;
  id: Key;
  joiningDate?: string;
  leaveHeadApproverId?: string;
  leaveHeadApproverName?: string;
  leavePolicyGroup?: string;
  location?: string;
  marriageLeaveUsed?: boolean;
  maternityEventsUsed?: number;
  mobile?: string;
  name: string;
  onboardingStatus?: string;
  paternityEventsUsed?: number;
  reportingManagerName?: string;
  reportingManagerStaffId?: string;
  roles: string[];
}

export interface SettingsViewProps {
  deleteItem: PortalDeleteHandler;
  dropdowns: Record<string, string[]>;
  openModal: PortalModalOpener;
  removeStaff: (args: { staffId?: string }) => Promise<unknown>;
  search: string;
  staff: PortalStaffSettingsRow[];
  startStaffOnboarding: (args: { staffId: string }) => Promise<{ message?: string }>;
}

export type TicketingPortalViewComponent = (
  props: TicketDashboardViewProps | TicketsViewProps | PnrViewProps | SeatViewProps
) => ReactNode;

export type AdministrationPortalViewComponent = (
  props:
    | FinanceViewProps
    | ExpensesViewProps
    | ApprovalsViewProps
    | ReportsViewProps
    | TeamViewProps
    | ActivityViewProps
    | LeaveViewProps
    | SettingsViewProps
) => ReactNode;
