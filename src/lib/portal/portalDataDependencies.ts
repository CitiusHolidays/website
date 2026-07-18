export type PortalDataDependency =
  | "activity"
  | "approvals"
  | "expenses"
  | "flightItinerary"
  | "hotels"
  | "invoices"
  | "jobCards"
  | "leaves"
  | "pnrs"
  | "proposals"
  | "queries"
  | "seats"
  | "staff"
  | "team"
  | "tickets"
  | "tourManagers"
  | "travellers"
  | "visas";

const VIEW_DEPENDENCIES: Record<string, readonly PortalDataDependency[]> = {
  "accounts-job-cards": ["queries", "jobCards"],
  activity: ["activity"],
  approvals: ["approvals", "expenses"],
  contracting: ["queries", "proposals", "team"],
  dashboard: [],
  "employees-on-leave": ["leaves", "team"],
  expenses: ["expenses", "jobCards"],
  finance: ["invoices", "jobCards"],
  flights: ["pnrs", "flightItinerary", "jobCards"],
  hotels: ["hotels", "travellers", "jobCards"],
  "job-cards": ["jobCards"],
  passport: ["travellers", "jobCards"],
  pipeline: ["queries"],
  proposals: ["proposals", "queries"],
  queries: ["queries"],
  reports: [],
  "seat-allocation": ["seats", "jobCards"],
  settings: ["staff"],
  team: ["team"],
  ticketing: ["tickets", "jobCards"],
  tickets: ["tickets", "jobCards"],
  "tour-managers": ["tourManagers", "jobCards"],
  travellers: ["travellers", "jobCards"],
  visa: ["visas", "travellers", "jobCards"],
};

const MODAL_DEPENDENCIES: Record<string, readonly PortalDataDependency[]> = {
  addJobCardCollaborator: ["jobCards", "team"],
  addProposalCollaborator: ["proposals", "team"],
  approval: ["approvals", "expenses"],
  assignContracting: ["queries", "team"],
  assignContractingOwner: ["jobCards", "team"],
  assignOperationsOwner: ["jobCards", "team"],
  assignQueryTeams: ["queries", "team"],
  assignQueryTicketing: ["queries", "team"],
  assignTicketingOwner: ["jobCards", "team"],
  expense: ["expenses", "jobCards"],
  hotel: ["hotels", "jobCards"],
  invoice: ["invoices", "jobCards"],
  jobCard: ["jobCards", "queries", "proposals"],
  leave_create: ["leaves", "team"],
  pnr: ["pnrs", "jobCards"],
  proposal: ["proposals", "queries"],
  query: ["queries", "team"],
  queryStatus: ["queries"],
  salesDecision: ["queries"],
  seat: ["seats", "tickets", "pnrs", "travellers", "jobCards"],
  ticket: ["tickets", "pnrs", "travellers", "jobCards"],
  tourManager: ["tourManagers", "jobCards"],
  traveller: ["travellers", "jobCards"],
  visa: ["visas", "travellers", "jobCards"],
  visa_create: ["visas", "travellers", "jobCards"],
};

export function getPortalDataDependencies({
  deepLinkOpen,
  modal,
  view,
}: {
  deepLinkOpen?: string | null;
  modal?: string | null;
  view: string;
}): ReadonlySet<PortalDataDependency> {
  return new Set([
    ...(VIEW_DEPENDENCIES[view] ?? []),
    ...(modal ? (MODAL_DEPENDENCIES[modal] ?? []) : []),
    ...(deepLinkOpen ? (MODAL_DEPENDENCIES[deepLinkOpen] ?? []) : []),
  ]);
}
