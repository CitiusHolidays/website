import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { canAccessPipeline } from "@/lib/portal/permissions";
import type { PortalPermission } from "@/lib/portal/workspaceContract";

export type PortalRouteFamily =
  | "administration"
  | "core"
  | "inbound"
  | "operations"
  | "pilot"
  | "ticketing";

export type PortalDataDependency =
  | "accountsJobCardCreators"
  | "activity"
  | "approvals"
  | "dashboard"
  | "dropdowns"
  | "expenses"
  | "financeOverview"
  | "flightItinerary"
  | "hotels"
  | "invoices"
  | "jobCardDeletionOperations"
  | "jobCards"
  | "leaveHeadApproverCandidates"
  | "leaves"
  | "pnrs"
  | "proposals"
  | "queries"
  | "reports"
  | "seats"
  | "staff"
  | "team"
  | "tickets"
  | "ticketDashboard"
  | "tourManagers"
  | "travellers"
  | "travellersWithoutVisa"
  | "visas";

export type PortalPaginationKey =
  | "activity"
  | "approvals"
  | "expenses"
  | "flightOperations"
  | "hotelOperations"
  | "invoices"
  | "jobCards"
  | "leaves"
  | "proposals"
  | "queries"
  | "seats"
  | "staff"
  | "team"
  | "tickets"
  | "tourManagers"
  | "travellers"
  | "visas";

export interface PortalPaginationControl {
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  loadedCount?: number;
  loadMore?: () => void;
}

type PortalLazyViewModule = typeof import("@/components/portal/workspace/portalLazyViews");
export type PortalLazyViewKey = Exclude<
  Extract<keyof PortalLazyViewModule, string>,
  "preloadQueriesView"
>;

export interface PortalRouteDefinition {
  component: PortalLazyViewKey;
  dependencies: readonly PortalDataDependency[];
  family: PortalRouteFamily;
  paginationKey?: PortalPaginationKey;
  permission: PortalPermission;
  subtitle: string;
  title: string;
}

export const PORTAL_ROUTES = {
  "accounts-job-cards": {
    component: "AccountsJobCardView",
    dependencies: ["queries", "jobCards", "accountsJobCardCreators"],
    family: "core",
    paginationKey: "queries",
    permission: P.MANAGE_JOB_CARDS,
    subtitle: "Create Job Card numbers only after order confirmation.",
    title: "Accounts / Job Card Creation",
  },
  activity: {
    component: "ActivityView",
    dependencies: ["activity"],
    family: "administration",
    paginationKey: "activity",
    permission: P.VIEW_ACTIVITY,
    subtitle: "Audit trail for CRM status changes and workflow triggers.",
    title: "Notifications / Activity Log",
  },
  approvals: {
    component: "ApprovalsView",
    dependencies: ["approvals", "expenses"],
    family: "administration",
    paginationKey: "approvals",
    permission: P.VIEW_APPROVALS,
    subtitle: "Unified approval queue for expenses and finance handoffs.",
    title: "Approvals",
  },
  contracting: {
    component: "ContractingView",
    dependencies: ["queries", "proposals", "team"],
    family: "pilot",
    paginationKey: "queries",
    permission: P.VIEW_CONTRACTING,
    subtitle: "Assign contracting SPOCs and move proposals through contracting statuses.",
    title: "Contracting Dashboard",
  },
  dashboard: {
    component: "DashboardView",
    dependencies: ["dashboard"],
    family: "core",
    permission: P.VIEW_DASHBOARD,
    subtitle: "",
    title: "Dashboard",
  },
  "employees-on-leave": {
    component: "LeaveView",
    dependencies: ["leaves", "team"],
    family: "administration",
    paginationKey: "leaves",
    permission: P.VIEW_LEAVE,
    subtitle: "Leave requests, approvals, and team availability.",
    title: "Employees on Leave",
  },
  expenses: {
    component: "ExpensesView",
    dependencies: ["expenses", "jobCards"],
    family: "administration",
    paginationKey: "expenses",
    permission: P.VIEW_EXPENSES,
    subtitle: "Tour-wise expenses, approval, and reimbursement tracking.",
    title: "Expense Management",
  },
  finance: {
    component: "FinanceView",
    dependencies: ["invoices", "jobCards", "financeOverview"],
    family: "administration",
    paginationKey: "invoices",
    permission: P.VIEW_FINANCE,
    subtitle: "Fund projections, invoices, received amounts, balances, and closure status.",
    title: "Finance",
  },
  flights: {
    component: "PnrView",
    dependencies: ["pnrs", "flightItinerary", "jobCards"],
    family: "ticketing",
    paginationKey: "flightOperations",
    permission: P.VIEW_TICKETING,
    subtitle: "Manage PNRs, routes, fare types, group seats, and airline records.",
    title: "Flights & PNR",
  },
  hotels: {
    component: "HotelRoomingView",
    dependencies: ["hotels", "travellers", "jobCards"],
    family: "operations",
    paginationKey: "hotelOperations",
    permission: P.VIEW_OPERATIONS,
    subtitle: "Hotel arrangements, rooming, special instructions, and ground planning.",
    title: "Hotel / Rooming List",
  },
  "inbound-leads": {
    component: "InboundLeadsView",
    dependencies: [],
    family: "inbound",
    permission: P.VIEW_QUERIES,
    subtitle: "Review validated public enquiries before they become Sales Queries.",
    title: "Inbound Leads",
  },
  "job-cards": {
    component: "JobCardsView",
    dependencies: ["jobCards", "jobCardDeletionOperations"],
    family: "operations",
    paginationKey: "jobCards",
    permission: P.VIEW_JOB_CARDS,
    subtitle: "Operational file control, progress, and pre-departure checklist status.",
    title: "Job Cards",
  },
  passport: {
    component: "PassportDocumentsView",
    dependencies: ["travellers", "jobCards"],
    family: "operations",
    paginationKey: "travellers",
    permission: P.VIEW_VISA,
    subtitle: "Upload, encrypt, and manage traveller passport scans.",
    title: "Passport Documents",
  },
  pipeline: {
    component: "PipelineView",
    dependencies: ["queries"],
    family: "core",
    paginationKey: "queries",
    permission: P.VIEW_QUERIES,
    subtitle: "Track query movement from contracting to confirmed or lost.",
    title: "Pipeline View",
  },
  proposals: {
    component: "ProposalsView",
    dependencies: ["proposals", "queries"],
    family: "pilot",
    paginationKey: "proposals",
    permission: P.VIEW_PROPOSALS,
    subtitle: "Create, cost, and send proposals linked to active queries.",
    title: "Proposals",
  },
  queries: {
    component: "QueriesView",
    dependencies: ["queries"],
    family: "pilot",
    paginationKey: "queries",
    permission: P.VIEW_QUERIES,
    subtitle: "Manage incoming MICE, group travel, FIT, B2B, cement, and spiritual enquiries.",
    title: "All Sales Queries",
  },
  reports: {
    component: "ReportsView",
    dependencies: ["reports"],
    family: "administration",
    permission: P.VIEW_REPORTS,
    subtitle: "Revenue, headcount, and conversion snapshots for leadership review.",
    title: "Reports",
  },
  "seat-allocation": {
    component: "SeatView",
    dependencies: ["seats", "jobCards"],
    family: "ticketing",
    paginationKey: "seats",
    permission: P.VIEW_TICKETING,
    subtitle: "Manual stored seat assignments, holds, and blocks.",
    title: "Seat Allocation",
  },
  settings: {
    component: "SettingsView",
    dependencies: ["staff", "dropdowns", "leaveHeadApproverCandidates"],
    family: "administration",
    paginationKey: "staff",
    permission: P.MANAGE_STAFF,
    subtitle: "Staff allowlist and workflow dropdown reference values.",
    title: "Settings / Dropdown Management",
  },
  team: {
    component: "TeamView",
    dependencies: ["team"],
    family: "administration",
    paginationKey: "team",
    permission: P.VIEW_TEAM,
    subtitle: "Read-only staff directory by department, role, and location.",
    title: "Team Directory",
  },
  ticketing: {
    component: "TicketDashboardView",
    dependencies: ["ticketDashboard"],
    family: "ticketing",
    permission: P.VIEW_TICKETING,
    subtitle: "Ticket status summary across active Job Cards.",
    title: "Ticket Dashboard",
  },
  tickets: {
    component: "TicketsView",
    dependencies: ["tickets", "jobCards"],
    family: "ticketing",
    paginationKey: "tickets",
    permission: P.VIEW_TICKETING,
    subtitle: "Issue, reissue, cancellation, name correction, and refund tracking.",
    title: "All Tickets",
  },
  "tour-managers": {
    component: "TourManagersView",
    dependencies: ["tourManagers", "jobCards"],
    family: "operations",
    paginationKey: "tourManagers",
    permission: P.VIEW_TOUR_MANAGERS,
    subtitle: "TM assignment, calling status, availability, and active tour visibility.",
    title: "Tour Managers",
  },
  travellers: {
    component: "TravellersView",
    dependencies: ["travellers", "jobCards"],
    family: "operations",
    paginationKey: "travellers",
    permission: P.VIEW_TRAVELLERS,
    subtitle:
      "Guest details, hubs, food preferences, rooming, visa, ticket, and TM calling status.",
    title: "Traveller Master Sheet",
  },
  visa: {
    component: "VisaTrackingView",
    dependencies: ["visas", "travellers", "jobCards", "travellersWithoutVisa"],
    family: "operations",
    paginationKey: "visas",
    permission: P.VIEW_VISA,
    subtitle:
      "Checklist, appointments, submission, approval, rejection, and re-application tracking.",
    title: "Visa Tracking",
  },
} as const satisfies Record<string, PortalRouteDefinition>;

export type PortalViewId = Extract<keyof typeof PORTAL_ROUTES, string>;

export function isPortalViewId(view: string): view is PortalViewId {
  return view in PORTAL_ROUTES;
}

export function resolvePortalViewId(view: string): PortalViewId {
  return isPortalViewId(view) ? view : "dashboard";
}

export function getPortalRouteDefinition(view: string): PortalRouteDefinition {
  return PORTAL_ROUTES[resolvePortalViewId(view)];
}

export function getPortalRouteDataDependencies(view: string) {
  return getPortalRouteDefinition(view).dependencies;
}

export function canAccessPortalRoute({
  access,
  has,
  view,
}: {
  access: Parameters<typeof canAccessPipeline>[0] | null | undefined;
  has: (permission: string) => boolean;
  view: string;
}): boolean {
  const route = getPortalRouteDefinition(view);
  return Boolean(
    access?.allowed &&
      (resolvePortalViewId(view) === "pipeline" ? canAccessPipeline(access) : has(route.permission))
  );
}

export function resolvePortalRoutePagination(
  view: string,
  pagination: Partial<Record<PortalPaginationKey, PortalPaginationControl>>
): PortalPaginationControl | undefined {
  const key = getPortalRouteDefinition(view).paginationKey;
  return key ? pagination[key] : undefined;
}
