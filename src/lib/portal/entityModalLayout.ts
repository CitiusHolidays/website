export type EntityModalSize = "compact" | "medium" | "wide" | "full";

const ENTITY_MODAL_SIZES = {
  addJobCardCollaborator: "compact",
  addProposalCollaborator: "compact",
  approvalDecide: "compact",
  assignContracting: "compact",
  assignContractingOwner: "compact",
  assignJobCardCreator: "compact",
  assignOperationsOwner: "compact",
  assignQueryTeams: "medium",
  assignQueryTicketing: "compact",
  assignTicketingOwner: "compact",
  expense: "wide",
  hotel: "wide",
  invoice: "medium",
  jobCard: "full",
  leave_create: "wide",
  pnr: "wide",
  proposal: "full",
  proposalAttachments: "wide",
  proposalFinalizedPdf: "wide",
  query: "full",
  queryAttachments: "wide",
  queryStatus: "medium",
  removeJobCardCollaborator: "compact",
  removeProposalCollaborator: "compact",
  salesDecision: "compact",
  seat: "medium",
  staff: "full",
  ticket: "wide",
  tourManager: "wide",
  travelBatch: "full",
  traveller: "full",
  visa: "wide",
  visa_create: "wide",
} satisfies Record<string, EntityModalSize>;

const SIZE_CLASS = {
  compact: "max-w-lg",
  full: "max-w-6xl",
  medium: "max-w-2xl",
  wide: "max-w-4xl",
} satisfies Record<EntityModalSize, string>;

export function getEntityModalSize(modal: string | null | undefined): EntityModalSize {
  if (!modal) {
    return "full";
  }
  return hasOwnKey(ENTITY_MODAL_SIZES, modal) ? ENTITY_MODAL_SIZES[modal] : "full";
}

export function getEntityModalMaxWidthClass(modal: string | null | undefined): string {
  return SIZE_CLASS[getEntityModalSize(modal)];
}

export function getEntityModalFieldColumns(modal: string | null | undefined): 1 | 2 {
  return getEntityModalSize(modal) === "compact" ? 1 : 2;
}

import { hasOwnKey } from "../runtimeValues";
