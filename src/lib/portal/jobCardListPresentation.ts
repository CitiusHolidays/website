import type { PortalGridAttention } from "./portalDataGrid";

interface JobCardOwnerInput {
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  operationsOwnerId?: string | null;
  operationsOwnerName?: string | null;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  ticketingRequired?: boolean | null;
}

export function getJobCardAttention(row: JobCardOwnerInput): PortalGridAttention | undefined {
  const missing: string[] = [];
  if (!(row.contractingOwnerId || row.contractingOwnerName)) {
    missing.push("Contracting");
  }
  if (!(row.operationsOwnerId || row.operationsOwnerName)) {
    missing.push("Operations");
  }
  if (row.ticketingRequired !== false && !(row.ticketingOwnerId || row.ticketingOwnerName)) {
    missing.push("Ticketing");
  }
  return missing.length > 0
    ? { label: `Missing owners: ${missing.join(", ")}`, tone: "warning" }
    : undefined;
}
