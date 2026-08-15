export interface PortalE2eCell {
  action: string;
  role: string;
}

/** Exact planned action-by-role cells, keyed by the application route view ID. */
export const PORTAL_E2E_MATRIX = {
  "accounts-job-cards": { cells: [{ action: "workflow", role: "accounts" }] },
  activity: { cells: [{ action: "readOnly", role: "admin" }] },
  approvals: { cells: [{ action: "smoke", role: "finance" }] },
  contracting: {
    cells: [
      { action: "edit", role: "contracting" },
      { action: "sendToSales", role: "contracting" },
    ],
  },
  dashboard: {
    cells: [
      { action: "readOnly", role: "admin" },
      { action: "readOnly", role: "sales" },
    ],
  },
  "employees-on-leave": {
    cells: [
      { action: "create", role: "hr" },
      { action: "approveHead", role: "leave-head" },
      { action: "approveHr", role: "hr" },
    ],
  },
  expenses: { cells: [{ action: "create", role: "finance" }] },
  finance: { cells: [{ action: "smoke", role: "finance" }] },
  flights: { cells: [{ action: "smoke", role: "ticketing" }] },
  hotels: { cells: [{ action: "smoke", role: "operations" }] },
  "inbound-leads": { cells: [{ action: "readOnly", role: "sales" }] },
  "job-cards": { cells: [{ action: "readOnly", role: "operations" }] },
  passport: { cells: [{ action: "uploadModal", role: "operations" }] },
  pipeline: {
    cells: [
      { action: "workflow", role: "sales" },
      { action: "workflow", role: "contracting" },
    ],
  },
  proposals: {
    cells: [
      { action: "edit", role: "contracting" },
      { action: "sendToSales", role: "contracting" },
      { action: "guardIncompletePricing", role: "contracting" },
      { action: "edit", role: "sales" },
    ],
  },
  queries: {
    cells: [
      { action: "create", role: "sales" },
      { action: "edit", role: "sales" },
      { action: "salesDecision", role: "sales" },
      { action: "denySalesDecision", role: "contracting" },
      { action: "cementScope", role: "sales-cement" },
      { action: "cementScope", role: "contracting-cement" },
    ],
  },
  reports: { cells: [{ action: "smoke", role: "finance" }] },
  "seat-allocation": { cells: [{ action: "smoke", role: "ticketing" }] },
  settings: {
    cells: [
      { action: "openCreateModal", role: "admin" },
      { action: "edit", role: "admin" },
    ],
  },
  team: {
    cells: [
      { action: "create", role: "admin" },
      { action: "edit", role: "admin" },
    ],
  },
  ticketing: { cells: [{ action: "smoke", role: "ticketing" }] },
  tickets: { cells: [{ action: "edit", role: "ticketing" }] },
  "tour-managers": { cells: [{ action: "smoke", role: "operations" }] },
  travellers: {
    cells: [
      { action: "create", role: "operations" },
      { action: "edit", role: "operations" },
      { action: "delete", role: "operations" },
    ],
  },
  visa: { cells: [{ action: "smoke", role: "operations" }] },
} as const;

export type PortalE2eViewId = keyof typeof PORTAL_E2E_MATRIX;

export function portalE2eCellId(viewId: PortalE2eViewId, cell: PortalE2eCell) {
  return `${viewId}:${cell.role}:${cell.action}`;
}

export interface PortalE2eCoveredCell {
  action: string;
  role: string;
  spec: string;
  testId: string;
  testTitle: string;
  viewId: PortalE2eViewId;
}

/**
 * A cell is covered only when this registry points to a live spec and stable title. A whole view is
 * never marked implemented: uncovered actions/roles continue to generate explicit backlog stubs.
 */
export const PORTAL_E2E_COVERED_CELLS: readonly PortalE2eCoveredCell[] = [
  {
    action: "create",
    role: "sales",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-05",
    testTitle: "[crm-critical-05] sales creates and submits query to contracting",
    viewId: "queries",
  },
  {
    action: "edit",
    role: "contracting",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "proposal-incomplete-pricing-guard",
    testTitle: "[proposal-incomplete-pricing-guard] Send to Sales refuses incomplete pricing",
    viewId: "proposals",
  },
  {
    action: "sendToSales",
    role: "contracting",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-06",
    testTitle: "[crm-critical-06] contracting drafts proposal and sends to sales",
    viewId: "proposals",
  },
  {
    action: "salesDecision",
    role: "sales",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-07",
    testTitle: "[crm-critical-07] sales revises dates and records the Confirmed Offer",
    viewId: "queries",
  },
  {
    action: "workflow",
    role: "accounts",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-08",
    testTitle: "[crm-critical-08] accounts opens job card from confirmed query",
    viewId: "accounts-job-cards",
  },
  {
    action: "create",
    role: "operations",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-09",
    testTitle: "[crm-critical-09] operations creates and edits traveller",
    viewId: "travellers",
  },
  {
    action: "edit",
    role: "operations",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-09",
    testTitle: "[crm-critical-09] operations creates and edits traveller",
    viewId: "travellers",
  },
  {
    action: "delete",
    role: "operations",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-10",
    testTitle: "[crm-critical-10] destructive delete requires hold-to-confirm",
    viewId: "travellers",
  },
  {
    action: "create",
    role: "finance",
    spec: "e2e/specs/finance-expense.spec.ts",
    testId: "finance-expense-create",
    testTitle: "[finance-expense-create] finance creates an owned draft expense",
    viewId: "expenses",
  },
  {
    action: "create",
    role: "hr",
    spec: "e2e/specs/hr-leave.spec.ts",
    testId: "hr-leave-create",
    testTitle: "[hr-leave-create] HR submits leave request",
    viewId: "employees-on-leave",
  },
  {
    action: "uploadModal",
    role: "operations",
    spec: "e2e/specs/passport-modal.spec.ts",
    testId: "passport-upload-modal",
    testTitle: "[passport-upload-modal] operations opens passport upload modal and cancels",
    viewId: "passport",
  },
  {
    action: "openCreateModal",
    role: "admin",
    spec: "e2e/specs/admin-settings.spec.ts",
    testId: "admin-settings-open-create",
    testTitle: "[admin-settings-open-create] admin opens staff modal and cancels",
    viewId: "settings",
  },
  {
    action: "edit",
    role: "ticketing",
    spec: "e2e/specs/ticketing-row-edit.spec.ts",
    testId: "ticketing-ticket-edit",
    testTitle: "[ticketing-ticket-edit] ticketing opens edit modal and saves",
    viewId: "tickets",
  },
  {
    action: "approveHead",
    role: "leave-head",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "leave-head-then-hr",
    testTitle: "[leave-head-then-hr] assigned head approves before HR final approval",
    viewId: "employees-on-leave",
  },
  {
    action: "approveHr",
    role: "hr",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "leave-head-then-hr",
    testTitle: "[leave-head-then-hr] assigned head approves before HR final approval",
    viewId: "employees-on-leave",
  },
  {
    action: "cementScope",
    role: "sales-cement",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "cement-role-scope",
    testTitle: "[cement-role-scope] Cement roles cannot enumerate non-Cement work",
    viewId: "queries",
  },
  {
    action: "cementScope",
    role: "contracting-cement",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "cement-role-scope",
    testTitle: "[cement-role-scope] Cement roles cannot enumerate non-Cement work",
    viewId: "queries",
  },
  {
    action: "guardIncompletePricing",
    role: "contracting",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "proposal-incomplete-pricing-guard",
    testTitle: "[proposal-incomplete-pricing-guard] Send to Sales refuses incomplete pricing",
    viewId: "proposals",
  },
  {
    action: "denySalesDecision",
    role: "contracting",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "queries-contracting-deny-sales-decision",
    testTitle:
      "[queries-contracting-deny-sales-decision] contracting user does not see Sales Decision",
    viewId: "queries",
  },
] as const;

export const PORTAL_E2E_COVERED_CELL_IDS = new Set(
  PORTAL_E2E_COVERED_CELLS.map((cell) => portalE2eCellId(cell.viewId, cell))
);

export function portalE2eCoverageSummary() {
  const planned = Object.entries(PORTAL_E2E_MATRIX).flatMap(([viewId, entry]) =>
    entry.cells.map((cell) => ({ ...cell, viewId: viewId as PortalE2eViewId }))
  );
  const coveredActions = new Set(PORTAL_E2E_COVERED_CELLS.map((cell) => cell.action));
  const plannedActions = new Set(planned.map((cell) => cell.action));
  const coveredRoles = new Set(PORTAL_E2E_COVERED_CELLS.map((cell) => cell.role));
  const plannedRoles = new Set(planned.map((cell) => cell.role));
  const coveredViews = new Set(PORTAL_E2E_COVERED_CELLS.map((cell) => cell.viewId));
  return {
    actions: { covered: coveredActions.size, total: plannedActions.size },
    cells: { covered: PORTAL_E2E_COVERED_CELLS.length, total: planned.length },
    roles: { covered: coveredRoles.size, total: plannedRoles.size },
    views: { covered: coveredViews.size, total: Object.keys(PORTAL_E2E_MATRIX).length },
  };
}
