import type { PortalWorkspaceImplementationState } from "@/components/portal/usePortalWorkspaceState";
import type { JsonValue } from "@/lib/jsonValue";
import type { PortalAccessSlice } from "./portalViewTypes";

type PortalWorkspaceState = PortalWorkspaceImplementationState;

/**
 * Dynamic form state shared by the heterogeneous entity-modal commands.
 */
export interface PortalEntityModalFormState {
  entityId?: string;
  jobCardId?: string;
  [field: string]: JsonValue;
}

type PortalTravelBatchModalWorkspaceBase = Pick<
  PortalWorkspaceState,
  | "attachFinalizedPdf"
  | "attachProposalFile"
  | "attachQueryFile"
  | "closeModal"
  | "error"
  | "fieldErrors"
  | "form"
  | "generateFinalizedPdfUploadUrl"
  | "generateProposalUploadUrl"
  | "generateQueryUploadUrl"
  | "getExpenseAttachmentUrl"
  | "getFinalizedPdfUrl"
  | "getProposalAttachmentUrl"
  | "getQueryAttachmentUrl"
  | "has"
  | "isSaving"
  | "leaveBalances"
  | "modal"
  | "modalInstanceId"
  | "patchForm"
  | "pendingExpenseProofFiles"
  | "pendingProposalFiles"
  | "pendingQueryFiles"
  | "removeExpenseProof"
  | "removeFinalizedPdf"
  | "removeProposalAttachment"
  | "removeQueryAttachment"
  | "saveFlash"
  | "setPendingExpenseProofFiles"
  | "setPendingProposalFiles"
  | "setPendingQueryFiles"
  | "submit"
  | "updateForm"
>;

/**
 * Exact production workspace contract consumed by the entity-modal bridge.
 * Query-backed collections are normalized before crossing this boundary.
 */
export type PortalTravelBatchModalWorkspaceSlice = PortalTravelBatchModalWorkspaceBase & {
  access: PortalAccessSlice;
  jobCards: NonNullable<PortalWorkspaceState["jobCards"]>;
  leaveHeadApproverCandidates: NonNullable<PortalWorkspaceState["leaveHeadApproverCandidates"]>;
  pnrs: NonNullable<PortalWorkspaceState["pnrs"]>;
  proposals: NonNullable<PortalWorkspaceState["proposals"]>;
  queries: NonNullable<PortalWorkspaceState["queries"]>;
  team: NonNullable<PortalWorkspaceState["team"]>;
  travellers: NonNullable<PortalWorkspaceState["travellers"]>;
  travellersWithoutVisa: NonNullable<PortalWorkspaceState["travellersWithoutVisa"]>;
  visas: NonNullable<PortalWorkspaceState["visas"]>;
};
