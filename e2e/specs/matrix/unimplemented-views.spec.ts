import { test } from "@playwright/test";
import {
  PORTAL_E2E_COVERED_CELL_IDS,
  PORTAL_E2E_MATRIX,
  portalE2eCellId,
} from "../../registry/portalViews";

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
  "inbound-leads": "/portal/inbound-leads",
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

for (const [viewId, entry] of Object.entries(PORTAL_E2E_MATRIX)) {
  for (const cell of entry.cells) {
    const cellId = portalE2eCellId(viewId as keyof typeof PORTAL_E2E_MATRIX, cell);
    if (PORTAL_E2E_COVERED_CELL_IDS.has(cellId)) {
      continue;
    }

    test.describe(`@smoke matrix backlog: ${cellId}`, () => {
      test.skip(true, `Planned matrix coverage stub ${cellId} — not implemented`);

      test(`opens ${VIEW_PATHS[viewId] ?? viewId}`, async () => {
        // Implemented in a dedicated spec when this exact role/action cell is promoted.
      });
    });
  }
}
