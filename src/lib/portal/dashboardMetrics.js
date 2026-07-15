import { PORTAL_PERMISSIONS as P } from "./constants";

const METRICS = {
  activeQueries: {
    icon: "queries",
    label: "Active queries",
    permission: P.VIEW_QUERIES,
    trendKey: "activeQueries",
    valueKey: "activeQueries",
  },
  confirmedJobs: {
    icon: "confirmed",
    label: "Confirmed jobs",
    permission: P.VIEW_QUERIES,
    trendKey: "confirmedJobs",
    valueKey: "confirmedJobs",
  },
  departures30d: {
    icon: "departures",
    label: "Departures (30d)",
    permission: P.VIEW_JOB_CARDS,
    trendKey: "departures30d",
    valueKey: "departures30d",
  },
  jobCardsOpen: {
    icon: "jobCards",
    label: "Open job cards",
    permission: P.VIEW_JOB_CARDS,
    trendKey: "jobCardsOpen",
    valueKey: "jobCardsOpen",
  },
  outstanding: {
    format: "money",
    icon: "money",
    label: "Outstanding",
    permission: P.VIEW_FINANCE,
    valueKey: "outstandingAmount",
  },
  pendingApprovals: {
    icon: "approvals",
    label: "Pending approvals",
    permission: P.VIEW_APPROVALS,
    valueKey: "pendingApprovals",
  },
  proposalsSent: {
    icon: "proposals",
    label: "Proposals sent",
    permission: P.VIEW_PROPOSALS,
    trendKey: "proposalsSent",
    valueKey: "proposalsSent",
  },
  revenuePipeline: {
    format: "money",
    icon: "money",
    label: "Revenue pipeline",
    permission: P.VIEW_FINANCE,
    valueKey: "revenuePipeline",
  },
  ticketsPending: {
    icon: "tickets",
    label: "Tickets pending",
    permission: P.VIEW_TICKETING,
    valueKey: "ticketsPending",
  },
  visaPending: {
    icon: "visa",
    label: "Visa pending",
    permission: P.VIEW_VISA,
    valueKey: "visaPending",
  },
};

const PERSONA_METRIC_IDS = {
  contracting: ["proposalsSent", "activeQueries", "confirmedJobs"],
  director: [
    "activeQueries",
    "proposalsSent",
    "confirmedJobs",
    "jobCardsOpen",
    "departures30d",
    "outstanding",
  ],
  finance: ["outstanding", "revenuePipeline", "pendingApprovals"],
  hr: ["pendingApprovals"],
  operations: ["jobCardsOpen", "departures30d", "visaPending", "ticketsPending"],
  sales: ["activeQueries", "proposalsSent", "confirmedJobs"],
  ticketing: ["ticketsPending", "departures30d"],
};

export function getDashboardMetricDefinitions(personaId) {
  const ids = PERSONA_METRIC_IDS[personaId] ?? PERSONA_METRIC_IDS.sales;
  if (ids.length > 6) {
    throw new Error(`Dashboard persona ${personaId} exceeds the six-KPI limit`);
  }
  return ids.map((id) => ({ id, ...METRICS[id] }));
}

export function getVisibleDashboardMetricDefinitions(personaId, has) {
  return getDashboardMetricDefinitions(personaId).filter((metric) => has(metric.permission));
}
