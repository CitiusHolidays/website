export type EntityModalSize = "compact" | "medium" | "wide" | "full";

const ENTITY_MODAL_SIZES: Record<string, EntityModalSize> = {
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
  expense: "medium",
  hotel: "medium",
  invoice: "medium",
  jobCard: "full",
  leave_create: "medium",
  pnr: "medium",
  proposal: "full",
  proposalAttachments: "wide",
  proposalFinalizedPdf: "wide",
  query: "full",
  queryAttachments: "wide",
  queryStatus: "medium",
  removeJobCardCollaborator: "compact",
  removeProposalCollaborator: "compact",
  salesDecision: "compact",
  seat: "compact",
  staff: "medium",
  ticket: "medium",
  tourManager: "compact",
  travelBatch: "compact",
  traveller: "full",
  visa: "medium",
  visa_create: "medium",
};

const SIZE_CLASS: Record<EntityModalSize, string> = {
  compact: "max-w-md",
  full: "max-w-3xl",
  medium: "max-w-lg",
  wide: "max-w-2xl",
};

export function getEntityModalSize(modal: string | null | undefined): EntityModalSize {
  if (!modal) {
    return "full";
  }
  return ENTITY_MODAL_SIZES[modal] ?? "full";
}

export function getEntityModalMaxWidthClass(modal: string | null | undefined): string {
  return SIZE_CLASS[getEntityModalSize(modal)];
}

export function getEntityModalFieldColumns(modal: string | null | undefined): 1 | 2 {
  return getEntityModalSize(modal) === "compact" ? 1 : 2;
}
