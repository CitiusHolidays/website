import { getNotificationHref } from "./notificationPaths";
import { buildFilterUrl } from "./urlFilterState";

const TICKET_ATTENTION_STATUSES = ["Name Change Required", "Reissue Required", "Refund Pending"];

const VISA_PENDING_STATUSES = ["Not Started", "Checklist Shared", "Documents Pending", "Awaiting"];

/**
 * @param {{ view: string, listFilters?: Record<string, string>, dateRange?: { from: string | null, to: string | null }, jobCardFilter?: string, deepLink?: { open?: string, id?: string, queryId?: string } }} options
 */
export function buildDashboardListUrl({
  view,
  listFilters = {},
  dateRange,
  jobCardFilter,
  deepLink,
}) {
  const path = VIEW_PATHS[view] || `/portal/${view}`;
  return buildFilterUrl(
    path.startsWith("/") ? path : `/portal/${path}`,
    {
      search: "",
      dateRange: dateRange || { from: null, to: null },
      jobCardFilter: jobCardFilter || "",
      listFilters,
    },
    deepLink,
  );
}

const VIEW_PATHS = {
  queries: "/portal/queries",
  proposals: "/portal/proposals",
  "job-cards": "/portal/job-cards",
  tickets: "/portal/tickets",
  visa: "/portal/visa",
  finance: "/portal/finance",
  approvals: "/portal/approvals",
  pipeline: "/portal/pipeline",
  contracting: "/portal/contracting",
  hotels: "/portal/hotels",
  "accounts-job-cards": "/portal/accounts/job-cards",
  activity: "/portal/activity",
};

/**
 * @param {string} label
 * @param {{ from: string | null, to: string | null }} [dateRange]
 */
export function buildKpiHref(label, dateRange) {
  const range = dateRange || { from: null, to: null };
  switch (label) {
    case "Active queries":
    case "Active Queries":
      return buildDashboardListUrl({ view: "pipeline", dateRange: range });
    case "Proposals sent":
    case "Proposals Sent":
      return buildDashboardListUrl({
        view: "proposals",
        listFilters: { status: "Sent" },
        dateRange: range,
      });
    case "Confirmed jobs":
    case "Confirmed Jobs":
      return buildDashboardListUrl({
        view: "queries",
        listFilters: { salesStatus: "Order Confirmed" },
        dateRange: range,
      });
    case "Open job cards":
    case "Open Job Cards":
      return buildDashboardListUrl({
        view: "job-cards",
        listFilters: { status: "Open" },
        dateRange: range,
      });
    case "Departures (30d)":
      return buildDashboardListUrl({
        view: "job-cards",
        listFilters: { status: "Ready for Departure" },
        dateRange: range,
      });
    case "Tickets Issued":
      return buildDashboardListUrl({
        view: "tickets",
        listFilters: { ticketStatus: "Issued" },
        dateRange: range,
      });
    case "Tickets pending":
    case "Tickets Pending":
      return buildDashboardListUrl({
        view: "tickets",
        listFilters: { ticketStatus: "Pending Issue" },
        dateRange: range,
      });
    case "Visa pending":
    case "Visa Pending":
      return buildDashboardListUrl({
        view: "visa",
        listFilters: { status: VISA_PENDING_STATUSES[0] },
        dateRange: range,
      });
    case "Outstanding":
    case "Revenue pipeline":
    case "Revenue Pipeline":
      return buildDashboardListUrl({ view: "finance", dateRange: range });
    case "Pending approvals":
    case "Pending Approvals":
      return buildDashboardListUrl({
        view: "approvals",
        listFilters: { status: "Pending" },
        dateRange: range,
      });
    default:
      return "/portal";
  }
}

/**
 * @param {'active' | 'confirmed' | 'closed'} bucket
 * @param {string} queryType
 * @param {{ from: string | null, to: string | null }} [dateRange]
 */
export function buildQueryTypeTileHref(bucket, queryType, dateRange) {
  const listFilters = { queryType };
  if (bucket === "confirmed") {
    listFilters.salesStatus = "Order Confirmed";
  } else if (bucket === "closed") {
    listFilters.salesStatus = "Order Lost";
  }
  return buildDashboardListUrl({
    view: bucket === "active" ? "pipeline" : "queries",
    listFilters,
    dateRange: dateRange || { from: null, to: null },
  });
}

/** @param {{ id: string, type: string, entityType?: string, entityId?: string, href?: string, label?: string }} action */
export function buildUrgentActionHref(action) {
  if (action.href) return action.href;

  const entityId = action.entityId || action.id;
  const entityType = action.entityType || urgentEntityType(action.type);

  if (entityType && entityId) {
    if (action.type === "accounts") {
      return buildDashboardListUrl({
        view: "accounts-job-cards",
        deepLink: { open: "jobCard", queryId: entityId },
      });
    }
    return getNotificationHref({
      entityType,
      entityId,
      title: action.type === "accounts" ? "Order confirmed" : "",
    });
  }

  switch (action.type) {
    case "approvals":
      return buildDashboardListUrl({
        view: "approvals",
        listFilters: { status: "Pending" },
        deepLink: { open: "approval", id: entityId },
      });
    case "finance":
      return buildDashboardListUrl({ view: "finance" });
    case "accounts":
      return buildDashboardListUrl({
        view: "accounts-job-cards",
        deepLink: { open: "jobCard", queryId: entityId },
      });
    case "ticketing":
      return buildDashboardListUrl({
        view: "tickets",
        deepLink: { open: "ticket", id: entityId },
      });
    default:
      return "/portal/activity";
  }
}

function urgentEntityType(type) {
  switch (type) {
    case "approvals":
      return "approval";
    case "finance":
      return "invoice";
    case "accounts":
      return "query";
    case "ticketing":
      return "ticket";
    default:
      return "";
  }
}

/** @param {string} type */
export function buildUrgentViewAllHref(type, dateRange) {
  switch (type) {
    case "approvals":
      return buildDashboardListUrl({
        view: "approvals",
        listFilters: { status: "Pending" },
        dateRange,
      });
    case "finance":
      return buildDashboardListUrl({ view: "finance", dateRange });
    case "accounts":
      return buildDashboardListUrl({ view: "accounts-job-cards", dateRange });
    case "ticketing":
      return buildDashboardListUrl({
        view: "tickets",
        listFilters: { ticketStatus: TICKET_ATTENTION_STATUSES[0] },
        dateRange,
      });
    default:
      return "/portal";
  }
}

export function buildJobCardHref(jobCardId, dateRange) {
  return buildDashboardListUrl({
    view: "job-cards",
    dateRange,
    deepLink: { open: "jobCard", id: jobCardId },
  });
}

export function buildPipelineStageHref(stage, dateRange) {
  return buildDashboardListUrl({
    view: "pipeline",
    listFilters: stage ? { leadStage: stage } : {},
    dateRange: dateRange || { from: null, to: null },
  });
}

export { TICKET_ATTENTION_STATUSES };
