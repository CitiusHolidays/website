/**
 * Planned CRM interaction matrix keyed by portal view IDs.
 * Ticket 16 expands stubs into full @smoke coverage.
 */
export const PORTAL_E2E_MATRIX = {
  "accounts-job-cards": { actions: ["workflow"], roles: ["admin"] },
  activity: { actions: ["readOnly"], roles: ["admin"] },
  approvals: { actions: ["smoke"], roles: ["finance"] },
  contracting: { actions: ["edit", "sendToSales"], roles: ["contracting"] },
  dashboard: { actions: ["readOnly"], roles: ["admin", "sales"] },
  "employees-on-leave": { actions: ["create"], roles: ["hr"] },
  expenses: { actions: ["create"], roles: ["finance"] },
  finance: { actions: ["smoke"], roles: ["finance"] },
  flights: { actions: ["smoke"], roles: ["ticketing"] },
  hotels: { actions: ["smoke"], roles: ["operations"] },
  "job-cards": { actions: ["readOnly"], roles: ["operations"] },
  passport: { actions: ["uploadModal"], roles: ["operations"] },
  pipeline: { actions: ["workflow"], roles: ["sales", "contracting"] },
  proposals: { actions: ["edit"], roles: ["contracting", "sales"] },
  queries: { actions: ["create", "edit", "salesDecision"], roles: ["sales"] },
  reports: { actions: ["smoke"], roles: ["finance"] },
  "seat-allocation": { actions: ["smoke"], roles: ["ticketing"] },
  settings: { actions: ["edit"], roles: ["admin"] },
  team: { actions: ["create", "edit"], roles: ["admin"] },
  ticketing: { actions: ["smoke"], roles: ["ticketing"] },
  tickets: { actions: ["edit"], roles: ["ticketing"] },
  "tour-managers": { actions: ["smoke"], roles: ["operations"] },
  travellers: { actions: ["create", "edit", "delete"], roles: ["operations"] },
  visa: { actions: ["smoke"], roles: ["operations"] },
} as const;

export type PortalE2eViewId = keyof typeof PORTAL_E2E_MATRIX;

/** Views with live Playwright specs (tickets 05–15). Matrix stubs skip these. */
export const PORTAL_E2E_IMPLEMENTED_VIEWS = new Set<PortalE2eViewId>([
  "accounts-job-cards",
  "employees-on-leave",
  "expenses",
  "passport",
  "proposals",
  "queries",
  "settings",
  "tickets",
  "travellers",
]);
