"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { usePortalServerAccess } from "@/components/portal/PortalAccessContext";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import type { PipelineMode } from "@/components/portal/pipeline/PipelineView";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { uploadExpenseProofFiles, uploadQueryFiles } from "@/lib/portal/fileUploads";
import {
  isPortalValidationError,
  isProposalPricingComplete,
  PROPOSAL_HANDOFF_TO_SALES_ERROR,
  validateModalForm,
} from "@/lib/portal/formValidation";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { createProductionModalCommandAdapter } from "@/lib/portal/modalCommandAdapter";
import { executeModalCommand } from "@/lib/portal/modalCommandExecutor";
import {
  createFocusedEditModalForm,
  createInitialModalForm,
  JOB_CARD_MODALS,
  jobCardProposalLinkPatch,
} from "@/lib/portal/modalLifecycle";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { dateRangeQueryArg } from "@/lib/portal/periodFilter";
import {
  canMoveContractingPipelineForAccess,
  canMoveSalesPipelineForAccess,
} from "@/lib/portal/pipelineMovementAccess";
import { canAccessPortalRoute, getPortalRouteDefinition } from "@/lib/portal/portalRouteManifest";
import { runMutation } from "@/lib/portal/runMutation";
import { parseUrlFilterState } from "@/lib/portal/urlFilterState";
import { INITIAL_FORM } from "@/lib/portal/workspaceContract";
import { buildPortalWorkspaceFilters } from "./workspace/portalWorkspaceFilters";
import { createPortalWorkspaceModel } from "./workspace/portalWorkspaceModel";
import { buildPortalWorkspaceRows } from "./workspace/portalWorkspaceRows";
import { useDashboardSummary } from "./workspace/usePortalDashboardSummary";
import { usePortalWorkspaceData } from "./workspace/usePortalWorkspaceData";
import { usePortalWorkspaceMutations } from "./workspace/usePortalWorkspaceMutations";
import type {
  AnyRecord,
  ConfirmFn,
  DateRangeState,
  ListFiltersState,
  MutationLike,
  PortalToastApi,
  StateUpdate,
} from "./workspace/workspaceStateTypes";
import { compactRows, resetWorkspaceView, resolveUpdate } from "./workspace/workspaceStateTypes";

const P = PORTAL_PERMISSIONS;

interface PatchAction {
  patch: Partial<WorkspaceState>;
  type: "patch";
}

interface WorkspaceState {
  dateRange: DateRangeState;
  error: string;
  fieldErrors: Record<string, string>;
  form: AnyRecord;
  isSaving: boolean;
  jobCardFilter: string;
  listFilters: ListFiltersState;
  modal: string | null;
  pendingExpenseProofFiles: File[];
  pendingProposalFiles: File[];
  pendingQueryFiles: File[];
  pipelineMode: PipelineMode;
  saveFlash: boolean;
  search: string;
}
const createInitialWorkspaceModalForm = createInitialModalForm as (input: AnyRecord) => AnyRecord;

function resolveFocusedDetail(
  type: unknown,
  details: { jobCard: unknown; proposal: unknown; query: unknown }
) {
  if (type === "query") {
    return details.query;
  }
  if (type === "proposal") {
    return details.proposal;
  }
  if (type === "jobCard") {
    return details.jobCard;
  }
}

function modalAuthorityBlocker(modal: string | null, form: AnyRecord) {
  if (["loading", "missing"].includes(String(form._focusedDetailState ?? ""))) {
    return "Wait for the current record to load before saving.";
  }
  if (modal !== "jobCard" || form.entityId) {
    return null;
  }
  if (form._confirmedOfferState === "loading") {
    return "Wait for the Confirmed Offer to load before opening the Job Card.";
  }
  if (form._confirmedOfferState !== "ready") {
    return "This Query has no Confirmed Offer. A Job Card cannot be opened.";
  }
  return null;
}

function usePortalWorkspaceImplementation(view: string, searchParams: URLSearchParams) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = usePortalToast() as PortalToastApi;
  const { confirm } = usePortalConfirm() as { confirm: ConfirmFn };
  const bootstrapListFilterConfig = getListFilterConfig(view, { pipelineMode: "sales" });
  const initialUrlFilters = parseUrlFilterState(searchParams, bootstrapListFilterConfig);
  const [workspace, patchWorkspace, , dispatchWorkspace] = usePatchReducer({
    dateRange: initialUrlFilters.dateRange,
    error: "",
    fieldErrors: {},
    form: INITIAL_FORM,
    isSaving: false,
    jobCardFilter: initialUrlFilters.jobCardFilter,
    listFilters: initialUrlFilters.listFilters,
    modal: null,
    pendingExpenseProofFiles: [],
    pendingProposalFiles: [],
    pendingQueryFiles: [],
    pipelineMode: "sales",
    saveFlash: false,
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
    fieldErrors,
    isSaving,
    pipelineMode,
    search,
    dateRange,
    jobCardFilter,
    listFilters,
    saveFlash,
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
  const setFieldErrors = (value: StateUpdate<Record<string, string>>) =>
    patchState({ fieldErrors: resolveUpdate(value, fieldErrors) });
  const setIsSaving = (value: StateUpdate<boolean>) =>
    patchState({ isSaving: resolveUpdate(value, isSaving) });
  const _setPipelineMode = (value: StateUpdate<PipelineMode>) =>
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
  const previousViewRef = useRef(view);

  useEffect(() => {
    const restored = parseUrlFilterState(
      new URLSearchParams(urlFilterSignature),
      getListFilterConfig(view, { pipelineMode })
    );
    dispatchWorkspace({
      patch: {
        ...resetWorkspaceView(previousViewRef, view),
        dateRange: restored.dateRange,
        jobCardFilter: restored.jobCardFilter,
        listFilters: restored.listFilters,
        search: restored.search,
      },
      type: "patch",
    });
  }, [dispatchWorkspace, pipelineMode, urlFilterSignature, view]);

  const { isAuthenticated } = useConvexAuth();
  const serverAccess = usePortalServerAccess();
  const liveAccess = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const access = liveAccess ?? serverAccess;
  const has = (permission: string) => Boolean(access?.permissions?.includes(permission));
  const meta = getPortalRouteDefinition(view);
  const allowed = canAccessPortalRoute({ access, has, view });
  const canFetch = isAuthenticated && access?.allowed;
  const [referenceNow] = useState(() => Date.now());

  const summary = useDashboardSummary(
    allowed,
    canFetch,
    dateRangeArg,
    referenceNow,
    meta.dependencies.includes("dashboard")
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
    emailDeliverySummaries,
    expenses,
    financeOverview,
    flightItinerary,
    focusedJobCard,
    focusedProposal,
    focusedQuery,
    hotels,
    invoices,
    jobCardDeletionOperations,
    jobCards,
    leaveBalances,
    leaveHeadApproverCandidates,
    leaves,
    notifications,
    passengerExportOperations,
    passengerImportOperations,
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
    applySalesDecision,
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
    getPassengerExportDownload,
    getPassportDocument,
    getProposalAttachmentUrl,
    getQueryAttachmentUrl,
    markNotificationRead,
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
    startPassengerExport,
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
    updateContractingProgress,
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
    setFieldErrors({});
    const next = initial.focusedDetailType
      ? { ...initial }
      : createInitialWorkspaceModalForm({
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
    setFieldErrors({});
    router.replace(filterUrlForState({ dateRange, jobCardFilter, listFilters, search }), {
      scroll: false,
    });
  };

  const updateForm = (field: string, value: unknown) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const patchForm = (patch: AnyRecord) => {
    setForm((current) => ({ ...current, ...patch }));
    const patchedErrorFields = Object.keys(patch).filter((field) => fieldErrors[field]);
    if (patchedErrorFields.length > 0) {
      setFieldErrors((current) => {
        const next = { ...current };
        for (const field of patchedErrorFields) {
          delete next[field];
        }
        return next;
      });
    }
  };

  const focusedDetail = resolveFocusedDetail(form.focusedDetailType, {
    jobCard: focusedJobCard,
    proposal: focusedProposal,
    query: focusedQuery,
  });
  const focusedDetailForm = (() => {
    if (!form.focusedDetailType) {
      return form;
    }
    const { focusedDetailType, ...draftOverrides } = form;
    if (focusedDetail === undefined) {
      return { ...draftOverrides, _focusedDetailState: "loading", focusedDetailType };
    }
    if (focusedDetail === null) {
      return { ...draftOverrides, _focusedDetailState: "missing", focusedDetailType };
    }
    const initial = createFocusedEditModalForm(focusedDetailType, focusedDetail);
    return {
      ...(initial ?? {}),
      ...draftOverrides,
      _focusedDetailState: "ready",
      focusedDetailType,
    };
  })();
  const jobCardLinkPatch = jobCardProposalLinkPatch({
    form: focusedDetailForm,
    modal,
    queries: compactRows(queries),
  });
  const jobCardLinkPatchSignature = JSON.stringify(jobCardLinkPatch);
  useEffect(() => {
    if (!jobCardLinkPatchSignature) {
      return;
    }
    const persistedJobCardLinkPatch = JSON.parse(
      jobCardLinkPatchSignature
    ) as typeof jobCardLinkPatch;
    if (!persistedJobCardLinkPatch) {
      return;
    }
    dispatchWorkspace({
      patch: { form: { ...form, ...persistedJobCardLinkPatch } },
      type: "patch",
    });
    // The serialized patch changes only when focused detail reaches a new
    // authority state. Persisting its query marker prevents later renders
    // from overwriting Accounts edits to pax or dates.
  }, [dispatchWorkspace, form, jobCardLinkPatchSignature]);
  const effectiveForm = jobCardLinkPatch
    ? { ...focusedDetailForm, ...jobCardLinkPatch }
    : focusedDetailForm;

  const submitToContracting = async ({ queryId }: { queryId: string }) => {
    try {
      await runMutation({ showToast: toast, successMessage: "Submitted to Contracting" }, () =>
        submitToContractingMutation({ queryId })
      );
    } catch {
      // Toast already shown by runMutation
    }
  };

  const deleteItem = async <Args extends AnyRecord>(
    label: string,
    mutation: MutationLike<Args>,
    args: Args,
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

  const deleteSelected = async <Args extends AnyRecord>(
    count: number,
    entityLabel: string,
    mutation: MutationLike<Args>,
    buildArgs: () => Args
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

  const sendProposalToSales = async ({
    proposalId,
    proposalRevision,
    queryId,
  }: {
    proposalId: string;
    proposalRevision: number;
    queryId: string;
  }) => {
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
        () => sendProposalToSalesMutation({ proposalId, proposalRevision, queryId })
      );
      return true;
    } catch {
      return false;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const authorityBlocker = modalAuthorityBlocker(modal, effectiveForm);
    if (authorityBlocker) {
      setError(authorityBlocker);
      return;
    }
    setError("");
    setFieldErrors({});
    try {
      validateModalForm(modal ?? "", effectiveForm, {
        access,
        has,
        jobCardModals: JOB_CARD_MODALS,
      });
    } catch (validationError) {
      if (isPortalValidationError(validationError)) {
        setFieldErrors({ [validationError.field]: validationError.message });
      } else {
        setError(validationError instanceof Error ? validationError.message : "Unable to save.");
      }
      return;
    }
    setIsSaving(true);
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
            adapter: createProductionModalCommandAdapter({
              administration: {
                attachExpenseProof,
                createExpense,
                createInvoice,
                createLeave,
                decideApproval,
                generateExpenseUploadUrl,
                has,
                pendingExpenseProofFiles,
                updateExpense,
                updateInvoice,
                updateLeave,
                uploadExpenseProofFiles,
                upsertStaff,
              },
              commercial: {
                addJobCardCollaborator,
                addProposalCollaborator,
                applySalesDecision,
                assignContracting,
                assignContractingOwner,
                assignJobCardCreator,
                assignOperationsOwner,
                assignQueryTeams,
                assignQueryTicketing,
                assignTicketingOwner,
                attachQueryFile,
                createJobCard,
                createProposal,
                createQuery,
                generateQueryUploadUrl,
                has,
                pendingQueryFiles,
                queries: queries || [],
                removeJobCardCollaborator,
                removeProposalCollaborator,
                updateContractingProgress,
                updateJobCard,
                updateProposal,
                updateQuery,
                uploadQueryFiles,
              },
              operations: {
                createHotel,
                createPnr,
                createTicket,
                createTourManager,
                createTraveller,
                createVisa,
                saveSeat,
                team: team || [],
                updateHotel,
                updatePnr,
                updateSeatAllocation,
                updateTicket,
                updateTourManager,
                updateTraveller,
                updateVisaRecord,
              },
              policy: {
                access,
                has,
                jobCardModals: JOB_CARD_MODALS,
              },
            }),
            form: effectiveForm,
            modal,
          });
        }
      );
      setIsSaving(false);
      patchState({ saveFlash: true });
      await new Promise((resolve) => setTimeout(resolve, 420));
      closeModal();
      patchState({ saveFlash: false });
    } catch (err) {
      const submitError = err as { data?: string; message?: string };
      setError(submitError.data || submitError.message || "Unable to save.");
      setIsSaving(false);
    }
  };

  let gate = "denied";
  if (access === undefined || !(isAuthenticated || serverAccess?.allowed)) {
    gate = "loading";
  } else if (allowed) {
    gate = "ready";
  }

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
    emailDeliverySummaries,
    encryptAndStorePassport,
    error,
    expenses,
    fieldErrors,
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
    filtersActive,
    financeOverview,
    flightItinerary,
    form: effectiveForm,
    gate,
    generateExpenseUploadUrl,
    generateFinalizedPdfUploadUrl,
    generateProposalUploadUrl,
    generateQueryUploadUrl,
    generateUploadUrl,
    getExpenseAttachmentUrl,
    getFinalizedPdfUrl,
    getPassengerExportDownload,
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
    meta,
    modal,
    moveContractingPipelineStage,
    moveSalesPipelineStage,
    notifications,
    openModal,
    pagination,
    passengerExportOperations,
    passengerImportOperations,
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
    saveCurrentView,
    savedViews: savedViewLinks,
    saveFlash,
    saveSeat,
    search,
    searchParams,
    searchPreparing,
    seats,
    sendProposalToSales,
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
    startPassengerExport,
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
    updateContractingProgress,
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
    updateSeatAllocation,
    updateTicket,
    updateTourManager,
    updateTraveller,
    updateVisaRecord,
    upsertStaff,
    view,
    viewResultCount,
    visas,
  };
}

export type PortalWorkspaceImplementationState = ReturnType<
  typeof usePortalWorkspaceImplementation
>;

export function usePortalWorkspaceState(view: string, searchParams: URLSearchParams) {
  return createPortalWorkspaceModel(usePortalWorkspaceImplementation(view, searchParams));
}
