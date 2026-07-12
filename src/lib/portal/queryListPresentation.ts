export type QueryPrimaryActionKind = "assign" | "status" | "submit" | null;

interface QueryPrimaryActionInput {
  canAssignTeams: boolean;
  canManageQueries: boolean;
  submittedToContractingAt?: unknown;
}

interface QueryAttentionInput {
  contractingOwnerId?: string;
  destination?: string;
  leadStage?: string;
  lostReason?: string;
  lostReasonOther?: string;
  submittedToContractingAt?: unknown;
  ticketingOwnerId?: string;
  ticketingScope?: string;
  travelStartDate?: string;
}

export function getQueryPrimaryActionKind({
  canAssignTeams,
  canManageQueries,
  submittedToContractingAt,
}: QueryPrimaryActionInput): QueryPrimaryActionKind {
  if (canManageQueries) {
    return submittedToContractingAt ? "status" : "submit";
  }
  return canAssignTeams ? "assign" : null;
}

export function getQueryAttentionLabel(query: QueryAttentionInput): string {
  if (query.leadStage === "Lost") {
    const reason = query.lostReasonOther?.trim() || query.lostReason?.trim();
    return reason ? `Lost — ${reason}` : "Order lost";
  }
  if (!query.submittedToContractingAt) {
    return "Contracting handoff pending";
  }
  if (!query.contractingOwnerId) {
    return "Contracting SPOC unassigned";
  }
  if (!query.ticketingScope?.trim()) {
    return "Ticketing scope pending";
  }
  const needsTicketing = Boolean(query.ticketingScope && query.ticketingScope !== "Not required");
  if (needsTicketing && !query.ticketingOwnerId) {
    return "Ticketing SPOC unassigned";
  }
  if (!query.destination?.trim()) {
    return "Destination needs confirmation";
  }
  if (!query.travelStartDate) {
    return "Travel dates need confirmation";
  }
  return "No open exception";
}
