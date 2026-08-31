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
  "preloadPerformanceView"
>;

interface PortalRouteMetadata {
  dependencies: readonly PortalDataDependency[];
  family: PortalRouteFamily;
  paginationKey?: PortalPaginationKey;
  permission: PortalPermission;
  subtitle: string;
  title: string;
}

interface PortalWorkspaceRouteDefinition extends PortalRouteMetadata {
  component: PortalLazyViewKey;
}

interface PortalModuleRouteDefinition extends PortalRouteMetadata {
  module: "RecoveryCenterModule";
}

export type PortalRouteDefinition = PortalModuleRouteDefinition | PortalWorkspaceRouteDefinition;

export const PORTAL_ROUTE_HEADING_ID = "portal-page-heading";

export interface PortalRouteAccessibilityMetadata {
  documentTitle: string;
  headingId: typeof PORTAL_ROUTE_HEADING_ID;
  headingText: string;
}

export const PORTAL_ROUTES = {
  "accounts-job-cards": {
    component: "AccountsJobCardView",
    dependencies: ["queries", "jobCards", "accountsJobCardCreators"],
    family: "core",
    paginationKey: "queries",
    permission: P.MANAGE_JOB_CARDS,
    subtitle: "Open a Job Card after Sales confirms the order.",
    title: "Accounts / Job Card Creation",
  },
  activity: {
    component: "ActivityView",
    dependencies: ["activity"],
    family: "administration",
    paginationKey: "activity",
    permission: P.VIEW_EMAIL_DELIVERY_STATUS,
    subtitle: "See workflow changes, notifications, and email delivery.",
    title: "Notifications / Activity Log",
  },
  approvals: {
    component: "ApprovalsView",
    dependencies: ["approvals", "expenses"],
    family: "administration",
    paginationKey: "approvals",
    permission: P.VIEW_APPROVALS,
    subtitle: "Review expense and finance approvals.",
    title: "Approvals",
  },
  contracting: {
    component: "ContractingView",
    dependencies: ["queries", "team"],
    family: "pilot",
    paginationKey: "queries",
    permission: P.VIEW_CONTRACTING,
    subtitle: "Assign the Contracting SPOC and update Contracting Progress.",
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
    subtitle: "Review leave requests, approvals, and team availability.",
    title: "Employees on Leave",
  },
  expenses: {
    component: "ExpensesView",
    dependencies: ["expenses", "jobCards"],
    family: "administration",
    paginationKey: "expenses",
    permission: P.VIEW_EXPENSES,
    subtitle: "Record tour and office expenses, then follow approval and reimbursement.",
    title: "Expense Management",
  },
  finance: {
    component: "FinanceView",
    dependencies: ["invoices", "jobCards", "financeOverview"],
    family: "administration",
    paginationKey: "invoices",
    permission: P.VIEW_FINANCE,
    subtitle: "Review funds, invoices, payments, balances, and closure.",
    title: "Finance",
  },
  flights: {
    component: "PnrView",
    dependencies: ["pnrs", "flightItinerary", "jobCards"],
    family: "ticketing",
    paginationKey: "flightOperations",
    permission: P.VIEW_TICKETING,
    subtitle: "Work with PNRs, routes, fares, seats, and airline records.",
    title: "Flights & PNR",
  },
  hotels: {
    component: "HotelRoomingView",
    dependencies: ["hotels", "travellers", "jobCards"],
    family: "operations",
    paginationKey: "hotelOperations",
    permission: P.VIEW_OPERATIONS,
    subtitle: "Record hotels, rooms, guest instructions, and ground plans.",
    title: "Hotel / Rooming List",
  },
  "inbound-leads": {
    component: "InboundLeadsView",
    dependencies: [],
    family: "inbound",
    permission: P.VIEW_QUERIES,
    subtitle: "Convert or dismiss public enquiries before they enter the Sales pipeline.",
    title: "Inbound Leads",
  },
  "job-cards": {
    component: "JobCardsView",
    dependencies: ["jobCards", "jobCardDeletionOperations"],
    family: "operations",
    paginationKey: "jobCards",
    permission: P.VIEW_JOB_CARDS,
    subtitle: "Open files, progress, and the pre-departure checklist for each Job Card.",
    title: "Job Cards",
  },
  passport: {
    component: "PassportDocumentsView",
    dependencies: ["travellers", "jobCards"],
    family: "operations",
    paginationKey: "travellers",
    permission: P.VIEW_VISA,
    subtitle: "Upload and review encrypted Traveller passport scans.",
    title: "Passport Documents",
  },
  pipeline: {
    component: "PipelineView",
    dependencies: ["queries"],
    family: "core",
    paginationKey: "queries",
    permission: P.VIEW_QUERIES,
    subtitle: "See each Query from enquiry through confirmed or lost.",
    title: "Pipeline View",
  },
  proposals: {
    component: "ProposalsView",
    dependencies: ["proposals", "queries"],
    family: "pilot",
    paginationKey: "proposals",
    permission: P.VIEW_PROPOSALS,
    subtitle: "Cost Proposals and send complete versions to Sales.",
    title: "Proposals",
  },
  queries: {
    component: "QueriesView",
    dependencies: ["queries"],
    family: "pilot",
    paginationKey: "queries",
    permission: P.VIEW_QUERIES,
    subtitle: "Open and assign Sales Queries across enquiry types.",
    title: "All Sales Queries",
  },
  recovery: {
    dependencies: [],
    family: "administration",
    module: "RecoveryCenterModule",
    permission: P.VIEW_DASHBOARD,
    subtitle: "Review authorized background work that needs a human-owned next step.",
    title: "Recovery Center",
  },
  reports: {
    component: "ReportsView",
    dependencies: ["reports"],
    family: "administration",
    permission: P.VIEW_REPORTS,
    subtitle: "Review revenue, headcount, and conversion totals.",
    title: "Reports",
  },
  "seat-allocation": {
    component: "SeatView",
    dependencies: ["seats", "jobCards"],
    family: "ticketing",
    paginationKey: "seats",
    permission: P.VIEW_TICKETING,
    subtitle: "Record seat assignments, holds, and blocks.",
    title: "Seat Allocation",
  },
  settings: {
    component: "SettingsView",
    dependencies: ["staff", "dropdowns", "leaveHeadApproverCandidates"],
    family: "administration",
    paginationKey: "staff",
    permission: P.MANAGE_STAFF,
    subtitle: "Manage staff access and workflow dropdown values.",
    title: "Settings / Dropdown Management",
  },
  team: {
    component: "TeamView",
    dependencies: ["team"],
    family: "administration",
    paginationKey: "team",
    permission: P.VIEW_TEAM,
    subtitle: "Find staff by department, role, or location.",
    title: "Team Directory",
  },
  ticketing: {
    component: "TicketDashboardView",
    dependencies: ["ticketDashboard"],
    family: "ticketing",
    permission: P.VIEW_TICKETING,
    subtitle: "Review ticket status across active Job Cards.",
    title: "Ticket Dashboard",
  },
  tickets: {
    component: "TicketsView",
    dependencies: ["tickets", "jobCards"],
    family: "ticketing",
    paginationKey: "tickets",
    permission: P.VIEW_TICKETING,
    subtitle: "Track issues, reissues, cancellations, corrections, and refunds.",
    title: "All Tickets",
  },
  "tour-managers": {
    component: "TourManagersView",
    dependencies: ["tourManagers", "jobCards"],
    family: "operations",
    paginationKey: "tourManagers",
    permission: P.VIEW_TOUR_MANAGERS,
    subtitle: "Assign Tour Managers and review availability, calls, and active tours.",
    title: "Tour Managers",
  },
  travellers: {
    component: "TravellersView",
    dependencies: ["travellers", "jobCards"],
    family: "operations",
    paginationKey: "travellers",
    permission: P.VIEW_TRAVELLERS,
    subtitle: "Review Traveller contact, rooming, visa, ticket, meal, and calling details.",
    title: "Traveller Master Sheet",
  },
  visa: {
    component: "VisaTrackingView",
    dependencies: ["visas", "travellers", "jobCards", "travellersWithoutVisa"],
    family: "operations",
    paginationKey: "visas",
    permission: P.VIEW_VISA,
    subtitle: "Track checklists, appointments, submissions, decisions, and re-applications.",
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

export function getPortalRouteImplementationKey(view: string): string {
  const route = getPortalRouteDefinition(view);
  return "component" in route ? route.component : route.module;
}

export function getPortalRouteAccessibilityMetadata(
  view: string
): PortalRouteAccessibilityMetadata {
  const route = getPortalRouteDefinition(view);
  return {
    documentTitle: `${route.title} | Citius Connect`,
    headingId: PORTAL_ROUTE_HEADING_ID,
    headingText: route.title,
  };
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
