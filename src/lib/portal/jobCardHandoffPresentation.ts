export function queryJobCardHandoffLabel({
  salesStatus,
  jobCardCode,
  ticketingScope,
}: {
  salesStatus?: string;
  jobCardCode?: string | null;
  ticketingScope?: string | null;
}) {
  if (jobCardCode?.trim()) {
    return jobCardCode.trim();
  }
  if (salesStatus !== "Order Confirmed") {
    return "";
  }
  const scope = String(ticketingScope ?? "").trim();
  if (scope === "Not required") {
    return "Awaiting Job Card";
  }
  return "Awaiting Job Card";
}

export function shouldShowJobCardHandoff({
  salesStatus,
  ticketingScope,
}: {
  salesStatus?: string;
  ticketingScope?: string | null;
}) {
  if (salesStatus !== "Order Confirmed") {
    return false;
  }
  const scope = String(ticketingScope ?? "").trim();
  if (scope === "Not required") {
    return true;
  }
  return true;
}

export function ticketingRoleShowsJobCardHandoff(ticketingScope?: string | null) {
  const scope = String(ticketingScope ?? "").trim();
  return scope !== "" && scope !== "Not required";
}
