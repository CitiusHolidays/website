"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import {
  uploadEntityFiles,
  uploadExpenseProofFiles,
  uploadQueryFiles,
} from "@/lib/portal/fileUploads";
import {
  isProposalPricingComplete,
  PROPOSAL_HANDOFF_TO_SALES_ERROR,
  PROPOSAL_MARK_SENT_ERROR,
} from "@/lib/portal/formValidation";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { executeModalCommand } from "@/lib/portal/modalCommandExecutor";
import { createInitialModalForm, JOB_CARD_MODALS } from "@/lib/portal/modalLifecycle";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { dateRangeQueryArg } from "@/lib/portal/periodFilter";
import { canAccessPipeline } from "@/lib/portal/permissions";
import {
  canMoveContractingPipelineForAccess,
  canMoveSalesPipelineForAccess,
} from "@/lib/portal/pipelineMovementAccess";
import { runMutation } from "@/lib/portal/runMutation";
import { parseUrlFilterState } from "@/lib/portal/urlFilterState";
import { INITIAL_FORM, VIEW_META } from "@/lib/portal/workspaceContract";
import { buildPortalWorkspaceFilters } from "./workspace/portalWorkspaceFilters";
import { buildPortalWorkspaceRows } from "./workspace/portalWorkspaceRows";
import { usePortalWorkspaceData } from "./workspace/usePortalWorkspaceData";
import { usePortalWorkspaceMutations } from "./workspace/usePortalWorkspaceMutations";
import type {
  AnyRecord,
  DateRangeState,
  ListFiltersState,
  MutationLike,
  StateUpdate,
} from "./workspace/workspaceStateTypes";
import { compactRows, resolveUpdate } from "./workspace/workspaceStateTypes";

const P = PORTAL_PERMISSIONS;
const _EMPTY_ARRAY: never[] = [];
const _EMPTY_OBJECT: Record<string, never> = {};

type PortalViewId = keyof typeof VIEW_META;

interface PatchAction {
  patch: Partial<WorkspaceState>;
  type: "patch";
}

interface WorkspaceState {
  dateRange: DateRangeState;
  error: string;
  form: AnyRecord;
  isSaving: boolean;
  jobCardFilter: string;
  listFilters: ListFiltersState;
  modal: string | null;
  pendingExpenseProofFiles: File[];
  pendingProposalFiles: File[];
  pendingQueryFiles: File[];
  pipelineMode: string;
  search: string;
}
type ConfirmFn = (options: {
  confirmLabel?: string;
  danger?: boolean;
  message: string;
  onConfirm?: () => Promise<unknown>;
  title: string;
}) => Promise<boolean>;
interface PortalToastApi {
  error: (message: string) => unknown;
  success: (message: string) => unknown;
}

const createInitialWorkspaceModalForm = createInitialModalForm as (input: AnyRecord) => AnyRecord;

export function usePortalWorkspaceState(view: string, searchParams: URLSearchParams) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = usePortalToast() as PortalToastApi;
  const { confirm } = usePortalConfirm() as { confirm: ConfirmFn };
  const bootstrapListFilterConfig = getListFilterConfig(view, { pipelineMode: "sales" });
  const initialUrlFilters = parseUrlFilterState(searchParams, bootstrapListFilterConfig);
  const [workspace, patchWorkspace, , dispatchWorkspace] = usePatchReducer({
    dateRange: initialUrlFilters.dateRange,
    error: "",
    form: INITIAL_FORM,
    isSaving: false,
    jobCardFilter: initialUrlFilters.jobCardFilter,
    listFilters: initialUrlFilters.listFilters,
    modal: null,
    pendingExpenseProofFiles: [],
    pendingProposalFiles: [],
    pendingQueryFiles: [],
    pipelineMode: "sales",
    search: initialUrlFilters.search,
  }) as [
    WorkspaceState,
    (patch: Partial<WorkspaceState>) => void,
    unknown,
    (action: PatchAction) => void,
  ];
  const {
    modal,
    form,
    pendingQueryFiles,
    pendingProposalFiles,
    pendingExpenseProofFiles,
    error,
    isSaving,
    pipelineMode,
    search,
    dateRange,
    jobCardFilter,
    listFilters,
  } = workspace;
  const patchState = (patch: Partial<WorkspaceState>) => patchWorkspace(patch);
  const setModal = (value: StateUpdate<string | null>) =>
    patchState({ modal: resolveUpdate(value, modal) });
  const setForm = (value: StateUpdate<AnyRecord>) =>
    patchState({ form: resolveUpdate(value, form) });
  const setPendingQueryFiles = (value: StateUpdate<File[]>) =>
    patchState({
      pendingQueryFiles: resolveUpdate(value, pendingQueryFiles),
    });
  const setPendingProposalFiles = (value: StateUpdate<File[]>) =>
    patchState({
      pendingProposalFiles: resolveUpdate(value, pendingProposalFiles),
    });
  const setPendingExpenseProofFiles = (value: StateUpdate<File[]>) =>
    patchState({
      pendingExpenseProofFiles: resolveUpdate(value, pendingExpenseProofFiles),
    });
  const setError = (value: StateUpdate<string>) =>
    patchState({ error: resolveUpdate(value, error) });
  const setIsSaving = (value: StateUpdate<boolean>) =>
    patchState({ isSaving: resolveUpdate(value, isSaving) });
  const _setPipelineMode = (value: StateUpdate<string>) =>
    patchState({ pipelineMode: resolveUpdate(value, pipelineMode) });
  const setSearch = (value: StateUpdate<string>) =>
    patchState({ search: resolveUpdate(value, search) });
  const setDateRange = (value: StateUpdate<DateRangeState>) =>
    patchState({ dateRange: resolveUpdate(value, dateRange) });
  const setJobCardFilter = (value: StateUpdate<string>) =>
    patchState({ jobCardFilter: resolveUpdate(value, jobCardFilter) });
  const setListFilters = (value: StateUpdate<ListFiltersState>) =>
    patchState({ listFilters: resolveUpdate(value, listFilters) });
  const listFilterConfig = getListFilterConfig(view, { pipelineMode });
  const dateRangeArg = dateRangeQueryArg(dateRange);
  const urlFilterSignature = searchParams.toString();
  const deepLinkId = searchParams.get("id");
  const deepLinkOpen = searchParams.get("open");
  const deepLinkQueryId = searchParams.get("queryId");
  const deepLinkHandledRef = useRef("");

  useEffect(() => {
    const restored = parseUrlFilterState(
      new URLSearchParams(urlFilterSignature),
      getListFilterConfig(view, { pipelineMode })
    );
    dispatchWorkspace({
      patch: {
        dateRange: restored.dateRange,
        jobCardFilter: restored.jobCardFilter,
        listFilters: restored.listFilters,
        search: restored.search,
      },
      type: "patch",
    });
  }, [dispatchWorkspace, pipelineMode, urlFilterSignature, view]);

  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const access = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const has = (permission: string) => Boolean(access?.permissions?.includes(permission));
  const viewMetaKey = (view in VIEW_META ? view : "dashboard") as PortalViewId;
  const meta = VIEW_META[viewMetaKey];
  const allowed =
    access?.allowed && (view === "pipeline" ? canAccessPipeline(access) : has(meta.permission));
  const canFetch = isAuthenticated && access?.allowed;
  const [referenceNow] = useState(() => Date.now());

  const summary = useQuery(
    api.crm.dashboard.getPortalSummary,
    canFetch && allowed && view === "dashboard"
      ? { dateRange: dateRangeArg, referenceNow }
      : "skip"
  );
  const savedViews = useQuery(
    api.crm.savedViews.listForPortal,
    canFetch && allowed ? { view } : "skip"
  );
  const createSavedView = useMutation(api.crm.savedViews.create);
  const updateSavedView = useMutation(api.crm.savedViews.update);
  const removeSavedView = useMutation(api.crm.savedViews.remove);
  const {
    accountsJobCardCreators,
    activity,
    approvals,
    dropdowns,
    expenses,
    financeOverview,
    flightItinerary,
    hotels,
    invoices,
    jobCardDeletionOperations,
    jobCards,
    leaveBalances,
    leaveHeadApproverCandidates,
    leaves,
    notifications,
    pagination,
    pnrs,
    proposals,
    queries,
    reports,
    roomCountSummary,
    searchPreparing,
    seats,
    staff,
    team,
    ticketDashboard,
    tickets,
    tourManagers,
    travellers,
    travellersWithoutVisa,
    visas,
  } = usePortalWorkspaceData({
    access,
    canFetch,
    dateRangeArg,
    deepLinkId,
    deepLinkOpen,
    deepLinkQueryId,
    form,
    has,
    jobCardFilter,
    listFilters,
    modal,
    search,
    view,
  });
  const {
    addJobCardCollaborator,
    addProposalCollaborator,
    assignContracting,
    assignContractingOwner,
    assignJobCardCreator,
    assignOperationsOwner,
    assignQueryTeams,
    assignQueryTicketing,
    assignTicketingOwner,
    attachExpenseProof,
    attachFinalizedPdf,
    attachProposalFile,
    attachQueryFile,
    commitFlightImport,
    commitPassengerImport,
    createExpense,
    createHotel,
    createInvoice,
    createJobCard,
    createLeave,
    createPnr,
    createProposal,
    createQuery,
    createTicket,
    createTourManager,
    createTraveller,
    createVisa,
    decideApproval,
    decideExpenseFinance,
    decideExpenseManager,
    decideLeave,
    encryptAndStorePassport,
    generateExpenseUploadUrl,
    generateFinalizedPdfUploadUrl,
    generateProposalUploadUrl,
    generateQueryUploadUrl,
    generateUploadUrl,
    getExpenseAttachmentUrl,
    getFinalizedPdfUrl,
    getPassengerExportRows,
    getPassportDocument,
    getProposalAttachmentUrl,
    getQueryAttachmentUrl,
    markNotificationRead,
    markProposalSent: markProposalSentMutation,
    moveContractingPipelineStageMutation,
    moveSalesPipelineStageMutation,
    previewPassengerImport,
    removeApproval,
    removeExpense,
    removeExpenseProof,
    removeFinalizedPdf,
    removeHotel,
    removeInvoice,
    removeJobCard,
    removeJobCardCollaborator,
    removeLeave,
    removeManyHotels,
    removeManyPnrs,
    removeManySeatAllocations,
    removeManyTickets,
    removeManyTourManagers,
    removeManyTravellers,
    removeManyVisas,
    removeNotification,
    removePassport,
    removePnr,
    removeProposal,
    removeProposalAttachment,
    removeProposalCollaborator,
    removeQuery,
    removeQueryAttachment,
    removeSeatAllocation,
    removeStaff,
    removeTicket,
    removeTourManager,
    removeTraveller,
    removeVisa,
    saveSeat,
    sendProposalToSales: sendProposalToSalesMutation,
    setJobCardCreatorAccess,
    startStaffOnboarding,
    submitExpenseForApproval,
    submitToContractingMutation,
    updateCallingStatus,
    updateExpense,
    updateHotel,
    updateInvoice,
    updateJobCard,
    updateJobStatus,
    updateLeave,
    updatePnr,
    updateProposal,
    updateQuery,
    updateQueryStatus,
    updateSeatAllocation,
    updateTicket,
    updateTourManager,
    updateTraveller,
    updateVisaRecord,
    upsertStaff,
  } = usePortalWorkspaceMutations();

  const canViewTravellers = Boolean(access?.permissions?.includes(P.VIEW_TRAVELLERS));
  const pipelineRoles = access?.roles ?? [];
  const canMoveSalesPipeline = canMoveSalesPipelineForAccess(has(P.MANAGE_QUERIES), pipelineRoles);
  const canMoveContractingPipeline = canMoveContractingPipelineForAccess(
    has(P.MANAGE_PROPOSALS),
    pipelineRoles
  );
  const moveContractingPipelineStage = moveContractingPipelineStageMutation;
  const moveSalesPipelineStage = moveSalesPipelineStageMutation;
  const travellerRows = compactRows(travellers) as AnyRecord[];
  const travellersWithPassportExpiry = travellerRows;
  const {
    filteredAccountsQueries,
    filteredActivity,
    filteredAllTickets,
    filteredApprovals,
    filteredContractingQueries,
    filteredExpenses,
    filteredHotels,
    filteredInvoices,
    filteredJobCards,
    filteredLeaves,
    filteredPassportTravellers,
    filteredPipelineQueries,
    filteredPnrs,
    filteredProposals,
    filteredQueries,
    filteredRoomingTravellers,
    filteredSeats,
    filteredStaff,
    filteredTeam,
    filteredTickets,
    filteredTourManagers,
    filteredTravellers,
    filteredVisas,
    periodFiltered,
    viewResultCount,
    workspaceRows,
  } = buildPortalWorkspaceRows({
    activity,
    approvals,
    dateRange,
    expenses,
    flightItinerary,
    hotels,
    invoices,
    jobCardFilter,
    jobCards,
    leaves,
    listFilterConfig,
    listFilters,
    notifications,
    pnrs,
    proposals,
    queries,
    search,
    seats,
    staff,
    team,
    tickets,
    tourManagers,
    travellersWithPassportExpiry,
    view,
    visas,
  });

  const {
    applySavedView,
    clearAllFilters,
    deleteSavedView,
    filterUrlForState,
    filtersActive,
    replaceFilterUrl,
    saveCurrentView,
    savedViewLinks,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setSearchWithUrl,
    showJobCardFilter,
    toggleSavedViewFavorite,
    toggleSavedViewPinned,
  } = buildPortalWorkspaceFilters({
    allowed,
    createSavedView,
    dateRange,
    jobCardFilter,
    listFilterConfig,
    listFilters,
    pathname,
    removeSavedView: removeSavedView as unknown as MutationLike,
    router,
    savedViews,
    search,
    searchParams,
    setDateRange,
    setJobCardFilter,
    setListFilters,
    setSearch,
    showToast: toast,
    updateSavedView: updateSavedView as unknown as MutationLike,
    view,
  });

  const openModal = (type: string, initial: AnyRecord = {}) => {
    setError("");
    const next = createInitialWorkspaceModalForm({
      access,
      initial,
      initialForm: INITIAL_FORM,
      jobCards: compactRows(jobCards),
      pnrs: compactRows(pnrs),
      proposals: compactRows(proposals),
      queries: compactRows(queries),
      travellers: compactRows(travellers),
      travellersWithoutVisa: compactRows(travellersWithoutVisa),
      type,
      visas: compactRows(visas),
    });
    setForm(next);
    setModal(type);
    if (type !== "query") {
      setPendingQueryFiles([]);
    }
    if (type !== "proposal") {
      setPendingProposalFiles([]);
    }
    if (type !== "expense") {
      setPendingExpenseProofFiles([]);
    }
  };

  const closeModal = () => {
    setModal(null);
    setForm(INITIAL_FORM);
    setPendingQueryFiles([]);
    setPendingProposalFiles([]);
    setPendingExpenseProofFiles([]);
    setError("");
    router.replace(filterUrlForState({ dateRange, jobCardFilter, listFilters, search }), {
      scroll: false,
    });
  };

  const updateForm = (field: string, value: unknown) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const patchForm = (patch: AnyRecord) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const submitToContracting = async ({ queryId }: { queryId: string }) => {
    try {
      await runMutation({ showToast: toast, successMessage: "Submitted to Contracting" }, () =>
        submitToContractingMutation({ queryId })
      );
    } catch {
      // Toast already shown by runMutation
    }
  };

  const deleteItem = async (
    label: string,
    mutation: MutationLike,
    args: AnyRecord,
    options: { confirmMessage?: string } = {}
  ) => {
    setError("");
    const confirmMessage = options.confirmMessage || `Delete ${label}? This cannot be undone.`;
    await confirm({
      confirmLabel: "Delete",
      danger: true,
      message: confirmMessage,
      onConfirm: () =>
        runMutation({ label, showToast: toast, successMessage: `${label} deleted` }, () =>
          mutation(args)
        ),
      title: "Delete record",
    });
  };

  const deleteSelected = async (
    count: number,
    entityLabel: string,
    mutation: MutationLike,
    buildArgs: () => AnyRecord
  ) => {
    setError("");
    if (count === 0) {
      return false;
    }
    const noun = count === 1 ? entityLabel : `${entityLabel}s`;
    return await confirm({
      confirmLabel: "Delete",
      danger: true,
      message: `Delete ${count} selected ${noun}? This cannot be undone.`,
      onConfirm: () =>
        runMutation({ showToast: toast, successMessage: `Deleted ${count} ${noun}` }, () =>
          mutation(buildArgs())
        ),
      title: "Delete selected",
    });
  };

  const proposalById = (proposalId: string): AnyRecord | undefined =>
    compactRows(proposals).find((proposal) => proposal.id === proposalId) as AnyRecord | undefined;

  const rejectIncompleteProposalHandoff = (proposal: AnyRecord | undefined, message: string) => {
    if (!proposal || isProposalPricingComplete(proposal)) {
      return false;
    }
    setError(message);
    toast.error(message);
    return true;
  };

  const markProposalSent = async ({ proposalId }: { proposalId: string }) => {
    setError("");
    if (rejectIncompleteProposalHandoff(proposalById(proposalId), PROPOSAL_MARK_SENT_ERROR)) {
      return false;
    }
    try {
      await runMutation(
        {
          label: "Mark sent",
          onError: (message) => setError(message),
          showToast: toast,
          successMessage: "Proposal marked sent.",
        },
        () => markProposalSentMutation({ proposalId })
      );
      return true;
    } catch {
      return false;
    }
  };

  const sendProposalToSales = async ({ proposalId }: { proposalId: string }) => {
    setError("");
    if (
      rejectIncompleteProposalHandoff(proposalById(proposalId), PROPOSAL_HANDOFF_TO_SALES_ERROR)
    ) {
      return false;
    }
    try {
      await runMutation(
        {
          label: "Send to Sales",
          onError: (message) => setError(message),
          showToast: toast,
          successMessage: "Proposal sent to Sales.",
        },
        () => sendProposalToSalesMutation({ proposalId })
      );
      return true;
    } catch {
      return false;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      let saveSuccessMessage = "Saved";
      await runMutation(
        {
          label: "Save",
          onError: (message) => setError(message),
          showToast: toast,
          successMessage: () => saveSuccessMessage,
        },
        async () => {
          saveSuccessMessage = await executeModalCommand({
            deps: {
              access,
              addJobCardCollaborator,
              addProposalCollaborator,
              assignContracting,
              assignContractingOwner,
              assignJobCardCreator,
              assignOperationsOwner,
              assignQueryTeams,
              assignQueryTicketing,
              assignTicketingOwner,
              attachExpenseProof,
              attachProposalFile,
              attachQueryFile,
              createExpense,
              createHotel,
              createInvoice,
              createJobCard,
              createLeave,
              createPnr,
              createProposal,
              createQuery,
              createTicket,
              createTourManager,
              createTraveller,
              createVisa,
              decideApproval,
              generateExpenseUploadUrl,
              generateProposalUploadUrl,
              generateQueryUploadUrl,
              has,
              jobCardModals: JOB_CARD_MODALS,
              pendingExpenseProofFiles,
              pendingProposalFiles,
              pendingQueryFiles,
              queries: queries || [],
              removeJobCardCollaborator,
              removeProposalCollaborator,
              saveSeat,
              team: team || [],
              updateExpense,
              updateHotel,
              updateInvoice,
              updateJobCard,
              updateLeave,
              updatePnr,
              updateProposal,
              updateQuery,
              updateQueryStatus,
              updateSeatAllocation,
              updateTicket,
              updateTourManager,
              updateTraveller,
              updateVisaRecord,
              uploadEntityFiles,
              uploadExpenseProofFiles,
              uploadQueryFiles,
              upsertStaff,
            },
            form,
            modal,
          });
          closeModal();
        }
      );
    } catch (err) {
      const submitError = err as { data?: string; message?: string };
      setError(submitError.data || submitError.message || "Unable to save.");
    }
    setIsSaving(false);
  };

  let gate = "denied";
  if (isAuthLoading || !isAuthenticated || access === undefined) {
    gate = "loading";
  } else if (allowed) {
    gate = "ready";
  }

  const session = {
    access,
    allowed,
    canFetch,
    canViewTravellers,
    gate,
    has,
  };
  const filterState = {
    clearAllFilters,
    dateRange,
    filtersActive,
    jobCardFilter,
    listFilterConfig,
    listFilters,
    periodFiltered,
    replaceFilterUrl,
    search,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setSearchWithUrl,
    showJobCardFilter,
  };
  const modalControls = {
    closeModal,
    error,
    form,
    isSaving,
    modal,
    openModal,
    patchForm,
    submit,
    updateForm,
  };
  const commands = {
    applySavedView,
    clearAllFilters,
    closeModal,
    deleteItem,
    deleteSavedView,
    deleteSelected,
    openModal,
    saveCurrentView,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setSearchWithUrl,
    submit,
    toggleSavedViewFavorite,
    toggleSavedViewPinned,
  };
  const workspaceFacade = {
    commands,
    filters: filterState,
    modal: modalControls,
    rows: workspaceRows,
    savedViews: savedViewLinks,
    session,
  };

  return {
    access,
    accountsJobCardCreators,
    activity,
    addJobCardCollaborator,
    addProposalCollaborator,
    allowed,
    applySavedView,
    approvals,
    assignContracting,
    assignJobCardCreator,
    assignQueryTeams,
    assignQueryTicketing,
    attachExpenseProof,
    attachFinalizedPdf,
    attachProposalFile,
    attachQueryFile,
    canFetch,
    canMoveContractingPipeline,
    canMoveSalesPipeline,
    canViewTravellers,
    clearAllFilters,
    closeModal,
    commands,
    commitFlightImport,
    commitPassengerImport,
    createExpense,
    createHotel,
    createInvoice,
    createJobCard,
    createLeave,
    createPnr,
    createProposal,
    createQuery,
    createTicket,
    createTourManager,
    createTraveller,
    createVisa,
    dateRange,
    decideApproval,
    decideExpenseFinance,
    decideExpenseManager,
    decideLeave,
    deepLinkHandledRef,
    deleteItem,
    deleteSavedView,
    deleteSelected,
    dropdowns,
    encryptAndStorePassport,
    error,
    expenses,
    filteredAccountsQueries,
    filteredActivity,
    filteredAllTickets,
    filteredApprovals,
    filteredContractingQueries,
    filteredExpenses,
    filteredHotels,
    filteredInvoices,
    filteredJobCards,
    filteredLeaves,
    filteredPassportTravellers,
    filteredPipelineQueries,
    filteredPnrs,
    filteredProposals,
    filteredQueries,
    filteredRoomingTravellers,
    filteredSeats,
    filteredStaff,
    filteredTeam,
    filteredTickets,
    filteredTourManagers,
    filteredTravellers,
    filteredVisas,
    filters: filterState,
    filtersActive,
    financeOverview,
    flightItinerary,
    form,
    gate,
    generateExpenseUploadUrl,
    generateFinalizedPdfUploadUrl,
    generateProposalUploadUrl,
    generateQueryUploadUrl,
    generateUploadUrl,
    getExpenseAttachmentUrl,
    getFinalizedPdfUrl,
    getPassengerExportRows,
    getPassportDocument,
    getProposalAttachmentUrl,
    getQueryAttachmentUrl,
    has,
    hotels,
    invoices,
    isSaving,
    jobCardDeletionOperations,
    jobCardFilter,
    jobCards,
    leaveBalances,
    leaveHeadApproverCandidates,
    leaves,
    listFilterConfig,
    listFilters,
    markNotificationRead,
    markProposalSent,
    meta,
    modal,
    moveContractingPipelineStage,
    moveSalesPipelineStage,
    notifications,
    openModal,
    pagination,
    patchForm,
    pathname,
    pendingExpenseProofFiles,
    pendingProposalFiles,
    pendingQueryFiles,
    periodFiltered,
    pipelineMode,
    pnrs,
    previewPassengerImport,
    proposals,
    queries,
    removeApproval,
    removeExpense,
    removeExpenseProof,
    removeFinalizedPdf,
    removeHotel,
    removeInvoice,
    removeJobCard,
    removeJobCardCollaborator,
    removeLeave,
    removeManyHotels,
    removeManyPnrs,
    removeManySeatAllocations,
    removeManyTickets,
    removeManyTourManagers,
    removeManyTravellers,
    removeManyVisas,
    removeNotification,
    removePassport,
    removePnr,
    removeProposal,
    removeProposalAttachment,
    removeProposalCollaborator,
    removeQuery,
    removeQueryAttachment,
    removeSeatAllocation,
    removeStaff,
    removeTicket,
    removeTourManager,
    removeTraveller,
    removeVisa,
    replaceFilterUrl,
    reports,
    roomCountSummary,
    router,
    rows: workspaceRows,
    saveCurrentView,
    savedViews: savedViewLinks,
    saveSeat,
    search,
    searchParams,
    searchPreparing,
    seats,
    sendProposalToSales,
    session,
    setDateRangeWithUrl,
    setJobCardCreatorAccess,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setPendingExpenseProofFiles,
    setPendingProposalFiles,
    setPendingQueryFiles,
    setPipelineMode: _setPipelineMode,
    setSearchWithUrl,
    showJobCardFilter,
    staff,
    startStaffOnboarding,
    submit,
    submitExpenseForApproval,
    submitToContracting,
    summary,
    team,
    ticketDashboard,
    tickets,
    toast,
    toggleSavedViewFavorite,
    toggleSavedViewPinned,
    tourManagers,
    travellerRows,
    travellers,
    travellersWithoutVisa,
    travellersWithPassportExpiry,
    updateCallingStatus,
    updateExpense,
    updateForm,
    updateHotel,
    updateInvoice,
    updateJobCard,
    updateJobStatus,
    updateLeave,
    updatePnr,
    updateProposal,
    updateQuery,
    updateQueryStatus,
    updateSeatAllocation,
    updateTicket,
    updateTourManager,
    updateTraveller,
    updateVisaRecord,
    upsertStaff,
    view,
    viewResultCount,
    visas,
    workspace: workspaceFacade,
  };
}
