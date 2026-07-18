import { test } from "@playwright/test";
import { PORTAL_E2E_MATRIX, PORTAL_E2E_IMPLEMENTED_VIEWS } from "../../registry/portalViews";

const VIEW_PATHS: Record<string, string> = {
  "accounts-job-cards": "/portal/accounts/job-cards",
  activity: "/portal/activity",
  approvals: "/portal/approvals",
  contracting: "/portal/contracting",
  dashboard: "/portal",
  "employees-on-leave": "/portal/employees-on-leave",
  expenses: "/portal/expenses",
  finance: "/portal/finance",
  flights: "/portal/flights",
  hotels: "/portal/hotels",
  "job-cards": "/portal/job-cards",
  passport: "/portal/passport",
  pipeline: "/portal/pipeline",
  proposals: "/portal/proposals",
  queries: "/portal/queries",
  reports: "/portal/reports",
  "seat-allocation": "/portal/seat-allocation",
  settings: "/portal/settings",
  team: "/portal/team",
  ticketing: "/portal/ticketing",
  tickets: "/portal/tickets",
  "tour-managers": "/portal/tour-managers",
  travellers: "/portal/travellers",
  visa: "/portal/visa",
};

for (const [viewId, cell] of Object.entries(PORTAL_E2E_MATRIX)) {
  if (PORTAL_E2E_IMPLEMENTED_VIEWS.has(viewId as keyof typeof PORTAL_E2E_MATRIX)) {
    continue;
  }

  test.describe(`@smoke matrix backlog: ${viewId}`, () => {
    test.skip(
      true,
      `Matrix cell ${viewId} (${cell.actions.join(", ")}) — see e2e/registry/portalViews.ts`
    );

    test(`opens ${VIEW_PATHS[viewId] ?? viewId}`, async () => {
      // Implemented in dedicated specs when the matrix cell is promoted.
    });
  });
}
