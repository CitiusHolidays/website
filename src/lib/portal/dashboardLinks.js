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
      dateRange: dateRange || { from: null, to: null },
      jobCardFilter: jobCardFilter || "",
      listFilters,
      search: "",
    },
    deepLink
  );
}

const VIEW_PATHS = {
  "accounts-job-cards": "/portal/accounts/job-cards",
  activity: "/portal/activity",
  approvals: "/portal/approvals",
  contracting: "/portal/contracting",
  finance: "/portal/finance",
  hotels: "/portal/hotels",
  "job-cards": "/portal/job-cards",
  pipeline: "/portal/pipeline",
  proposals: "/portal/proposals",
  queries: "/portal/queries",
  tickets: "/portal/tickets",
  visa: "/portal/visa",
};

/**
 * @param {string} label
 * @param {{ from: string | null, to: string | null }} [dateRange]
 */
export function buildKpiHref(label, dateRange) {
  return buildDashboardKpiHref(label, dateRange);
}

/**
 * Stable KPI-id based drill-downs. Display labels remain accepted temporarily
 * so existing callers and saved snapshots do not break during migration.
 * @param {string} metricId
 * @param {{ from: string | null, to: string | null }} [dateRange]
 */
export function buildDashboardKpiHref(metricId, dateRange) {
  const range = dateRange || { from: null, to: null };
  switch (metricId) {
    case "activeQueries":
    case "Active queries":
    case "Active Queries":
      return buildDashboardListUrl({ dateRange: range, view: "pipeline" });
    case "proposalsSent":
    case "Proposals sent":
    case "Proposals Sent":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { status: "Sent" },
        view: "proposals",
      });
    case "confirmedJobs":
    case "Confirmed jobs":
    case "Confirmed Jobs":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { salesStatus: "Order Confirmed" },
        view: "queries",
      });
    case "jobCardsOpen":
    case "Open job cards":
    case "Open Job Cards":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { status: "Open" },
        view: "job-cards",
      });
    case "departures30d":
    case "Departures (30d)":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { status: "Ready for Departure" },
        view: "job-cards",
      });
    case "Tickets Issued":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { ticketStatus: "Issued" },
        view: "tickets",
      });
    case "ticketsPending":
    case "Tickets pending":
    case "Tickets Pending":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { ticketStatus: "Pending Issue" },
        view: "tickets",
      });
    case "visaPending":
    case "Visa pending":
    case "Visa Pending":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { status: VISA_PENDING_STATUSES[0] },
        view: "visa",
      });
    case "outstanding":
    case "Outstanding":
    case "revenuePipeline":
    case "Revenue pipeline":
    case "Revenue Pipeline":
      return buildDashboardListUrl({ dateRange: range, view: "finance" });
    case "pendingApprovals":
    case "Pending approvals":
    case "Pending Approvals":
      return buildDashboardListUrl({
        dateRange: range,
        listFilters: { status: "Pending" },
        view: "approvals",
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
    dateRange: dateRange || { from: null, to: null },
    listFilters,
    view: bucket === "active" ? "pipeline" : "queries",
  });
}

/** @param {{ id: string, type: string, entityType?: string, entityId?: string, href?: string, label?: string }} action */
export function buildUrgentActionHref(action) {
  if (action.href) {
    return action.href;
  }

  const entityId = action.entityId || action.id;
  const entityType = action.entityType || urgentEntityType(action.type);

  if (entityType && entityId) {
    if (action.type === "accounts") {
      return buildDashboardListUrl({
        deepLink: { open: "jobCard", queryId: entityId },
        view: "accounts-job-cards",
      });
    }
    return getNotificationHref({
      entityId,
      entityType,
      title: action.type === "accounts" ? "Order confirmed" : "",
    });
  }

  switch (action.type) {
    case "approvals":
      return buildDashboardListUrl({
        deepLink: { id: entityId, open: "approval" },
        listFilters: { status: "Pending" },
        view: "approvals",
      });
    case "finance":
      return buildDashboardListUrl({ view: "finance" });
    case "accounts":
      return buildDashboardListUrl({
        deepLink: { open: "jobCard", queryId: entityId },
        view: "accounts-job-cards",
      });
    case "ticketing":
      return buildDashboardListUrl({
        deepLink: { id: entityId, open: "ticket" },
        view: "tickets",
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
        dateRange,
        listFilters: { status: "Pending" },
        view: "approvals",
      });
    case "finance":
      return buildDashboardListUrl({ dateRange, view: "finance" });
    case "accounts":
      return buildDashboardListUrl({ dateRange, view: "accounts-job-cards" });
    case "ticketing":
      return buildDashboardListUrl({
        dateRange,
        listFilters: { ticketStatus: TICKET_ATTENTION_STATUSES[0] },
        view: "tickets",
      });
    default:
      return "/portal";
  }
}

export function buildJobCardHref(jobCardId, dateRange) {
  if (jobCardId) {
    return `/portal/job-cards/${jobCardId}`;
  }
  return buildDashboardListUrl({
    dateRange,
    deepLink: { id: jobCardId, open: "jobCard" },
    view: "job-cards",
  });
}

export function buildPipelineStageHref(stage, dateRange) {
  return buildDashboardListUrl({
    dateRange: dateRange || { from: null, to: null },
    listFilters: stage ? { leadStage: stage } : {},
    view: "pipeline",
  });
}

export { TICKET_ATTENTION_STATUSES };
