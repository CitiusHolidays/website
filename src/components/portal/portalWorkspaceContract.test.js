import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE_FILE = "src/components/portal/PortalWorkspace.js";
const WORKSPACE_STATE_FILE = "src/components/portal/usePortalWorkspaceState.js";
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
  if (!match) return new Set();

  return new Set(
    match[1]
      .split("\n")
      .map((line) => line.trim().match(/^([A-Za-z_$][\w$]*)(?:,|:)/)?.[1])
      .filter(Boolean),
  );
}

describe("portal workspace modularization contract", () => {
  test("PortalWorkspace only reads properties returned by usePortalWorkspaceState", () => {
    const workspace = read(WORKSPACE_FILE);
    const usedKeys = new Set([...workspace.matchAll(/\bw\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
    const returnedKeys = workspaceHookReturnKeys();

    const missingKeys = [...usedKeys].filter((key) => !returnedKeys.has(key)).sort();

    expect(missingKeys).toEqual([]);
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
      /if \(w\.view === "dashboard"\)[\s\S]*return w\.error && !w\.modal \?/,
    );
  });

  test("dashboard receives the handlers used by quick actions and period presets", () => {
    const workspace = read(WORKSPACE_FILE);
    const dashboardCall = workspace.match(/<DashboardView[\s\S]*?\/>/)?.[0] || "";

    expect(dashboardCall).toContain("dateRange={w.dateRange}");
    expect(dashboardCall).toContain("setDateRange={w.setDateRangeWithUrl}");
    expect(dashboardCall).toContain("openModal={w.openModal}");
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
});
