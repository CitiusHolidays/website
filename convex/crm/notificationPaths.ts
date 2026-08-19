const ASSIGNMENT_QUERY_TITLES = new Set([
  "Assign Ticketing SPOC",
  "New query received",
  "Query submitted to Contracting",
  "Query ready for assignment",
]);

export interface NotificationPathInput {
  entityId?: string;
  entityType?: string;
  title: string;
}

function assignmentQueryPath(entityId: string) {
  const params = new URLSearchParams();
  params.set("open", "assignQueryTeams");
  params.set("id", entityId);
  return `/portal/queries?${params}`;
}

function entityPath(base: string, open: string, entityId: string) {
  const params = new URLSearchParams();
  params.set("open", open);
  params.set("id", entityId);
  return `${base}?${params}`;
}

function queryPath(entityId: string, title: string) {
  if (title === "Order confirmed — open Job Card" || title === "Order confirmed") {
    const params = new URLSearchParams();
    params.set("open", "jobCard");
    params.set("queryId", entityId);
    return `/portal/accounts/job-cards?${params}`;
  }
  if (title === "Order confirmed — assign owners") {
    return "/portal/job-cards";
  }
  if (title === "Proposal ready for review") {
    return entityPath("/portal/queries", "salesDecision", entityId);
  }
  if (ASSIGNMENT_QUERY_TITLES.has(title)) {
    return assignmentQueryPath(entityId);
  }
  return entityPath("/portal/queries", "query", entityId);
}

function jobCardPath(entityId: string, title: string) {
  let open = "jobCard";
  if (title === "Assign contracting SPOC" || title === "Assign contracting owner") {
    open = "assignContractingOwner";
  } else if (title === "Assign operations owner") {
    open = "assignOperationsOwner";
  } else if (title === "Assign ticketing owner") {
    open = "assignTicketingOwner";
  }
  return entityPath("/portal/job-cards", open, entityId);
}

/** Portal path (+ query string) for in-app and email notification deep links. */
export function getNotificationHref(args: NotificationPathInput) {
  if (!(args.entityType && args.entityId)) {
    return "/portal/activity";
  }

  switch (args.entityType) {
    case "query":
      return queryPath(args.entityId, args.title);
    case "proposal":
      return entityPath("/portal/proposals", "proposal", args.entityId);
    case "jobCard":
      return jobCardPath(args.entityId, args.title);
    case "ticket":
      return entityPath("/portal/tickets", "ticket", args.entityId);
    case "leave":
      return entityPath("/portal/employees-on-leave", "leave_create", args.entityId);
    case "approval":
      return entityPath("/portal/approvals", "approval", args.entityId);
    case "inboundQueryIntent":
      return entityPath("/portal/inbound-leads", "inboundIntent", args.entityId);
    default:
      return "/portal/activity";
  }
}
