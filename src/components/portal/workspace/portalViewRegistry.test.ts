import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ADMINISTRATION_PORTAL_VIEW_IDS,
  ALL_PORTAL_VIEW_IDS,
  CORE_PORTAL_VIEW_IDS,
  isAdministrationPortalView,
  isCorePortalView,
  isOperationsPortalView,
  isPilotPortalView,
  isTicketingPortalView,
  OPERATIONS_PORTAL_VIEW_IDS,
  PILOT_PORTAL_VIEW_IDS,
  renderAdministrationPortalView,
  renderOperationsPortalView,
  renderPilotPortalView,
  renderTicketingPortalView,
  TICKETING_PORTAL_VIEW_IDS,
} from "./portalViewRegistry";

const WORKSPACE_FILE = "src/components/portal/PortalWorkspace.tsx";
const REGISTRY_FILE = "src/components/portal/workspace/portalViewRegistry.tsx";
const WORKSPACE_STATE_FILE = "src/components/portal/usePortalWorkspaceState.ts";

const FOCUSED_MODULE_CEILING = 500;
const PORTAL_WORKSPACE_LINE_CEILING = 200;
const WORKSPACE_STATE_LINE_CEILING = 1000;
const CATCH_ALL_RECORD_PATTERN = /Record<string,\s*any>/;
const ANY_TYPE_PATTERN = /:\s*any\b/;

function expectFunctionsAbsent(source: string, names: readonly string[]) {
  for (const name of names) {
    expect(source).not.toContain(`function ${name}(`);
  }
}

function read(file: string) {
  return readFileSync(file, "utf8");
}

function lineCount(file: string) {
  return read(file).split("\n").length;
}

const OPERATIONS_VIEW_FILES: Record<string, string> = {
  hotels: "operations/HotelRoomingView.tsx",
  "job-cards": "operations/JobCardsView.tsx",
  passport: "operations/PassportDocumentsView.tsx",
  "tour-managers": "operations/TourManagersView.tsx",
  travellers: "operations/TravellersView.tsx",
  visa: "operations/VisaTrackingView.tsx",
};

describe("portal pilot view registry", () => {
  test("registers only queries, contracting, and proposals as pilot views", () => {
    expect(PILOT_PORTAL_VIEW_IDS).toEqual(["queries", "contracting", "proposals"]);
    expect(isPilotPortalView("queries")).toBe(true);
    expect(isPilotPortalView("contracting")).toBe(true);
    expect(isPilotPortalView("proposals")).toBe(true);
    expect(isPilotPortalView("pipeline")).toBe(false);
    expect(isPilotPortalView("job-cards")).toBe(false);
    expect(isPilotPortalView("dashboard")).toBe(false);
  });

  test("returns null for non-pilot views so legacy rendering can continue", () => {
    expect(
      renderPilotPortalView({
        view: "pipeline",
      })
    ).toBeNull();
    expect(
      renderPilotPortalView({
        view: "dashboard",
      })
    ).toBeNull();
  });

  test("routes each pilot view id to its extracted typed module", () => {
    const registry = read(REGISTRY_FILE);
    const workspace = read(WORKSPACE_FILE);
    expect(registry).toContain("renderPilotPortalView");
    expect(workspace).toContain("renderPortalView");
    expectFunctionsAbsent(workspace, ["QueriesView", "ContractingView", "ProposalsView"]);

    for (const viewId of PILOT_PORTAL_VIEW_IDS) {
      const fileName =
        viewId === "queries"
          ? "QueriesView.tsx"
          : viewId === "contracting"
            ? "ContractingView.tsx"
            : "ProposalsView.tsx";
      expect(read(`src/components/portal/workspace/${fileName}`)).toContain("SelectableDataTable");
    }
  });

  test("keeps pilot view props typed without catch-all workspace records", () => {
    const types = read("src/components/portal/workspace/portalViewTypes.ts");
    expect(types).toContain("export interface QueriesViewProps");
    expect(types).toContain("export interface ContractingViewProps");
    expect(types).toContain("export interface ProposalsViewProps");
    expect(types).not.toMatch(CATCH_ALL_RECORD_PATTERN);
    expect(types).not.toMatch(ANY_TYPE_PATTERN);
  });

  test("ratchets PortalWorkspace line count after pilot extraction", () => {
    expect(lineCount(WORKSPACE_FILE)).toBeLessThanOrEqual(PORTAL_WORKSPACE_LINE_CEILING);
  });
});

describe("portal core view registry", () => {
  test("registers dashboard, pipeline, and accounts job cards", () => {
    expect(CORE_PORTAL_VIEW_IDS).toEqual(["dashboard", "pipeline", "accounts-job-cards"]);
    expect(isCorePortalView("dashboard")).toBe(true);
    expect(isCorePortalView("pipeline")).toBe(true);
    expect(isCorePortalView("accounts-job-cards")).toBe(true);
    expect(isCorePortalView("queries")).toBe(false);
  });

  test("routes core views through the registry", () => {
    const registry = read(REGISTRY_FILE);
    expect(registry).toContain("renderCorePortalView");
    expect(registry).toContain("<DashboardView");
    expect(registry).toContain("<PipelineView");
    expect(registry).toContain("<AccountsJobCardView");
    expect(read("src/components/portal/workspace/accounts/AccountsJobCardView.tsx")).toContain(
      "SelectableDataTable"
    );
  });

  test("keeps core view props typed", () => {
    const types = read("src/components/portal/workspace/portalViewTypes.ts");
    expect(types).toContain("export interface DashboardViewProps");
    expect(types).toContain("export interface PipelineViewProps");
    expect(types).toContain("export interface AccountsJobCardViewProps");
  });
});

describe("portal operations view registry", () => {
  test("registers job-card operations views", () => {
    expect(OPERATIONS_PORTAL_VIEW_IDS).toEqual([
      "job-cards",
      "travellers",
      "passport",
      "visa",
      "hotels",
      "tour-managers",
    ]);
    expect(isOperationsPortalView("job-cards")).toBe(true);
    expect(isOperationsPortalView("travellers")).toBe(true);
    expect(isOperationsPortalView("passport")).toBe(true);
    expect(isOperationsPortalView("visa")).toBe(true);
    expect(isOperationsPortalView("hotels")).toBe(true);
    expect(isOperationsPortalView("tour-managers")).toBe(true);
    expect(isOperationsPortalView("ticketing")).toBe(false);
    expect(isOperationsPortalView("queries")).toBe(false);
  });

  test("returns null for non-operations views", () => {
    expect(renderOperationsPortalView({ view: "ticketing" })).toBeNull();
    expect(renderOperationsPortalView({ view: "dashboard" })).toBeNull();
  });

  test("routes each operations view id to its extracted typed module", () => {
    const registry = read(REGISTRY_FILE);
    const workspace = read(WORKSPACE_FILE);
    expect(registry).toContain("renderOperationsPortalView");
    expect(registry).toContain("jobCardDeletionOperations={workspace.jobCardDeletionOperations}");
    expect(workspace).toContain("renderPortalView");
    expectFunctionsAbsent(workspace, [
      "JobCardsView",
      "TravellersView",
      "PassportDocumentsView",
      "VisaTrackingView",
      "HotelRoomingTabs",
      "TourManagersView",
    ]);

    for (const viewId of OPERATIONS_PORTAL_VIEW_IDS) {
      const fileName = OPERATIONS_VIEW_FILES[viewId];
      const source = read(`src/components/portal/workspace/${fileName}`);
      if (viewId === "hotels") {
        expect(source).toContain("PortalTabs");
        expect(read("src/components/portal/workspace/operations/RoomingListView.tsx")).toContain(
          "SelectableDataTable"
        );
      } else {
        expect(source).toContain("SelectableDataTable");
      }
    }
  });

  test("keeps operations view props typed", () => {
    const types = read("src/components/portal/workspace/portalViewTypes.ts");
    expect(types).toContain("export interface JobCardsViewProps");
    expect(types).toContain("export interface PortalJobCardDeletionOperation");
    expect(types).toContain("export interface TravellersViewProps");
    expect(types).toContain("export interface PassportDocumentsViewProps");
    expect(types).toContain("export interface VisaTrackingViewProps");
    expect(types).toContain("export interface HotelRoomingViewProps");
    expect(types).toContain("export interface TourManagersViewProps");
  });

  test("keeps extracted operations modules under 500 lines", () => {
    for (const fileName of Object.values(OPERATIONS_VIEW_FILES)) {
      const lineCount = read(`src/components/portal/workspace/${fileName}`).split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(500);
    }
  });

  test("ratchets PortalWorkspace line count after operations extraction", () => {
    expect(lineCount(WORKSPACE_FILE)).toBeLessThanOrEqual(PORTAL_WORKSPACE_LINE_CEILING);
  });
});

const TICKETING_VIEW_FILES: Record<string, string> = {
  flights: "ticketing/PnrView.tsx",
  "seat-allocation": "ticketing/SeatView.tsx",
  ticketing: "ticketing/TicketDashboardView.tsx",
  tickets: "ticketing/TicketsView.tsx",
};

const ADMINISTRATION_VIEW_FILES: Record<string, string> = {
  activity: "admin/ActivityView.tsx",
  approvals: "admin/ApprovalsView.tsx",
  "employees-on-leave": "admin/LeaveView.tsx",
  expenses: "admin/ExpensesView.tsx",
  finance: "admin/FinanceView.tsx",
  reports: "admin/ReportsView.tsx",
  settings: "admin/SettingsView.tsx",
  team: "admin/TeamView.tsx",
};

describe("portal ticketing view registry", () => {
  test("registers ticketing views", () => {
    expect(TICKETING_PORTAL_VIEW_IDS).toEqual([
      "ticketing",
      "flights",
      "seat-allocation",
      "tickets",
    ]);
    expect(isTicketingPortalView("ticketing")).toBe(true);
    expect(isTicketingPortalView("flights")).toBe(true);
    expect(isTicketingPortalView("finance")).toBe(false);
  });

  test("returns null for non-ticketing views", () => {
    expect(renderTicketingPortalView({ view: "finance" })).toBeNull();
    expect(renderTicketingPortalView({ view: "queries" })).toBeNull();
  });

  test("routes each ticketing view id to its extracted typed module", () => {
    const registry = read(REGISTRY_FILE);
    const workspace = read(WORKSPACE_FILE);
    expect(registry).toContain("renderTicketingPortalView");
    expect(workspace).toContain("renderPortalView");
    expectFunctionsAbsent(workspace, ["TicketDashboardView", "PnrView", "TicketsView", "SeatView"]);

    for (const viewId of TICKETING_PORTAL_VIEW_IDS) {
      const fileName = TICKETING_VIEW_FILES[viewId];
      const source = read(`src/components/portal/workspace/${fileName}`);
      if (viewId === "ticketing") {
        expect(source).toContain("TicketsView");
      } else {
        expect(source).toContain("SelectableDataTable");
      }
    }
  });

  test("keeps ticketing view props typed", () => {
    const types = read("src/components/portal/workspace/portalViewTypes.ts");
    expect(types).toContain("export interface TicketDashboardViewProps");
    expect(types).toContain("export interface TicketsViewProps");
    expect(types).toContain("export interface PnrViewProps");
    expect(types).toContain("export interface SeatViewProps");
  });

  test("keeps extracted ticketing modules under 500 lines", () => {
    for (const fileName of Object.values(TICKETING_VIEW_FILES)) {
      const lineCount = read(`src/components/portal/workspace/${fileName}`).split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(500);
    }
  });
});

describe("portal administration view registry", () => {
  test("registers finance and administration views", () => {
    expect(ADMINISTRATION_PORTAL_VIEW_IDS).toEqual([
      "finance",
      "expenses",
      "approvals",
      "reports",
      "team",
      "employees-on-leave",
      "activity",
      "settings",
    ]);
    expect(isAdministrationPortalView("finance")).toBe(true);
    expect(isAdministrationPortalView("settings")).toBe(true);
    expect(isAdministrationPortalView("ticketing")).toBe(false);
  });

  test("returns null for non-administration views", () => {
    expect(renderAdministrationPortalView({ view: "ticketing" })).toBeNull();
    expect(renderAdministrationPortalView({ view: "dashboard" })).toBeNull();
  });

  test("routes each administration view id to its extracted typed module", () => {
    const registry = read(REGISTRY_FILE);
    const workspace = read(WORKSPACE_FILE);
    expect(registry).toContain("renderAdministrationPortalView");
    expect(workspace).toContain("renderPortalView");
    expectFunctionsAbsent(workspace, [
      "FinanceView",
      "ExpensesView",
      "ApprovalsView",
      "LeaveView",
      "SettingsView",
    ]);

    for (const viewId of ADMINISTRATION_PORTAL_VIEW_IDS) {
      const fileName = ADMINISTRATION_VIEW_FILES[viewId];
      const source = read(`src/components/portal/workspace/${fileName}`);
      if (viewId === "reports") {
        expect(source).toContain("SelectableDataTable");
        expect(source).toContain("StatCard");
      } else if (viewId === "activity") {
        expect(source).toContain("Notifications");
      } else if (viewId === "settings") {
        expect(source).toContain("StaffWorkbookImportPanel");
        expect(source).toContain("SelectableDataTable");
      } else {
        expect(source).toContain("SelectableDataTable");
      }
    }
  });

  test("keeps administration view props typed", () => {
    const types = read("src/components/portal/workspace/portalViewTypes.ts");
    expect(types).toContain("export interface FinanceViewProps");
    expect(types).toContain("export interface ExpensesViewProps");
    expect(types).toContain("export interface ApprovalsViewProps");
    expect(types).toContain("export interface LeaveViewProps");
    expect(types).toContain("export interface ActivityViewProps");
    expect(types).toContain("export interface SettingsViewProps");
  });

  test("keeps extracted administration modules under 500 lines", () => {
    for (const fileName of Object.values(ADMINISTRATION_VIEW_FILES)) {
      const lineCount = read(`src/components/portal/workspace/${fileName}`).split("\n").length;
      expect(lineCount).toBeLessThanOrEqual(500);
    }
  });

  test("ratchets PortalWorkspace line count after ticketing and administration extraction", () => {
    expect(lineCount(WORKSPACE_FILE)).toBeLessThanOrEqual(PORTAL_WORKSPACE_LINE_CEILING);
  });
});

describe("portal workspace structural ratchet", () => {
  test("routes every portal view through renderPortalView", () => {
    expect(ALL_PORTAL_VIEW_IDS.length).toBeGreaterThan(20);
    expect(read(REGISTRY_FILE)).toContain("export function renderPortalView");
    expect(read(WORKSPACE_FILE)).toContain(
      "renderPortalView(buildPortalViewRegistryInputs(workspace))"
    );
  });

  test("keeps inline route bodies out of PortalWorkspace", () => {
    const workspace = read(WORKSPACE_FILE);
    expect(workspace).not.toContain("<DashboardView");
    expect(workspace).not.toContain("<PipelineView");
    expect(workspace).not.toContain("<AccountsJobCardView");
    expectFunctionsAbsent(workspace, [
      "AccountsJobCardView",
      "PassengerImportModal",
      "QueryAttachmentsPanel",
    ]);
  });

  test("avoids catch-all Record<string, any> in migrated view contracts", () => {
    const migrated = [
      "src/components/portal/workspace/portalViewTypes.ts",
      "src/components/portal/workspace/portalModalWorkspaceTypes.ts",
      "src/components/portal/workspace/accounts/AccountsJobCardView.tsx",
      "src/components/portal/workspace/modals/portalSpreadsheetModalTypes.ts",
    ];
    for (const file of migrated) {
      const source = read(file);
      expect(source).not.toMatch(CATCH_ALL_RECORD_PATTERN);
    }
  });

  test("ratchets workspace state hook size", () => {
    expect(lineCount(WORKSPACE_STATE_FILE)).toBeLessThanOrEqual(WORKSPACE_STATE_LINE_CEILING);
  });

  test("keeps newly extracted focused modules under 500 lines", () => {
    const focusedModules = [
      "src/components/portal/workspace/accounts/AccountsJobCardView.tsx",
      "src/components/portal/workspace/PortalWorkspaceHeader.tsx",
      "src/components/portal/workspace/TravelBatchEntityModalBridge.tsx",
      "src/components/portal/workspace/modals/PassengerImportModal.tsx",
      "src/components/portal/workspace/modals/FlightImportModal.tsx",
      "src/components/portal/workspace/modals/PassengerExportModal.tsx",
      "src/components/portal/workspace/modals/FlightExportModal.tsx",
      "src/components/portal/workspace/modals/PortalWorkspaceSpreadsheetModals.tsx",
    ];
    for (const file of focusedModules) {
      expect(lineCount(file)).toBeLessThanOrEqual(FOCUSED_MODULE_CEILING);
    }
  });
});
