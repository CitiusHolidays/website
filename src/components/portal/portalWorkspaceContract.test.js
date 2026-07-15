import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { getFilterDateRangeError } from "@/lib/portal/periodFilter";
import { buildPortalWorkspaceRows } from "./workspace/portalWorkspaceRows";

const WORKSPACE_FILE = "src/components/portal/PortalWorkspace.tsx";
const WORKSPACE_HEADER_FILE = "src/components/portal/workspace/PortalWorkspaceHeader.tsx";
const REGISTRY_FILE = "src/components/portal/workspace/portalViewRegistry.tsx";
const TRAVEL_BATCH_BRIDGE_FILE = "src/components/portal/workspace/TravelBatchEntityModalBridge.tsx";
const WORKSPACE_STATE_FILE = "src/components/portal/usePortalWorkspaceState.ts";
const WORKSPACE_CONTRACT_FILE = "src/lib/portal/workspaceContract.ts";
const DATE_INPUT_FILE = "src/components/portal/PortalDateInput.js";
const EXPENSE_COMMANDS_FILE = "convex/crm/expenseCommands.ts";
const EXPENSE_ATTACHMENT_ACTIONS_FILE = "convex/crm/expenseAttachmentActions.ts";
const ENTITY_MODAL_DIR = "src/components/portal/entityModal";
const LEAVE_FIELDS_FILE = "src/components/portal/entityModal/EntityModalLeaveFields.js";
const STAFF_FIELDS_FILE = "src/components/portal/entityModal/EntityModalStaffFields.js";
const GRID_CONTRACT_FILE = "src/lib/portal/portalDataGrid.ts";
const DASHBOARD_OPERATIONAL_TABLE_FILES = [
  "src/components/portal/dashboard/DashboardFinanceOverdue.js",
  "src/components/portal/dashboard/DashboardPipelineSnapshot.js",
  "src/components/portal/dashboard/DashboardWorkQueue.js",
];
const HOOK_RETURN_PATTERN = /\n {2}return \{([\s\S]*?)\n {2}\};\n\}/;
const HOOK_RETURN_KEY_PATTERN = /^([A-Za-z_$][\w$]*)(?:,|:)/;
const WORKSPACE_META_CONSTANT_PATTERN = /\bconst VIEW_META\b|\bconst INITIAL_FORM\b/;
const DASHBOARD_HEADER_PATTERN =
  /if \(workspace\.view === "dashboard"\)[\s\S]*return workspace\.error && !workspace\.modal \?/;
const DASHBOARD_VIEW_PATTERN = /<DashboardView[\s\S]*?\/>/;
const PERMISSION_ALIAS_USE_PATTERN = /\bP\./;
const PERMISSION_ALIAS_DEFINITION_PATTERN = /PORTAL_PERMISSIONS as P|const P = PORTAL_PERMISSIONS/;
const ENTITY_MODAL_PATTERN = /<EntityModal[\s\S]*?\/>/;
const LEAVE_FINAL_APPROVAL_PATTERN =
  /row\.canApproveFinal[\s\S]*?handleLeaveDecision\(row\.id, "Approved"\)/;

function read(file) {
  return readFileSync(file, "utf8");
}

function workspaceHookReturnKeys() {
  const hook = read(WORKSPACE_STATE_FILE);
  const match = hook.match(HOOK_RETURN_PATTERN);
  if (!match) {
    return new Set();
  }

  return new Set(
    match[1]
      .split("\n")
      .map((line) => line.trim().match(HOOK_RETURN_KEY_PATTERN)?.[1])
      .filter(Boolean)
  );
}

function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) {
    return "";
  }
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function workspaceRowsInput(overrides = {}) {
  return {
    activity: [],
    approvals: [],
    dateRange: { from: null, to: null },
    expenses: [],
    flightItinerary: [],
    hotels: [],
    invoices: [],
    jobCardFilter: "",
    jobCards: [],
    leaves: [],
    listFilterConfig: [],
    listFilters: {},
    notifications: [],
    pnrs: [],
    proposals: [],
    queries: [],
    search: "",
    seats: [],
    staff: [],
    team: [],
    tickets: [],
    tourManagers: [],
    travellersWithPassportExpiry: [],
    view: "queries",
    visas: [],
    ...overrides,
  };
}

describe("portal workspace modularization contract", () => {
  test("workspace view metadata and form defaults live in the shared contract", () => {
    const workspace = read(WORKSPACE_FILE);
    const hook = read(WORKSPACE_STATE_FILE);
    const contract = read(WORKSPACE_CONTRACT_FILE);

    expect(contract).toContain("export const VIEW_META");
    expect(contract).toContain("export const INITIAL_FORM");
    expect(contract).toContain("export const SPREADSHEET_MODALS");
    expect(hook).toContain("@/lib/portal/workspaceContract");
    expect(workspace).not.toMatch(WORKSPACE_META_CONSTANT_PATTERN);
    expect(hook).not.toMatch(WORKSPACE_META_CONSTANT_PATTERN);
  });

  test("PortalWorkspace only reads properties returned by usePortalWorkspaceState", () => {
    const workspace = read(WORKSPACE_FILE);
    const usedKeys = new Set(
      [...workspace.matchAll(/\bworkspace\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
    );
    const returnedKeys = workspaceHookReturnKeys();

    const missingKeys = [...usedKeys].filter((key) => !returnedKeys.has(key)).sort();

    expect(missingKeys).toEqual([]);
  });

  test("All Sales Query delete actions use the existing confirmation flow with the row id", () => {
    const queriesView = read("src/components/portal/workspace/QueriesView.tsx");
    const deleteCalls =
      queriesView.match(
        /deleteItem\(row\.queryCode \?\? "", removeQuery, \{ queryId: String\(row\.id\) \}\)/g
      ) ?? [];

    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    expect(queriesView).not.toContain(
      'deleteItem(row.queryCode ?? "", removeQuery, { queryId: row.queryCode })'
    );
  });

  test("list views use compact toolbar instead of legacy page header", () => {
    const header = read(WORKSPACE_HEADER_FILE);

    expect(header).toContain("PortalListToolbar");
    expect(header).not.toContain("SavedViewsBar");
    expect(header).not.toContain("text-3xl md:text-4xl");
    expect(header).not.toContain("function PageHeader");
    expect(read(WORKSPACE_FILE)).not.toContain("function DashboardQueryTypeBreakdown");
  });

  test("dashboard skips duplicate workspace header band", () => {
    const headerBlock = read(WORKSPACE_HEADER_FILE);

    expect(headerBlock).toMatch(DASHBOARD_HEADER_PATTERN);
  });

  test("dashboard receives the handlers used by quick actions and period presets", () => {
    const registry = read(REGISTRY_FILE);
    const dashboardCall = registry.match(DASHBOARD_VIEW_PATTERN)?.[0] || "";

    expect(dashboardCall).toContain("dateRange={workspace.dateRange}");
    expect(dashboardCall).toContain("setDateRange={workspace.setDateRangeWithUrl}");
    expect(dashboardCall).toContain("openModal={workspace.openModal}");
  });

  test("table-backed views pass rows to their table component", () => {
    const workspace = read(WORKSPACE_FILE);
    const contracts = [
      ["src/components/portal/workspace/QueriesView.tsx", "QueriesView", "rows={rows}"],
      ["src/components/portal/workspace/ProposalsView.tsx", "ProposalsView", "rows={rows}"],
      [
        "src/components/portal/workspace/operations/JobCardsView.tsx",
        "JobCardsView",
        "rows={rows}",
      ],
      [
        "src/components/portal/workspace/accounts/AccountsJobCardView.tsx",
        "AccountsJobCardView",
        "rows={creators}",
      ],
      ["src/components/portal/workspace/admin/ExpensesView.tsx", "ExpensesView", "rows={rows}"],
      ["src/components/portal/workspace/admin/ApprovalsView.tsx", "ApprovalsView", "rows={rows}"],
      ["src/components/portal/workspace/admin/LeaveView.tsx", "LeaveView", "rows={rows}"],
    ];

    for (const [file, viewName, rowsProp] of contracts) {
      const source = read(file);
      const block = functionBlock(source, viewName);

      expect(block).toContain("<SelectableDataTable");
      expect(block).toContain(rowsProp);
    }

    expect(workspace).toContain("renderPortalView");
    expect(read(REGISTRY_FILE)).toContain("renderPilotPortalView");
    expect(read(REGISTRY_FILE)).toContain("renderOperationsPortalView");
    expect(read(REGISTRY_FILE)).toContain("renderTicketingPortalView");
    expect(read(REGISTRY_FILE)).toContain("renderAdministrationPortalView");
  });

  test("CRM tables use typed columns and one shared table renderer", () => {
    const workspace = read(WORKSPACE_FILE);

    expect(read(GRID_CONTRACT_FILE)).not.toContain("LegacyPortalGridColumn");
    expect(workspace).not.toContain("function PipelineView");
    expect(read(REGISTRY_FILE)).toContain("@/components/portal/pipeline/PipelineView");
    for (const file of DASHBOARD_OPERATIONAL_TABLE_FILES) {
      const source = read(file);
      expect(source).not.toContain("<table");
      expect(source).toContain("<SelectableDataTable");
    }
  });

  test("extracted entity modal files import the portal permission alias when they use it", () => {
    const offenders = readdirSync(ENTITY_MODAL_DIR)
      .filter((file) => file.endsWith(".js"))
      .map((file) => join(ENTITY_MODAL_DIR, file))
      .filter((file) => {
        const source = read(file);
        return (
          PERMISSION_ALIAS_USE_PATTERN.test(source) &&
          !PERMISSION_ALIAS_DEFINITION_PATTERN.test(source)
        );
      });

    expect(offenders).toEqual([]);
  });

  test("portal date input keeps manual entry and exposes a native calendar picker", () => {
    const dateInput = read(DATE_INPUT_FILE);

    expect(dateInput).toContain('type="text"');
    expect(dateInput).toContain('type="date"');
    expect(dateInput).toContain("displayDateFromIsoDay");
    expect(dateInput).toContain("isoDayFromDisplayDate");
  });

  test("expense creation is available without broad expense management", () => {
    const header = read(WORKSPACE_HEADER_FILE);
    const expenseCommands = read(EXPENSE_COMMANDS_FILE);
    const attachmentActions = read(EXPENSE_ATTACHMENT_ACTIONS_FILE);

    expect(header).toContain('expenses: has(P.CREATE_EXPENSES) && ["expense", "Add Expense"]');
    expect(expenseCommands).toContain("requireStaff(ctx, PERMISSIONS.CREATE_EXPENSES)");
    expect(attachmentActions).toContain("PERMISSIONS.CREATE_EXPENSES");
    expect(attachmentActions).toContain("verifyExpenseProofMutationAccess");
  });

  test("settings staff workbook flow wires parser and Convex preview/apply APIs", () => {
    const settingsView = read("src/components/portal/workspace/admin/SettingsView.tsx");
    const panel = read("src/components/portal/settings/StaffWorkbookImportPanel.js");

    expect(settingsView).toContain("StaffWorkbookImportPanel");
    expect(panel).toContain("parseStaffWorkbookFile");
    expect(panel).toContain("api.crm.staffWorkbookUpdates.previewStaffWorkbookUpdates");
    expect(panel).toContain("api.crm.staffWorkbookUpdates.applyStaffWorkbookUpdates");
    expect(panel).not.toContain("Sync leave approvers from matrix");
  });

  test("leave modal shows balances and staff modal hides deferred policy fields", () => {
    const travelBatchBridge = read(TRAVEL_BATCH_BRIDGE_FILE);
    const modalCall = travelBatchBridge.match(ENTITY_MODAL_PATTERN)?.[0] || "";
    const leaveFields = read(LEAVE_FIELDS_FILE);
    const staffFields = read(STAFF_FIELDS_FILE);

    expect(modalCall).toContain("leaveBalances={workspace.leaveBalances}");
    expect(leaveFields).toContain("Leave balances");
    expect(leaveFields).toContain("availableDays");
    expect(leaveFields).toContain("No balance limit");
    expect(staffFields).not.toContain('label="Joining Date"');
    expect(staffFields).not.toContain('label="Employment Status"');
  });

  test("leave view exposes final-authority approve via canApproveFinal and Approved decision", () => {
    const leaveView = read("src/components/portal/workspace/admin/LeaveView.tsx");

    expect(leaveView).toContain("row.canApproveHead");
    expect(leaveView).toContain("row.canApproveHr");
    expect(leaveView).toContain("row.canApproveFinal");
    expect(leaveView).toMatch(LEAVE_FINAL_APPROVAL_PATTERN);
    expect(leaveView).toContain("Approve (Final Authority)");
  });

  test("job cards view exposes travel batches and Convex travel batch mutations", () => {
    const travelBatchBridge = read(TRAVEL_BATCH_BRIDGE_FILE);
    const jobCardActions = read(
      "src/components/portal/workspace/operations/JobCardTravelBatchesCell.tsx"
    );
    const jobCardRowActions = read(
      "src/components/portal/workspace/operations/JobCardRowActions.tsx"
    );
    const jobCardsView = read("src/components/portal/workspace/operations/JobCardsView.tsx");
    const contract = read(WORKSPACE_CONTRACT_FILE);
    const executor = read("src/lib/portal/modalCommandExecutor.js");
    const primaryFields = read("src/components/portal/entityModal/EntityModalFieldsPrimary.js");

    expect(contract).toContain("export const TRAVEL_BATCH_MODAL");
    expect(contract).toContain("buildTravelBatchModalInitial");
    expect(contract).toContain("formatTravelBatchOwnerSummary");
    expect(jobCardsView).toContain("JobCardTravelBatchesCell");
    expect(jobCardActions).toContain("api.crm.jobCards.listTravelBatches");
    expect(jobCardActions).toContain("usePaginatedQuery");
    expect(jobCardActions).toContain("Load more Travel Batches");
    expect(travelBatchBridge).toContain("api.crm.jobCards.createTravelBatch");
    expect(travelBatchBridge).toContain("api.crm.jobCards.updateTravelBatch");
    expect(primaryFields).toContain("EntityModalTravelBatchFields");
    expect(executor).toContain('modal === "travelBatch"');
    expect(jobCardsView).toContain("Travel Batches");
    expect(jobCardRowActions).toContain("Add Travel Batch");
  });

  test("workspace row builder filters query rows by date range, status filters, and search", () => {
    const rows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        listFilterConfig: getListFilterConfig("queries"),
        listFilters: { queryType: "Corporate" },
        queries: [
          {
            _creationTime: 1,
            _id: "queries_1",
            clientName: "Acme Industries",
            createdAt: "2026-01-10",
            destination: "Delhi",
            queryCode: "Q-001",
            queryType: "Corporate",
            salesOwnerName: "Nisha",
          },
          {
            _creationTime: 2,
            _id: "queries_2",
            clientName: "Pilgrim Group",
            createdAt: "2026-01-12",
            destination: "Varanasi",
            queryCode: "Q-002",
            queryType: "Pilgrimage",
            salesOwnerName: "Raj",
          },
          {
            _creationTime: 3,
            _id: "queries_3",
            clientName: "Acme Old",
            createdAt: "2025-12-31",
            destination: "Mumbai",
            queryCode: "Q-003",
            queryType: "Corporate",
            salesOwnerName: "Nisha",
          },
        ],
        search: "acme",
        view: "queries",
      })
    );

    expect(rows.filteredQueries.map((row) => row.queryCode)).toEqual(["Q-001"]);
    expect(rows.viewResultCount).toBe(1);
  });

  test("workspace row builder preserves proposal and job-card list contracts", () => {
    const proposalRows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        listFilterConfig: getListFilterConfig("proposals"),
        listFilters: { status: "Draft" },
        proposals: [
          {
            _creationTime: 1,
            _id: "proposals_1",
            clientName: "Acme Industries",
            createdAt: "2026-02-01",
            preparedBy: "Nisha",
            proposalCode: "P-001",
            status: "Draft",
          },
          {
            _creationTime: 2,
            _id: "proposals_2",
            clientName: "Acme Industries",
            createdAt: "2026-02-01",
            preparedBy: "Nisha",
            proposalCode: "P-002",
            status: "Sent",
          },
        ],
        search: "P-001",
        view: "proposals",
      })
    );
    const jobCardRows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        jobCards: [
          {
            _creationTime: 1,
            _id: "jobCards_1",
            clientName: "Acme Industries",
            createdAt: "2026-02-01",
            destination: "Delhi",
            jobCode: "JC-001",
            status: "Active",
          },
          {
            _creationTime: 2,
            _id: "jobCards_2",
            clientName: "Beta Industries",
            createdAt: "2026-02-01",
            destination: "Goa",
            jobCode: "JC-002",
            status: "Closed",
          },
        ],
        listFilterConfig: getListFilterConfig("job-cards"),
        listFilters: { status: "Active" },
        search: "acme",
        view: "job-cards",
      })
    );

    expect(proposalRows.filteredProposals.map((row) => row.proposalCode)).toEqual(["P-001"]);
    expect(jobCardRows.filteredJobCards.map((row) => row.jobCode)).toEqual(["JC-001"]);
  });

  test("inverted workspace date ranges surface an error and skip filtering without swapping", () => {
    const dateRange = { from: "2026-03-31", to: "2026-03-01" };
    const rows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        dateRange,
        queries: [
          {
            _creationTime: 1,
            _id: "queries_1",
            clientName: "Before",
            createdAt: "2026-02-01",
            queryCode: "Q-001",
          },
          {
            _creationTime: 2,
            _id: "queries_2",
            clientName: "After",
            createdAt: "2026-04-01",
            queryCode: "Q-002",
          },
        ],
        view: "queries",
      })
    );

    expect(getFilterDateRangeError(dateRange)).toBe("From must be on or before To.");
    expect(rows.filteredQueries.map((row) => row.queryCode)).toEqual(["Q-001", "Q-002"]);
  });
});
