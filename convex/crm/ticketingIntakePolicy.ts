export const TICKETING_ASSIGNMENT_SCOPES = ["Domestic", "International", "Both"] as const;

export function requiresTicketingSpocAssignment(ticketingScope?: string | null) {
  const scope = String(ticketingScope ?? "").trim();
  return scope !== "" && scope !== "Not required";
}

export function queryNeedsTicketingHeadIntakeAlert(query: {
  salesStatus: string;
  ticketingOwnerId?: string | null;
  ticketingScope?: string | null;
}) {
  if (["Order Confirmed", "Order Lost"].includes(query.salesStatus)) {
    return false;
  }
  if (query.ticketingOwnerId) {
    return false;
  }
  return requiresTicketingSpocAssignment(query.ticketingScope);
}
