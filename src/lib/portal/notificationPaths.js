const ASSIGNMENT_QUERY_TITLES = new Set([
  "New query received",
  "Query submitted to Contracting",
  "Query ready for assignment",
]);

function assignmentQueryPath(entityId) {
  const params = new URLSearchParams();
  params.set("open", "assignQueryTeams");
  params.set("id", entityId);
  return `/portal/queries?${params}`;
}

/**
 * Build portal deep-link path for notifications (shared with Convex email links).
 */
function buildNotificationPath({ entityType, entityId, title }) {
  if (!(entityType && entityId)) {
    return "/portal/activity";
  }

  const params = new URLSearchParams();

  switch (entityType) {
    case "query":
      if (title === "Order confirmed — open Job Card") {
        params.set("open", "jobCard");
        params.set("queryId", entityId);
        return `/portal/accounts/job-cards?${params}`;
      }
      if (title === "Order confirmed") {
        params.set("open", "jobCard");
        params.set("queryId", entityId);
        return `/portal/accounts/job-cards?${params}`;
      }
      if (title === "Order confirmed — assign owners") {
        return "/portal/job-cards";
      }
      if (title === "Proposal ready for review") {
        params.set("open", "salesDecision");
        params.set("id", entityId);
        return `/portal/queries?${params}`;
      }
      if (ASSIGNMENT_QUERY_TITLES.has(title)) {
        return assignmentQueryPath(entityId);
      }
      params.set("open", "query");
      params.set("id", entityId);
      return `/portal/queries?${params}`;
    case "proposal":
      if (title === "Proposal ready for review") {
        params.set("open", "proposal");
        params.set("id", entityId);
        return `/portal/proposals?${params}`;
      }
      params.set("open", "proposal");
      params.set("id", entityId);
      return `/portal/proposals?${params}`;
    case "jobCard":
      if (title === "Assign contracting SPOC" || title === "Assign contracting owner") {
        params.set("open", "assignContractingOwner");
      } else if (title === "Assign operations owner") {
        params.set("open", "assignOperationsOwner");
      } else if (title === "Assign ticketing owner") {
        params.set("open", "assignTicketingOwner");
      } else {
        params.set("open", "jobCard");
      }
      params.set("id", entityId);
      return `/portal/job-cards?${params}`;
    case "ticket":
      params.set("open", "ticket");
      params.set("id", entityId);
      return `/portal/tickets?${params}`;
    case "leave":
      params.set("open", "leave_create");
      params.set("id", entityId);
      return `/portal/employees-on-leave?${params}`;
    case "approval":
      params.set("open", "approval");
      params.set("id", entityId);
      return `/portal/approvals?${params}`;
    case "inboundQueryIntent":
      params.set("open", "query");
      params.set("inboundIntentId", entityId);
      return `/portal/queries?${params}`;
    default:
      return "/portal/activity";
  }
}

export function getNotificationHref(args) {
  return buildNotificationPath(args);
}
