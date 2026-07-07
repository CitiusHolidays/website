import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE_FILE = "src/components/portal/PortalWorkspace.js";
const WORKSPACE_STATE_FILE = "src/components/portal/usePortalWorkspaceState.js";
const WORKSPACE_CONTRACT_FILE = "src/lib/portal/workspaceContract.js";
const DATE_INPUT_FILE = "src/components/portal/PortalDateInput.js";
const FINANCE_FILE = "convex/crm/finance.ts";
const EXPENSE_ATTACHMENT_ACTIONS_FILE = "convex/crm/expenseAttachmentActions.ts";
const ENTITY_MODAL_DIR = "src/components/portal/entityModal";
const LEAVE_FIELDS_FILE = "src/components/portal/entityModal/EntityModalLeaveFields.js";
const STAFF_FIELDS_FILE = "src/components/portal/entityModal/EntityModalStaffFields.js";

function read(file) {
  return readFileSync(file, "utf8");
}

function workspaceHookReturnKeys() {
  const hook = read(WORKSPACE_STATE_FILE);
  const match = hook.match(/\n {2}return \{([\s\S]*?)\n {2}\};\n\}/);
  if (!match) {
    return new Set();
  }

  return new Set(
    match[1]
      .split("\n")
      .map((line) => line.trim().match(/^([A-Za-z_$][\w$]*)(?:,|:)/)?.[1])
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

describe("portal workspace modularization contract", () => {
  test("workspace view metadata and form defaults live in the shared contract", () => {
    const workspace = read(WORKSPACE_FILE);
    const hook = read(WORKSPACE_STATE_FILE);
    const contract = read(WORKSPACE_CONTRACT_FILE);

    expect(contract).toContain("export const VIEW_META");
    expect(contract).toContain("export const INITIAL_FORM");
    expect(contract).toContain("export const SPREADSHEET_MODALS");
    expect(workspace).toContain("@/lib/portal/workspaceContract");
    expect(hook).toContain("@/lib/portal/workspaceContract");
    expect(workspace).not.toMatch(/\bconst VIEW_META\b|\bconst INITIAL_FORM\b/);
    expect(hook).not.toMatch(/\bconst VIEW_META\b|\bconst INITIAL_FORM\b/);
  });

  test("PortalWorkspace only reads properties returned by usePortalWorkspaceState", () => {
    const workspace = read(WORKSPACE_FILE);
    const usedKeys = new Set([...workspace.matchAll(/\bw\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
    const returnedKeys = workspaceHookReturnKeys();

    const missingKeys = [...usedKeys].filter((key) => !returnedKeys.has(key)).sort();

    expect(missingKeys).toEqual([]);
  });

  test("All Sales Query delete actions use the existing confirmation flow with the row id", () => {
    const workspace = read(WORKSPACE_FILE);
    const deleteCalls =
      workspace.match(/deleteItem\(row\.queryCode, removeQuery, \{ queryId: row\.id \}\)/g) ?? [];

    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    expect(workspace).not.toContain(
      "deleteItem(row.queryCode, removeQuery, { queryId: row.queryCode })"
    );
  });

  test("list views use compact toolbar instead of legacy page header", () => {
    const workspace = read(WORKSPACE_FILE);

    expect(workspace).toContain("PortalListToolbar");
    expect(workspace).not.toContain("SavedViewsBar");
    expect(workspace).not.toContain("text-3xl md:text-4xl");
    expect(workspace).not.toContain("function PageHeader");
    expect(workspace).not.toContain("function DashboardQueryTypeBreakdown");
  });

  test("dashboard skips duplicate workspace header band", () => {
    const workspace = read(WORKSPACE_FILE);
    const headerBlock = workspace.match(/function PortalWorkspaceHeader[\s\S]*?^}/m)?.[0] || "";

    expect(headerBlock).toMatch(
      /if \(w\.view === "dashboard"\)[\s\S]*return w\.error && !w\.modal \?/
    );
  });

  test("dashboard receives the handlers used by quick actions and period presets", () => {
    const workspace = read(WORKSPACE_FILE);
    const dashboardCall = workspace.match(/<DashboardView[\s\S]*?\/>/)?.[0] || "";

    expect(dashboardCall).toContain("dateRange={w.dateRange}");
    expect(dashboardCall).toContain("setDateRange={w.setDateRangeWithUrl}");
    expect(dashboardCall).toContain("openModal={w.openModal}");
  });

  test("table-backed views pass rows to their table component", () => {
    const workspace = read(WORKSPACE_FILE);
    const contracts = [
      ["QueriesView", "DataTable", "rows={rows}"],
      ["ProposalsView", "DataTable", "rows={rows}"],
      ["AccountsJobCardView", "DataTable", "rows={creators}"],
      ["JobCardsView", "SelectableDataTable", "rows={rows}"],
      ["ExpensesView", "DataTable", "rows={rows}"],
      ["ApprovalsView", "DataTable", "rows={rows}"],
      ["LeaveView", "DataTable", "rows={rows}"],
    ];

    for (const [viewName, tableComponent, rowsProp] of contracts) {
      const block = functionBlock(workspace, viewName);

      expect(block).toContain(`<${tableComponent}`);
      expect(block).toContain(rowsProp);
    }
  });

  test("extracted entity modal files import the portal permission alias when they use it", () => {
    const offenders = readdirSync(ENTITY_MODAL_DIR)
      .filter((file) => file.endsWith(".js"))
      .map((file) => join(ENTITY_MODAL_DIR, file))
      .filter((file) => {
        const source = read(file);
        return (
          /\bP\./.test(source) &&
          !/PORTAL_PERMISSIONS as P|const P = PORTAL_PERMISSIONS/.test(source)
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
    const workspace = read(WORKSPACE_FILE);
    const finance = read(FINANCE_FILE);
    const attachmentActions = read(EXPENSE_ATTACHMENT_ACTIONS_FILE);

    expect(workspace).toContain('expenses: has(P.CREATE_EXPENSES) && ["expense", "Add Expense"]');
    expect(finance).toContain("requireStaff(ctx, PERMISSIONS.CREATE_EXPENSES)");
    expect(attachmentActions).toContain("PERMISSIONS.CREATE_EXPENSES");
    expect(attachmentActions).toContain("verifyExpenseProofMutationAccess");
  });

  test("settings staff workbook flow wires parser and Convex preview/apply APIs", () => {
    const workspace = read(WORKSPACE_FILE);
    const panel = read("src/components/portal/settings/StaffWorkbookImportPanel.js");

    expect(workspace).toContain("StaffWorkbookImportPanel");
    expect(panel).toContain("parseStaffWorkbookFile");
    expect(panel).toContain("api.crm.staffWorkbookUpdates.previewStaffWorkbookUpdates");
    expect(panel).toContain("api.crm.staffWorkbookUpdates.applyStaffWorkbookUpdates");
    expect(panel).not.toContain("Sync leave approvers from matrix");
  });

  test("leave modal shows balances and staff modal hides deferred policy fields", () => {
    const workspace = read(WORKSPACE_FILE);
    const leaveCall = workspace.match(/<LeaveView[\s\S]*?\/>/)?.[0] || "";
    const modalCall = workspace.match(/<EntityModal[\s\S]*?\/>/)?.[0] || "";
    const leaveFields = read(LEAVE_FIELDS_FILE);
    const staffFields = read(STAFF_FIELDS_FILE);

    expect(leaveCall).toContain("leaveBalances={w.leaveBalances}");
    expect(modalCall).toContain("leaveBalances={w.leaveBalances}");
    expect(leaveFields).toContain("Leave balances");
    expect(leaveFields).toContain("availableDays");
    expect(leaveFields).toContain("No balance limit");
    expect(staffFields).not.toContain('label="Joining Date"');
    expect(staffFields).not.toContain('label="Employment Status"');
  });

  test("leave view exposes final-authority approve via canApproveFinal and Approved decision", () => {
    const workspace = read(WORKSPACE_FILE);
    const leaveView =
      workspace.match(/function LeaveView\([\s\S]*?\nfunction SettingsView/)?.[0] || "";

    expect(leaveView).toContain("row.canApproveHead");
    expect(leaveView).toContain("row.canApproveHr");
    expect(leaveView).toContain("row.canApproveFinal");
    expect(leaveView).toMatch(
      /row\.canApproveFinal[\s\S]*?handleLeaveDecision\(row\.id, "Approved"\)/
    );
    expect(leaveView).toContain("Approve (Final Authority)");
  });

  test("job cards view exposes travel batches and Convex travel batch mutations", () => {
    const workspace = read(WORKSPACE_FILE);
    const contract = read(WORKSPACE_CONTRACT_FILE);
    const executor = read("src/lib/portal/modalCommandExecutor.js");
    const primaryFields = read("src/components/portal/entityModal/EntityModalFieldsPrimary.js");
    const jobCardsView =
      workspace.match(/function JobCardsView\([\s\S]*?\nfunction JobCardRowActions/)?.[0] || "";

    expect(contract).toContain("export const TRAVEL_BATCH_MODAL");
    expect(contract).toContain("buildTravelBatchModalInitial");
    expect(contract).toContain("formatTravelBatchOwnerSummary");
    expect(workspace).toContain("JobCardTravelBatchesCell");
    expect(workspace).toContain("travelBatches");
    expect(workspace).toContain("api.crm.jobCards.createTravelBatch");
    expect(workspace).toContain("api.crm.jobCards.updateTravelBatch");
    expect(primaryFields).toContain("EntityModalTravelBatchFields");
    expect(executor).toContain('modal === "travelBatch"');
    expect(jobCardsView).toContain("Travel Batches");
    expect(workspace).toContain("Add Travel Batch");
  });
});
