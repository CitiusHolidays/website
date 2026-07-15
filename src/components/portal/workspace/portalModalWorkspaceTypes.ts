import type { FormEvent } from "react";
import type {
  PortalAccessSlice,
  PortalLeaveBalanceRow,
  PortalPermissionChecker,
  PortalTeamMemberRow,
} from "./portalViewTypes";

/**
 * Narrow boundary for EntityModal + travel-batch submit orchestration.
 * Form state stays dynamic because modal commands accept heterogeneous field bags.
 */
export interface PortalEntityModalFormState {
  entityId?: string;
  jobCardId?: string;
  [field: string]: unknown;
}

export interface PortalTravelBatchModalWorkspaceSlice {
  access: PortalAccessSlice;
  attachFinalizedPdf: (args: Record<string, string>) => Promise<unknown>;
  attachProposalFile: (args: Record<string, string>) => Promise<unknown>;
  attachQueryFile: (args: Record<string, string>) => Promise<unknown>;
  closeModal: () => void;
  error: string;
  form: PortalEntityModalFormState;
  generateFinalizedPdfUploadUrl: (args: Record<string, never>) => Promise<string>;
  generateProposalUploadUrl: (args: Record<string, never>) => Promise<string>;
  generateQueryUploadUrl: (args: Record<string, never>) => Promise<string>;
  getExpenseAttachmentUrl: (attachmentId: string) => Promise<string>;
  getFinalizedPdfUrl: (proposalId: string) => Promise<string>;
  getProposalAttachmentUrl: (attachmentId: string) => Promise<string>;
  getQueryAttachmentUrl: (attachmentId: string) => Promise<string>;
  has: PortalPermissionChecker;
  isSaving: boolean;
  jobCards: Array<{ clientName?: string; id: string; jobCode: string }>;
  leaveBalances?: PortalLeaveBalanceRow[];
  leaveHeadApproverCandidates: Array<{ id: string; name: string }>;
  modal: string | null;
  patchForm: (patch: PortalEntityModalFormState) => void;
  pendingExpenseProofFiles: File[];
  pendingProposalFiles: File[];
  pendingQueryFiles: File[];
  pnrs: Array<{ id: string; jobCardId?: string; pnrCode: string; route?: string }>;
  proposals: Array<{ id: string }>;
  queries: Array<{ id: string }>;
  removeExpenseProof: (args: { attachmentId: string }) => Promise<unknown>;
  removeFinalizedPdf: (args: { proposalId: string }) => Promise<unknown>;
  removeProposalAttachment: (args: { attachmentId: string }) => Promise<unknown>;
  removeQueryAttachment: (args: { attachmentId: string }) => Promise<unknown>;
  setPendingExpenseProofFiles: (files: File[]) => void;
  setPendingProposalFiles: (files: File[]) => void;
  setPendingQueryFiles: (files: File[]) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  team: PortalTeamMemberRow[];
  travellers: Array<{ fullName: string; id: string; jobCardId?: string; jobCode?: string }>;
  travellersWithoutVisa: Array<{ fullName: string; id: string; jobCardId?: string }>;
  updateForm: (field: string, value: unknown) => void;
  visas: Array<{ id: string; travellerId?: string }>;
}
