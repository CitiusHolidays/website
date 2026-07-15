export type ProposalAttentionTone = "danger" | "info" | "warning" | undefined;

interface ProposalAttentionInput {
  createdAt?: string;
  pricingEnteredAt?: string | null;
  queries?: Array<{ contractingOwnerId?: string | null }>;
  query?: { contractingOwnerId?: string | null } | null;
  sentToClientAt?: string | null;
  status?: string;
  updatedAt?: string;
}

export interface ProposalAttention {
  label: string;
  tone: ProposalAttentionTone;
}

export function proposalWorkflowLabel(
  proposal: ProposalAttentionInput | string | null | undefined
): string {
  const row = typeof proposal === "string" ? { status: proposal } : proposal;
  if (row?.sentToClientAt) {
    return "Sent to Client";
  }
  return row?.status === "Sent" ? "With Sales" : row?.status || "Draft";
}

const OVERDUE_DRAFT_DAYS = 3;

export function getProposalAttention(
  proposal: ProposalAttentionInput,
  now = Date.now()
): ProposalAttention {
  let linkedQueries = proposal.queries ?? [];
  if (linkedQueries.length === 0 && proposal.query) {
    linkedQueries = [proposal.query];
  }
  if (linkedQueries.length === 0) {
    return { label: "Blocked — no linked query", tone: "danger" };
  }
  if (linkedQueries.some((query) => !query.contractingOwnerId)) {
    return { label: "Contracting SPOC unassigned", tone: "warning" };
  }
  if (proposal.status === "Rejected") {
    return { label: "Blocked — proposal rejected", tone: "danger" };
  }
  if (proposal.sentToClientAt) {
    return { label: "Client delivery recorded", tone: undefined };
  }
  if (proposal.status === "Sent") {
    return { label: "With Sales — awaiting Sales Decision", tone: "info" };
  }
  if (proposal.status === "Accepted") {
    return { label: "Accepted — no open exception", tone: undefined };
  }
  if (!proposal.pricingEnteredAt) {
    return { label: "Costing not started", tone: "warning" };
  }
  const referenceTime = Date.parse(proposal.updatedAt || proposal.createdAt || "");
  const ageDays = Number.isFinite(referenceTime)
    ? Math.max(0, Math.floor((now - referenceTime) / 86_400_000))
    : 0;
  if (ageDays >= OVERDUE_DRAFT_DAYS) {
    return { label: `Draft overdue — ${ageDays} days`, tone: "warning" };
  }
  return { label: "Draft in progress", tone: undefined };
}
