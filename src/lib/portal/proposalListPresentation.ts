import { isRuntimeString } from "../runtimeValues";
export type ProposalAttentionTone = "danger" | "info" | "warning" | undefined;

interface ProposalAttentionInput {
  createdAt?: string;
  pricingEnteredAt?: string | null;
  proposalRevision?: number;
  queries?: Array<{ contractingOwnerId?: string | null; pairState?: string }>;
  query?: { contractingOwnerId?: string | null; pairState?: string } | null;
  queryPreview?: Array<{ contractingOwnerId?: string | null; pairState?: string }>;
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
  const row = isRuntimeString(proposal) ? { status: proposal } : proposal;
  return row?.proposalRevision ? `Authoring revision ${row.proposalRevision}` : "Authoring";
}

const OVERDUE_DRAFT_DAYS = 3;

export function getProposalAttention(
  proposal: ProposalAttentionInput,
  now = Date.now()
): ProposalAttention {
  let linkedQueries = proposal.queryPreview ?? proposal.queries ?? [];
  if (linkedQueries.length === 0 && proposal.query) {
    linkedQueries = [proposal.query];
  }
  if (linkedQueries.length === 0) {
    return { label: "Blocked: no linked query", tone: "danger" };
  }
  if (linkedQueries.some((query) => !query.contractingOwnerId)) {
    return { label: "Contracting SPOC unassigned", tone: "warning" };
  }
  if (linkedQueries.some((query) => query.pairState === "Revision requested")) {
    return { label: "Revision requested for query pair", tone: "warning" };
  }
  if (linkedQueries.some((query) => query.pairState === "Stale")) {
    return { label: "New revision needs pair handoff", tone: "warning" };
  }
  if (linkedQueries.some((query) => query.pairState === "Unknown")) {
    return { label: "Legacy pair clock unavailable", tone: "warning" };
  }
  if (linkedQueries.some((query) => query.pairState === "With Sales")) {
    return { label: "With Sales: awaiting Sales Decision", tone: "info" };
  }
  if (
    linkedQueries.every((query) => query.pairState === "Confirmed" || query.pairState === "Lost")
  ) {
    return { label: "Pair decisions recorded", tone: undefined };
  }
  if (!proposal.pricingEnteredAt) {
    return { label: "Costing not started", tone: "warning" };
  }
  const referenceTime = Date.parse(proposal.updatedAt || proposal.createdAt || "");
  const ageDays = Number.isFinite(referenceTime)
    ? Math.max(0, Math.floor((now - referenceTime) / 86_400_000))
    : 0;
  if (ageDays >= OVERDUE_DRAFT_DAYS) {
    return { label: `Draft overdue: ${ageDays} days`, tone: "warning" };
  }
  return { label: "Ready for pair handoff", tone: undefined };
}
