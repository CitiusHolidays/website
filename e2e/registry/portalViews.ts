import type { PortalViewId } from "../../src/lib/portal/portalRouteManifest";
import { hasOwnKey } from "../../src/lib/runtimeValues";
import type { E2eRoleProfileKey } from "../fixtures/staffProfiles";

interface PortalE2ePlannedCell {
  action: string;
  role: E2eRoleProfileKey;
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
  tickets: {
    cells: [
      { action: "edit", role: "ticketing" },
      { action: "smoke", role: "ticketing-head" },
    ],
  },
  "tour-managers": { cells: [{ action: "smoke", role: "operations" }] },
  travellers: {
    cells: [
      { action: "create", role: "operations" },
      { action: "edit", role: "operations" },
      { action: "delete", role: "operations" },
    ],
  },
  visa: { cells: [{ action: "smoke", role: "operations" }] },
} as const satisfies Record<PortalViewId, { cells: readonly PortalE2ePlannedCell[] }>;

export type PortalE2eViewId = keyof typeof PORTAL_E2E_MATRIX;

function mobilePortalTestId(role: E2eRoleProfileKey) {
  return `mobile-${role}`;
}

export function mobilePortalTestTitle(role: E2eRoleProfileKey) {
  return `[${mobilePortalTestId(role)}] Route supports navigation, account menu, and no overflow`;
}

export const PORTAL_E2E_MOBILE_ROLE_SCENARIOS: readonly {
  heading: RegExp;
  href: string;
  role: E2eRoleProfileKey;
  viewId: PortalE2eViewId;
}[] = [
  { heading: /My work today/i, href: "/portal", role: "admin", viewId: "dashboard" },
  {
    heading: /^Inbound Leads$/i,
    href: "/portal/inbound-leads",
    role: "sales",
    viewId: "inbound-leads",
  },
  {
    heading: /^Proposals$/i,
    href: "/portal/proposals",
    role: "contracting",
    viewId: "proposals",
  },
  {
    heading: /^Job Cards$/i,
    href: "/portal/job-cards",
    role: "operations",
    viewId: "job-cards",
  },
  {
    heading: /^All Tickets$/i,
    href: "/portal/tickets",
    role: "ticketing",
    viewId: "tickets",
  },
  {
    heading: /^All Tickets$/i,
    href: "/portal/tickets",
    role: "ticketing-head",
    viewId: "tickets",
  },
  { heading: /^Finance$/i, href: "/portal/finance", role: "finance", viewId: "finance" },
  {
    heading: /Accounts \/ Job Card Creation/i,
    href: "/portal/accounts/job-cards",
    role: "accounts",
    viewId: "accounts-job-cards",
  },
  {
    heading: /Leave/i,
    href: "/portal/employees-on-leave",
    role: "hr",
    viewId: "employees-on-leave",
  },
  {
    heading: /Leave/i,
    href: "/portal/employees-on-leave",
    role: "leave-head",
    viewId: "employees-on-leave",
  },
  {
    heading: /All Sales Queries/i,
    href: "/portal/queries",
    role: "sales-cement",
    viewId: "queries",
  },
  {
    heading: /^Proposals$/i,
    href: "/portal/proposals",
    role: "contracting-cement",
    viewId: "proposals",
  },
];

export interface PortalE2eCoveredCell {
  action: string;
  role: E2eRoleProfileKey;
  spec: string;
  testId: string;
  testTitle: string;
  viewId: PortalE2eViewId;
}

/**
 * A cell is registered only when this inventory points to a live spec and stable title. Execution
 * is computed separately from passing tests; unregistered actions and views remain visible here.
 */
export const PORTAL_E2E_COVERED_CELLS: readonly PortalE2eCoveredCell[] = [
  {
    action: "create",
    role: "sales",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-05",
    testTitle: "[crm-critical-05] Sales creates and submits query to contracting",
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
    testTitle: "[crm-critical-06] Contracting drafts proposal and sends to sales",
    viewId: "proposals",
  },
  {
    action: "salesDecision",
    role: "sales",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-07",
    testTitle: "[crm-critical-07] Sales revises dates and records the Confirmed Offer",
    viewId: "queries",
  },
  {
    action: "workflow",
    role: "accounts",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-08",
    testTitle: "[crm-critical-08] Accounts opens job card from confirmed query",
    viewId: "accounts-job-cards",
  },
  {
    action: "create",
    role: "operations",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-09",
    testTitle: "[crm-critical-09] Operations creates and edits traveller",
    viewId: "travellers",
  },
  {
    action: "edit",
    role: "operations",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-09",
    testTitle: "[crm-critical-09] Operations creates and edits traveller",
    viewId: "travellers",
  },
  {
    action: "delete",
    role: "operations",
    spec: "e2e/specs/critical-path.spec.ts",
    testId: "crm-critical-10",
    testTitle: "[crm-critical-10] Destructive delete requires hold-to-confirm",
    viewId: "travellers",
  },
  {
    action: "create",
    role: "finance",
    spec: "e2e/specs/finance-expense.spec.ts",
    testId: "finance-expense-create",
    testTitle: "[finance-expense-create] Finance creates an owned draft expense",
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
    testTitle: "[passport-upload-modal] Operations opens passport upload modal and cancels",
    viewId: "passport",
  },
  {
    action: "openCreateModal",
    role: "admin",
    spec: "e2e/specs/admin-settings.spec.ts",
    testId: "admin-settings-open-create",
    testTitle: "[admin-settings-open-create] Admin opens staff modal and cancels",
    viewId: "settings",
  },
  {
    action: "edit",
    role: "ticketing",
    spec: "e2e/specs/ticketing-row-edit.spec.ts",
    testId: "ticketing-ticket-edit",
    testTitle: "[ticketing-ticket-edit] Ticketing opens edit modal and saves",
    viewId: "tickets",
  },
  {
    action: "approveHead",
    role: "leave-head",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "leave-head-then-hr",
    testTitle: "[leave-head-then-hr] Assigned head approves before HR final approval",
    viewId: "employees-on-leave",
  },
  {
    action: "approveHr",
    role: "hr",
    spec: "e2e/specs/workflow/role-semantics.spec.ts",
    testId: "leave-head-then-hr",
    testTitle: "[leave-head-then-hr] Assigned head approves before HR final approval",
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
      "[queries-contracting-deny-sales-decision] Contracting user does not see Sales Decision",
    viewId: "queries",
  },
  {
    action: "readOnly",
    role: "sales",
    spec: "e2e/specs/mobile-portal-quality.spec.ts",
    testId: mobilePortalTestId("sales"),
    testTitle: mobilePortalTestTitle("sales"),
    viewId: "inbound-leads",
  },
  {
    action: "smoke",
    role: "finance",
    spec: "e2e/specs/mobile-portal-quality.spec.ts",
    testId: mobilePortalTestId("finance"),
    testTitle: mobilePortalTestTitle("finance"),
    viewId: "finance",
  },
  {
    action: "smoke",
    role: "ticketing-head",
    spec: "e2e/specs/mobile-portal-quality.spec.ts",
    testId: mobilePortalTestId("ticketing-head"),
    testTitle: mobilePortalTestTitle("ticketing-head"),
    viewId: "tickets",
  },
] as const;

export function portalE2ePlannedCells() {
  return Object.keys(PORTAL_E2E_MATRIX).flatMap((viewId) => {
    if (!hasOwnKey(PORTAL_E2E_MATRIX, viewId)) {
      return [];
    }
    return PORTAL_E2E_MATRIX[viewId].cells.map((cell) => ({ ...cell, viewId }));
  });
}

function matrixDimensions(cells: readonly PortalE2eCoveredCell[]) {
  return {
    actions: new Set(cells.map((cell) => cell.action)).size,
    cells: cells.length,
    roles: new Set(cells.map((cell) => cell.role)).size,
    views: new Set(cells.map((cell) => cell.viewId)).size,
  };
}

export function portalE2eDiscoverySummary() {
  const planned = portalE2ePlannedCells();
  const registered = matrixDimensions(PORTAL_E2E_COVERED_CELLS);
  const plannedActions = new Set(planned.map((cell) => cell.action));
  const plannedRoles = new Set(planned.map((cell) => cell.role));
  return {
    actions: { registered: registered.actions, total: plannedActions.size },
    cells: { registered: registered.cells, total: planned.length },
    roles: { registered: registered.roles, total: plannedRoles.size },
    views: { registered: registered.views, total: Object.keys(PORTAL_E2E_MATRIX).length },
  };
}

export function portalE2eExecutionSummary(passedTestTitles: Iterable<string>) {
  const passed = new Set(passedTestTitles);
  const registered = matrixDimensions(PORTAL_E2E_COVERED_CELLS);
  const executed = matrixDimensions(
    PORTAL_E2E_COVERED_CELLS.filter((cell) => passed.has(cell.testTitle))
  );
  return {
    actions: { executed: executed.actions, total: registered.actions },
    cells: { executed: executed.cells, total: registered.cells },
    roles: { executed: executed.roles, total: registered.roles },
    views: { executed: executed.views, total: registered.views },
  };
}
