import type { Id } from "@convex/_generated/dataModel";
import type { Key, ReactNode } from "react";
import type { PipelineMode } from "@/components/portal/pipeline/PipelineView";
import type { PortalWorkspaceImplementationState } from "@/components/portal/usePortalWorkspaceState";
import type { PortalPermission } from "@/lib/portal/workspaceContract";

type PortalWorkspaceState = PortalWorkspaceImplementationState;

export interface PortalAttachmentSummary {
  fileName: string;
  id: string;
}

export interface PortalQueryListRow {
  acceptedProposalId?: string | null;
  approxMargin?: number | null;
  attachmentCount?: number;
  attachments?: PortalAttachmentSummary[];
  batchingNotes?: string;
  budgetAmount?: number;
  clientName?: string;
  commercialProjectionState?: "preparing" | "ready";
  confirmedAt?: string | null;
  confirmedOffer?: {
    airfarePerPax: number;
    confirmedPax: number;
    destination: string;
    id: string;
    landCostPerPax: number;
    profitPerPax: number;
    proposalId: string;
    proposalQueryHandoffId: string | null;
    proposalRevision: number | null;
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
  hasConfirmedOffer?: boolean;
  id: Id<"queries">;
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
  proposalPreview?: {
    costPrice: number;
    handedOffRevision?: number | null;
    proposalCode: string;
    proposalId: string;
    proposalRevision: number;
    status: string;
    updatedAt: number;
  } | null;
  queryCode?: string;
  queryType?: string;
  salesOwnerId?: string;
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
  costPrice?: number;
  createdAt?: string;
  finalizedPdf?: {
    fileName: string;
    uploadedAt?: string;
  } | null;
  hasCollaborators?: boolean;
  id: Key;
  itinerarySummary?: string;
  landCostPerPax?: number;
  lastEditedAt?: string | null;
  lastEditedByName?: string | null;
  linkedQueryCount?: number;
  preparedBy?: string;
  previewQueryIds?: string[];
  pricingEnteredAt?: string | null;
  proposalCode?: string;
  proposalRevision: number;
  query?: {
    clientName?: string;
    contractingOwnerId?: string | null;
    id?: string;
    paxCount?: number;
    queryCode?: string;
  } | null;
  queryId?: string;
  queryPreview?: Array<{
    clientName?: string;
    contractingOwnerId?: string | null;
    handedOffAt?: string | null;
    handedOffRevision?: number | null;
    id?: string;
    pairState?:
      | "Confirmed"
      | "Draft"
      | "Lost"
      | "Revision requested"
      | "Stale"
      | "Unknown"
      | "With Sales";
    paxCount?: number;
    queryCode?: string;
    revisionRequestedAt?: string | null;
  }>;
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

export type PortalModalOpener = PortalWorkspaceState["openModal"];

export type PortalDeleteHandler = PortalWorkspaceState["deleteItem"];

export interface PortalAccessSlice {
  permissions?: string[];
  roles?: string[];
  staffId?: string;
}

export interface QueriesViewProps {
  access: PortalAccessSlice;
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  getFinalizedPdfUrl: PortalWorkspaceState["getFinalizedPdfUrl"];
  getQueryAttachmentUrl: PortalWorkspaceState["getQueryAttachmentUrl"];
  has: PortalPermissionChecker;
  loading?: boolean;
  openModal: PortalModalOpener;
  removeQuery: PortalWorkspaceState["removeQuery"];
  rows: PortalQueryListRow[];
  submitToContracting: PortalWorkspaceState["submitToContracting"];
}

export interface ContractingViewProps {
  access: PortalAccessSlice;
  canAssign: boolean;
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  getFinalizedPdfUrl: PortalWorkspaceState["getFinalizedPdfUrl"];
  getQueryAttachmentUrl: PortalWorkspaceState["getQueryAttachmentUrl"];
  has: PortalPermissionChecker;
  loading?: boolean;
  openModal: PortalModalOpener;
  removeQuery: PortalWorkspaceState["removeQuery"];
  rows: PortalQueryListRow[];
  team: PortalTeamMemberRow[];
}

export interface ProposalsViewProps {
  deleteItem: PortalDeleteHandler;
  getFinalizedPdfUrl: PortalWorkspaceState["getFinalizedPdfUrl"];
  getProposalAttachmentUrl: PortalWorkspaceState["getProposalAttachmentUrl"];
  has: PortalPermissionChecker;
  loading?: boolean;
  openModal: PortalModalOpener;
  removeProposal: PortalWorkspaceState["removeProposal"];
  rows: PortalProposalListRow[];
  sendProposalToSales: PortalWorkspaceState["sendProposalToSales"];
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
  urgentActionCategories?: Array<{
    complete: boolean;
    count: number;
    oldestCreatedAt?: string;
    type: string;
  }>;
  urgentActions?: Array<{
    createdAt?: string;
    href?: string;
    id: string;
    label?: string;
    type?: string;
  }>;
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
  moveContractingPipelineStage?: PortalWorkspaceState["moveContractingPipelineStage"];
  moveSalesPipelineStage?: PortalWorkspaceState["moveSalesPipelineStage"];
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
  setJobCardCreatorAccess: (args: { enabled: boolean; staffId: string }) => Promise<{ id: string }>;
}

export type CorePortalViewComponent = (
  props: DashboardViewProps | PipelineViewProps | AccountsJobCardViewProps
) => ReactNode;

export interface PortalJobCardListRow {
  clientName?: string;
  confirmedPax?: number;
  contractingOwnerName?: string;
  createdAt?: string;
  destination?: string;
  hasCollaborators?: boolean;
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

export type PortalBulkDeleteHandler = PortalWorkspaceState["deleteSelected"];

export interface PortalGridRow {
  id?: Key;
}

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
  loading?: boolean;
  openModal: PortalModalOpener;
  removeJobCard: PortalWorkspaceState["removeJobCard"];
  rows: PortalJobCardListRow[];
  updateJobStatus: PortalWorkspaceState["updateJobStatus"];
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
  removeManyTravellers: PortalWorkspaceState["removeManyTravellers"];
  removeTraveller: PortalWorkspaceState["removeTraveller"];
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
  filtersActive?: boolean;
  getPassportDocument: PortalWorkspaceState["getPassportDocument"];
  has: PortalPermissionChecker;
  removeManyTravellers: PortalWorkspaceState["removeManyTravellers"];
  removePassport: PortalWorkspaceState["removePassport"];
  removeTraveller: PortalWorkspaceState["removeTraveller"];
  travellers: PortalPassportTravellerRow[];
}

export interface VisaTrackingViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  loading?: boolean;
  openModal: PortalModalOpener;
  removeManyVisas: PortalWorkspaceState["removeManyVisas"];
  removeVisa: PortalWorkspaceState["removeVisa"];
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
  loading?: boolean;
  openModal: PortalModalOpener;
  removeHotel: PortalWorkspaceState["removeHotel"];
  removeManyHotels: PortalWorkspaceState["removeManyHotels"];
  removeManyTravellers: PortalWorkspaceState["removeManyTravellers"];
  removeTraveller: PortalWorkspaceState["removeTraveller"];
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
  removeManyTourManagers: PortalWorkspaceState["removeManyTourManagers"];
  removeTourManager: PortalWorkspaceState["removeTourManager"];
  rows: PortalTourManagerListRow[];
  travellers: PortalCallingBoardRow[];
  updateCallingStatus: PortalWorkspaceState["updateCallingStatus"];
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
  aggregateCoverage?: {
    bucketCount: number;
    complete: boolean;
    scope: string;
    updatedAt: string | null;
  };
  attention?: number;
  cancelled?: number;
  fitTickets?: number;
  groupTickets?: number;
  issued?: number;
  issuedSeats?: number;
  pending?: number;
  pnrCount?: number;
  preview: PortalTicketListRow[];
  refunded?: number;
  totalSeats?: number;
  workCoverage?: {
    distinctJobCount: number;
    from: string;
    pnrRowsRead: number;
    ticketRowsRead: number;
    to: string;
    truncated: boolean;
  };
}

export interface PortalTicketListRow {
  cabinClass?: string;
  id: Key;
  jobCardId?: string;
  jobCode?: string;
  mealPreference?: string;
  paymentType?: string;
  pnrCode?: string;
  pnrId?: null | string;
  seatNumber?: string;
  seatPreference?: string;
  ticketNumber?: string;
  ticketStatus?: string;
  ticketType?: string;
  travelBatchCode?: string;
  travelBatchReference?: string;
  travellerId?: null | string;
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
    importKey: string;
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
  removeManyTickets: PortalWorkspaceState["removeManyTickets"];
  removeTicket: PortalWorkspaceState["removeTicket"];
  summary?: PortalTicketDashboardSummary;
}

export interface TicketsViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  loading?: boolean;
  openModal: PortalModalOpener;
  removeManyTickets: PortalWorkspaceState["removeManyTickets"];
  removeTicket: PortalWorkspaceState["removeTicket"];
  rows: PortalTicketListRow[];
}

export interface PnrViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  itinerary: PortalFlightItineraryGroup[];
  openModal: PortalModalOpener;
  removeManyPnrs: PortalWorkspaceState["removeManyPnrs"];
  removePnr: PortalWorkspaceState["removePnr"];
  rows: PortalPnrListRow[];
}

export interface SeatViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeManySeatAllocations: PortalWorkspaceState["removeManySeatAllocations"];
  removeSeatAllocation: PortalWorkspaceState["removeSeatAllocation"];
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
  dueStatus?: "Overdue";
  id: Key;
  jobCode?: string;
  status?: string;
}

export interface PortalFinanceOverview {
  aggregateCoverage?: {
    bucketCount?: number;
    complete?: boolean;
    updatedAt?: null | string;
  };
  fundProjections?: {
    advancePipeline?: number;
    expectedCollections?: number;
    pendingExpenseApprovals?: number;
    pendingReimbursements?: number;
  };
  outstanding?: PortalFinanceOutstandingRow[];
  outstandingPagination?: PortalPaginationSlice;
  pnl?: PortalFinancePnlRow[];
  pnlPagination?: PortalPaginationSlice;
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
  loading?: boolean;
  openModal: PortalModalOpener;
  overview?: PortalFinanceOverview;
  removeInvoice: PortalWorkspaceState["removeInvoice"];
  rows: PortalInvoiceListRow[];
}

export interface PortalExpenseListRow {
  amount?: number;
  approvalStatus?: string;
  canApproveFinance?: boolean;
  canApproveManager?: boolean;
  canDelete?: boolean;
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
  decideExpenseFinance: PortalWorkspaceState["decideExpenseFinance"];
  decideExpenseManager: PortalWorkspaceState["decideExpenseManager"];
  deleteItem: PortalDeleteHandler;
  filtersActive?: boolean;
  getExpenseAttachmentUrl: PortalWorkspaceState["getExpenseAttachmentUrl"];
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeExpense: PortalWorkspaceState["removeExpense"];
  removeExpenseProof: PortalWorkspaceState["removeExpenseProof"];
  rows: PortalExpenseListRow[];
  submitExpenseForApproval: PortalWorkspaceState["submitExpenseForApproval"];
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
  decideApproval: PortalWorkspaceState["decideApproval"];
  deleteItem: PortalDeleteHandler;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeApproval: PortalWorkspaceState["removeApproval"];
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

export interface RecoveryCenterViewProps {
  access?: PortalAccessSlice;
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
  canViewActivityLog: boolean;
  deleteItem: PortalDeleteHandler;
  emailDeliverySummaries?: {
    coverage: "complete" | "partial";
    readinessState: "backfilling" | "failed" | "pending" | "ready" | "verifying";
    summaries: Array<{
      eventId: string;
      exhausted: number;
      origin?: { href: string; label: string };
      queued: number;
      retrying: number;
      sending: number;
      sent: number;
      skipped: number;
      total: number;
      updatedAt: number;
    }>;
  };
  markNotificationRead: PortalWorkspaceState["markNotificationRead"];
  notifications: PortalNotificationRow[];
  removeNotification: PortalWorkspaceState["removeNotification"];
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
  decideLeave: PortalWorkspaceState["decideLeave"];
  deleteItem: PortalDeleteHandler;
  has: PortalPermissionChecker;
  leaveBalances?: PortalLeaveBalanceRow[];
  openModal: PortalModalOpener;
  removeLeave: PortalWorkspaceState["removeLeave"];
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
  access?: PortalAccessSlice;
  deleteItem: PortalDeleteHandler;
  dropdowns: Record<string, string[]>;
  openModal: PortalModalOpener;
  removeStaff: PortalWorkspaceState["removeStaff"];
  search: string;
  staff: PortalStaffSettingsRow[];
  startStaffOnboarding: PortalWorkspaceState["startStaffOnboarding"];
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
    | RecoveryCenterViewProps
    | TeamViewProps
    | ActivityViewProps
    | LeaveViewProps
    | SettingsViewProps
) => ReactNode;
