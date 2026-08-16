import type { PortalWorkspaceImplementationState } from "@/components/portal/usePortalWorkspaceState";
import type { PortalSpreadsheetModalWorkspaceSlice } from "./modals/portalSpreadsheetModalTypes";
import type { PortalWorkspaceHeaderSlice } from "./PortalWorkspaceHeader";
import { createPortalRouteModel, type PortalRouteModel } from "./portalRouteLifecycle";

const DEEP_LINK_KEYS = [
  "searchParams",
  "allowed",
  "canFetch",
  "queries",
  "proposals",
  "jobCards",
  "tickets",
  "leaves",
  "expenses",
  "approvals",
  "deepLinkHandledRef",
  "openModal",
  "toast",
  "pathname",
  "search",
  "dateRange",
  "jobCardFilter",
  "listFilters",
  "listFilterConfig",
] as const satisfies readonly (keyof PortalWorkspaceImplementationState)[];

const HEADER_KEYS = [
  "access",
  "clearAllFilters",
  "dateRange",
  "error",
  "filtersActive",
  "has",
  "jobCardFilter",
  "jobCards",
  "listFilterConfig",
  "listFilters",
  "meta",
  "modal",
  "openModal",
  "pagination",
  "periodFiltered",
  "search",
  "searchPreparing",
  "setDateRangeWithUrl",
  "setJobCardFilterWithUrl",
  "setListFilterValue",
  "setSearchWithUrl",
  "showJobCardFilter",
  "team",
  "ticketDashboard",
  "view",
  "viewResultCount",
] as const satisfies readonly (keyof PortalWorkspaceImplementationState)[];

const PALETTE_KEYS = [
  "applySavedView",
  "clearAllFilters",
  "has",
  "meta",
  "openModal",
  "pathname",
  "savedViews",
] as const satisfies readonly (keyof PortalWorkspaceImplementationState)[];

const SAVED_VIEW_KEYS = [
  "applySavedView",
  "deleteSavedView",
  "saveCurrentView",
  "savedViews",
  "toggleSavedViewFavorite",
] as const satisfies readonly (keyof PortalWorkspaceImplementationState)[];

const MODAL_KEYS = [
  "access",
  "attachFinalizedPdf",
  "attachProposalFile",
  "attachQueryFile",
  "closeModal",
  "commitFlightImport",
  "commitPassengerImport",
  "error",
  "fieldErrors",
  "flightItinerary",
  "form",
  "generateFinalizedPdfUploadUrl",
  "generateProposalUploadUrl",
  "generateQueryUploadUrl",
  "getExpenseAttachmentUrl",
  "getFinalizedPdfUrl",
  "getPassengerExportDownload",
  "getProposalAttachmentUrl",
  "getQueryAttachmentUrl",
  "has",
  "isSaving",
  "jobCards",
  "leaveBalances",
  "leaveHeadApproverCandidates",
  "modal",
  "passengerExportOperations",
  "passengerImportOperations",
  "patchForm",
  "pendingExpenseProofFiles",
  "pendingProposalFiles",
  "pendingQueryFiles",
  "pnrs",
  "previewPassengerImport",
  "startPassengerExport",
  "proposals",
  "queries",
  "removeExpenseProof",
  "removeFinalizedPdf",
  "removeProposalAttachment",
  "removeQueryAttachment",
  "saveFlash",
  "setPendingExpenseProofFiles",
  "setPendingProposalFiles",
  "setPendingQueryFiles",
  "submit",
  "team",
  "travellers",
  "travellersWithoutVisa",
  "updateForm",
  "visas",
] as const satisfies readonly (keyof PortalWorkspaceImplementationState)[];

function pickFields<Source extends object, const Keys extends readonly (keyof Source)[]>(
  source: Source,
  keys: Keys
): Pick<Source, Keys[number]> {
  // SAFETY: every output entry is copied from source using exactly the caller-provided Keys tuple.
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<Source, Keys[number]>;
}

export interface PortalWorkspaceModel {
  chrome: {
    access: PortalWorkspaceImplementationState["access"];
    deepLink: Pick<PortalWorkspaceImplementationState, (typeof DEEP_LINK_KEYS)[number]>;
    header: PortalWorkspaceHeaderSlice;
    palette: Pick<PortalWorkspaceImplementationState, (typeof PALETTE_KEYS)[number]>;
    savedViews: Pick<PortalWorkspaceImplementationState, (typeof SAVED_VIEW_KEYS)[number]>;
  };
  lifecycle: {
    gate: string;
    view: string;
  };
  modal: PortalSpreadsheetModalWorkspaceSlice;
  route: PortalRouteModel;
}

export function createPortalWorkspaceModel(
  workspace: PortalWorkspaceImplementationState
): PortalWorkspaceModel {
  return {
    chrome: {
      access: workspace.access,
      deepLink: pickFields(workspace, DEEP_LINK_KEYS),
      header: pickFields(workspace, HEADER_KEYS),
      palette: pickFields(workspace, PALETTE_KEYS),
      savedViews: pickFields(workspace, SAVED_VIEW_KEYS),
    },
    lifecycle: { gate: workspace.gate, view: workspace.view },
    modal: pickFields(workspace, MODAL_KEYS),
    route: createPortalRouteModel(workspace.view, workspace),
  };
}
