import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE_FILE = "src/components/portal/PortalWorkspace.js";
const WORKSPACE_STATE_FILE = "src/components/portal/usePortalWorkspaceState.js";
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

  test("leave modal shows balances and staff modal hides deferred policy fields", () => {
    const leaveFields = read(LEAVE_FIELDS_FILE);
    const staffFields = read(STAFF_FIELDS_FILE);

    expect(leaveFields).toContain("Leave balances");
    expect(leaveFields).toContain("availableDays");
    expect(staffFields).not.toContain('label="Joining Date"');
    expect(staffFields).not.toContain('label="Employment Status"');
  });
});
