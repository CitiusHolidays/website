import type { PipelineMode } from "@/components/portal/pipeline/PipelineView";
import type { usePortalWorkspaceState } from "@/components/portal/usePortalWorkspaceState";
import type {
  AdministrationPortalWorkspaceSlice,
  CorePortalWorkspaceSlice,
  OperationsPortalWorkspaceSlice,
  PilotPortalWorkspaceSlice,
  TicketingPortalWorkspaceSlice,
} from "./portalViewRegistry";

export type PortalWorkspaceHookState = ReturnType<typeof usePortalWorkspaceState>;

export interface PortalViewRegistryInputs {
  administration: Omit<AdministrationPortalWorkspaceSlice, "view">;
  core: Omit<CorePortalWorkspaceSlice, "view">;
  operations: Omit<OperationsPortalWorkspaceSlice, "view">;
  pilot: Omit<PilotPortalWorkspaceSlice, "view">;
  ticketing: Omit<TicketingPortalWorkspaceSlice, "view">;
  view: string;
}

export function buildPortalViewRegistryInputs(
  workspace: PortalWorkspaceHookState
): PortalViewRegistryInputs {
  return {
    administration: {
      access: workspace.access ?? {},
      decideApproval: workspace.decideApproval,
      decideExpenseFinance: workspace.decideExpenseFinance,
      decideExpenseManager: workspace.decideExpenseManager,
      decideLeave: workspace.decideLeave,
      deleteItem: workspace.deleteItem,
      dropdowns: workspace.dropdowns || {},
      filteredActivity: workspace.filteredActivity,
      filteredApprovals: workspace.filteredApprovals,
      filteredExpenses: workspace.filteredExpenses,
      filteredInvoices: workspace.filteredInvoices,
      filteredLeaves: workspace.filteredLeaves,
      filteredStaff: workspace.filteredStaff,
      filteredTeam: workspace.filteredTeam,
      filtersActive: workspace.filtersActive,
      financeOverview: workspace.financeOverview,
      getExpenseAttachmentUrl: workspace.getExpenseAttachmentUrl,
      has: workspace.has,
      leaveBalances: workspace.leaveBalances,
      markNotificationRead: workspace.markNotificationRead,
      openModal: workspace.openModal,
      periodFiltered: workspace.periodFiltered,
      removeApproval: workspace.removeApproval,
      removeExpense: workspace.removeExpense,
      removeExpenseProof: workspace.removeExpenseProof,
      removeInvoice: workspace.removeInvoice,
      removeLeave: workspace.removeLeave,
      removeNotification: workspace.removeNotification,
      removeStaff: workspace.removeStaff,
      reports: workspace.reports,
      search: workspace.search,
      staff: workspace.staff || workspace.team || [],
      startStaffOnboarding: workspace.startStaffOnboarding,
      submitExpenseForApproval: workspace.submitExpenseForApproval,
      team: workspace.team || [],
    },
    core: {
      access: workspace.access ?? {},
      accountsJobCardCreators: workspace.accountsJobCardCreators || [],
      canMoveContractingPipeline: workspace.canMoveContractingPipeline,
      canMoveSalesPipeline: workspace.canMoveSalesPipeline,
      dateRange: {
        from: workspace.dateRange.from ?? null,
        to: workspace.dateRange.to ?? null,
      },
      filteredAccountsQueries: workspace.filteredAccountsQueries,
      filteredJobCards: workspace.filteredJobCards,
      filteredPipelineQueries: workspace.filteredPipelineQueries,
      has: workspace.has,
      moveContractingPipelineStage: workspace.moveContractingPipelineStage,
      moveSalesPipelineStage: workspace.moveSalesPipelineStage,
      openModal: workspace.openModal,
      pipelineMode: workspace.pipelineMode as PipelineMode,
      setDateRangeWithUrl: workspace.setDateRangeWithUrl,
      setJobCardCreatorAccess: workspace.setJobCardCreatorAccess,
      setPipelineMode: workspace.setPipelineMode as (value: PipelineMode) => void,
      summary: workspace.summary,
    },
    operations: {
      access: workspace.access ?? {},
      deleteItem: workspace.deleteItem,
      deleteSelected: workspace.deleteSelected,
      encryptAndStorePassport: workspace.encryptAndStorePassport,
      filteredHotels: workspace.filteredHotels,
      filteredJobCards: workspace.filteredJobCards,
      filteredPassportTravellers: workspace.filteredPassportTravellers,
      filteredRoomingTravellers: workspace.filteredRoomingTravellers,
      filteredTourManagers: workspace.filteredTourManagers,
      filteredTravellers: workspace.filteredTravellers,
      filteredVisas: workspace.filteredVisas,
      filtersActive: workspace.filtersActive,
      generateUploadUrl: workspace.generateUploadUrl,
      getPassportDocument: workspace.getPassportDocument,
      has: workspace.has,
      jobCardDeletionOperations: workspace.jobCardDeletionOperations,
      jobCardFilter: workspace.jobCardFilter,
      jobCards: workspace.jobCards || [],
      openModal: workspace.openModal,
      pagination: workspace.pagination,
      periodFiltered: workspace.periodFiltered,
      removeHotel: workspace.removeHotel,
      removeJobCard: workspace.removeJobCard,
      removeManyHotels: workspace.removeManyHotels,
      removeManyTourManagers: workspace.removeManyTourManagers,
      removeManyTravellers: workspace.removeManyTravellers,
      removeManyVisas: workspace.removeManyVisas,
      removePassport: workspace.removePassport,
      removeTourManager: workspace.removeTourManager,
      removeTraveller: workspace.removeTraveller,
      removeVisa: workspace.removeVisa,
      roomCountSummary: workspace.roomCountSummary,
      setJobCardFilter: workspace.setJobCardFilterWithUrl,
      updateCallingStatus: workspace.updateCallingStatus,
      updateJobStatus: workspace.updateJobStatus,
    },
    pilot: {
      access: workspace.access ?? {},
      deleteItem: workspace.deleteItem,
      filteredContractingQueries: workspace.filteredContractingQueries,
      filteredProposals: workspace.filteredProposals,
      filteredQueries: workspace.filteredQueries,
      filtersActive: workspace.filtersActive,
      getFinalizedPdfUrl: workspace.getFinalizedPdfUrl,
      getProposalAttachmentUrl: workspace.getProposalAttachmentUrl,
      getQueryAttachmentUrl: workspace.getQueryAttachmentUrl,
      has: workspace.has,
      markProposalSent: workspace.markProposalSent,
      openModal: workspace.openModal,
      removeProposal: workspace.removeProposal,
      removeQuery: workspace.removeQuery,
      sendProposalToSales: workspace.sendProposalToSales,
      submitToContracting: workspace.submitToContracting,
      team: workspace.team || [],
    },
    ticketing: {
      deleteItem: workspace.deleteItem,
      deleteSelected: workspace.deleteSelected,
      filteredAllTickets: workspace.filteredAllTickets,
      filteredPnrs: workspace.filteredPnrs,
      filteredSeats: workspace.filteredSeats,
      filteredTickets: workspace.filteredTickets,
      has: workspace.has,
      openModal: workspace.openModal,
      periodFiltered: workspace.periodFiltered,
      removeManyPnrs: workspace.removeManyPnrs,
      removeManySeatAllocations: workspace.removeManySeatAllocations,
      removeManyTickets: workspace.removeManyTickets,
      removePnr: workspace.removePnr,
      removeSeatAllocation: workspace.removeSeatAllocation,
      removeTicket: workspace.removeTicket,
      ticketDashboard: workspace.ticketDashboard,
    },
    view: workspace.view,
  } as unknown as PortalViewRegistryInputs;
}

export const VIEW_PAGINATION_KEYS: Record<string, keyof PortalWorkspaceHookState["pagination"]> = {
  "accounts-job-cards": "queries",
  activity: "activity",
  approvals: "approvals",
  contracting: "queries",
  expenses: "expenses",
  finance: "invoices",
  flights: "flightOperations",
  hotels: "hotelOperations",
  "job-cards": "jobCards",
  leave: "leaves",
  passport: "travellers",
  pipeline: "queries",
  proposals: "proposals",
  queries: "queries",
  "seat-allocation": "seats",
  settings: "staff",
  team: "team",
  ticketing: "tickets",
  tickets: "tickets",
  "tour-managers": "tourManagers",
  travellers: "travellers",
  visa: "visas",
};

export function resolveViewPagination(
  view: string,
  pagination: PortalWorkspaceHookState["pagination"]
) {
  const key = VIEW_PAGINATION_KEYS[view];
  return key ? pagination[key] : undefined;
}
