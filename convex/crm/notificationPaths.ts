const ASSIGNMENT_QUERY_TITLES = new Set([
  "New query received",
  "Query submitted to Contracting",
  "Query ready for assignment",
]);

export type NotificationPathInput = {
  entityType?: string;
  entityId?: string;
  title: string;
};

function assignmentQueryPath(entityId: string) {
  const params = new URLSearchParams();
  params.set("open", "assignQueryTeams");
  params.set("id", entityId);
  return `/portal/queries?${params}`;
}

/** Portal path (+ query string) for in-app and email notification deep links. */
export function getNotificationHref(args: NotificationPathInput) {
  if (!args.entityType || !args.entityId) {
    return "/portal/activity";
  }

  const params = new URLSearchParams();

  switch (args.entityType) {
    case "query":
      if (args.title === "Order confirmed — open Job Card") {
        params.set("open", "jobCard");
        params.set("queryId", args.entityId);
        return `/portal/accounts/job-cards?${params}`;
      }
      if (args.title === "Order confirmed") {
        params.set("open", "jobCard");
        params.set("queryId", args.entityId);
        return `/portal/accounts/job-cards?${params}`;
      }
      if (args.title === "Order confirmed — assign owners") {
        return "/portal/job-cards";
      }
      if (args.title === "Proposal ready for review") {
        params.set("open", "salesDecision");
        params.set("id", args.entityId);
        return `/portal/queries?${params}`;
      }
      if (ASSIGNMENT_QUERY_TITLES.has(args.title)) {
        return assignmentQueryPath(args.entityId);
      }
      params.set("open", "query");
      params.set("id", args.entityId);
      return `/portal/queries?${params}`;
    case "proposal":
      if (args.title === "Proposal ready for review") {
        params.set("open", "proposal");
        params.set("id", args.entityId);
        return `/portal/proposals?${params}`;
      }
      params.set("open", "proposal");
      params.set("id", args.entityId);
      return `/portal/proposals?${params}`;
    case "jobCard":
      if (args.title === "Assign contracting SPOC" || args.title === "Assign contracting owner") {
        params.set("open", "assignContractingOwner");
      } else if (args.title === "Assign operations owner") {
        params.set("open", "assignOperationsOwner");
      } else if (args.title === "Assign ticketing owner") {
        params.set("open", "assignTicketingOwner");
      } else {
        params.set("open", "jobCard");
      }
      params.set("id", args.entityId);
      return `/portal/job-cards?${params}`;
    case "ticket":
      params.set("open", "ticket");
      params.set("id", args.entityId);
      return `/portal/tickets?${params}`;
    case "leave":
      params.set("open", "leave_create");
      params.set("id", args.entityId);
      return `/portal/employees-on-leave?${params}`;
    case "approval":
      params.set("open", "approval");
      params.set("id", args.entityId);
      return `/portal/approvals?${params}`;
    default:
      return "/portal/activity";
  }
}
