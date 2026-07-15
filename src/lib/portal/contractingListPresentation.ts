import type { PortalGridAttention } from "./portalDataGrid";

interface ProposalSnapshot {
  pricingEnteredAt?: string | null;
  sentToClientAt?: string | null;
  status?: string;
  updatedAt?: string | number;
}

interface ContractingAttentionInput {
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  contractingStatus?: string;
  createdAt?: string | number;
  proposal?: ProposalSnapshot | null;
  submittedToContractingAt?: string | number | null;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  ticketingScope?: string | null;
}

const OVERDUE_DAYS = 3;

function timestamp(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function ageInDays(value: string | number | null | undefined, now: number): number {
  const receivedAt = timestamp(value);
  return receivedAt === null ? 0 : Math.max(0, Math.floor((now - receivedAt) / 86_400_000));
}

export function getContractingAttention(
  row: ContractingAttentionInput,
  now = Date.now()
): PortalGridAttention | undefined {
  if (["Order Lost", "Rejected"].includes(row.contractingStatus || "")) {
    return { label: "Blocked — order lost", tone: "danger" };
  }
  if (!(row.contractingOwnerId || row.contractingOwnerName)) {
    return { label: "Contracting SPOC unassigned", tone: "warning" };
  }
  if (!row.ticketingScope?.trim()) {
    return { label: "Ticketing scope pending", tone: "warning" };
  }
  if (row.ticketingScope !== "Not required" && !(row.ticketingOwnerId || row.ticketingOwnerName)) {
    return { label: "Ticketing SPOC unassigned", tone: "warning" };
  }
  if (
    ["Change in destination", "Date/Destination Change Required"].includes(
      row.contractingStatus || ""
    )
  ) {
    return { label: "Blocked — Sales revision required", tone: "danger" };
  }
  if (row.proposal?.status === "Rejected") {
    return { label: "Blocked — proposal rejected", tone: "danger" };
  }
  if (row.proposal?.sentToClientAt) {
    return { label: "Client delivery recorded" };
  }
  if (row.proposal?.status === "Sent" || row.contractingStatus === "Proposal sent") {
    return { label: "With Sales — awaiting Sales Decision", tone: "info" };
  }
  const ageDays = ageInDays(row.submittedToContractingAt || row.createdAt, now);
  if (!row.proposal?.pricingEnteredAt) {
    if (ageDays >= OVERDUE_DAYS) {
      return { label: `Proposal overdue — ${ageDays} days since received`, tone: "warning" };
    }
    return {
      label: row.proposal ? "Waiting — costing not started" : "Waiting — proposal not started",
      tone: "warning",
    };
  }
}
