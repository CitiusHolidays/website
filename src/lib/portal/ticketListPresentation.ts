export const CANONICAL_TICKET_STATUSES = [
  "Pending Issue",
  "Issued",
  "Name Change Required",
  "Reissue Required",
  "Cancelled",
  "Refund Pending",
  "Refunded",
] as const;

export type CanonicalTicketStatus = (typeof CANONICAL_TICKET_STATUSES)[number];
export interface TicketAttention {
  label: string;
  tone?: "danger" | "info" | "warning";
}

const ATTENTION_BY_STATUS = {
  Cancelled: { label: "Cancelled — review refund requirements", tone: "info" },
  Issued: { label: "Issued — no open exception" },
  "Name Change Required": { label: "Blocked — name change required", tone: "danger" },
  "Pending Issue": { label: "Pending issue — ticket not issued", tone: "warning" },
  "Refund Pending": { label: "Refund pending", tone: "warning" },
  Refunded: { label: "Refunded — no open exception" },
  "Reissue Required": { label: "Blocked — reissue required", tone: "danger" },
} satisfies Record<CanonicalTicketStatus, TicketAttention>;

export function getTicketAttention(status: string | null | undefined): TicketAttention {
  const canonicalStatus = CANONICAL_TICKET_STATUSES.find((candidate) => candidate === status);
  if (canonicalStatus) {
    return ATTENTION_BY_STATUS[canonicalStatus];
  }
  return { label: "Unknown ticket status", tone: "warning" };
}
