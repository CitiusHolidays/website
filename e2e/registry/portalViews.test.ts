import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPermissionsForRoles } from "../../src/lib/portal/permissions";
import { canAccessPortalRoute, PORTAL_ROUTES } from "../../src/lib/portal/portalRouteManifest";
import { E2E_ROLE_PROFILE_KEYS, loadE2eStaffProfiles } from "../fixtures/staffProfiles";
import {
  mobilePortalTestTitle,
  PORTAL_E2E_COVERED_CELLS,
  PORTAL_E2E_MATRIX,
  PORTAL_E2E_MOBILE_ROLE_SCENARIOS,
  portalE2eDiscoverySummary,
  portalE2eExecutionSummary,
  portalE2ePlannedCells,
} from "./portalViews";

const ROOT = join(import.meta.dir, "../..");

function specFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return specFiles(path);
    }
    return entry.name.endsWith(".spec.ts") ? [path] : [];
  });
}

describe("Staff role/action/view discovery inventory", () => {
  test("tracks every current portal view and seeded Staff profile", () => {
    expect(Object.keys(PORTAL_E2E_MATRIX).sort()).toEqual(Object.keys(PORTAL_ROUTES).sort());

    const profileKeys = loadE2eStaffProfiles().map((profile) => profile.key);
    expect(profileKeys).toEqual([...E2E_ROLE_PROFILE_KEYS]);
    expect(PORTAL_E2E_MOBILE_ROLE_SCENARIOS.map((scenario) => scenario.role).sort()).toEqual(
      [...E2E_ROLE_PROFILE_KEYS].sort()
    );
  });

  test("keeps registered cells unique, planned, role-valid, and route-authorized", () => {
    const planned = portalE2ePlannedCells();
    const plannedIdentities = new Set(
      planned.map((cell) => `${cell.viewId}:${cell.role}:${cell.action}`)
    );
    const registeredIdentities = PORTAL_E2E_COVERED_CELLS.map(
      (cell) => `${cell.viewId}:${cell.role}:${cell.action}`
    );
    expect(new Set(registeredIdentities).size).toBe(registeredIdentities.length);

    const profiles = new Map(loadE2eStaffProfiles().map((profile) => [profile.key, profile]));
    for (const cell of PORTAL_E2E_COVERED_CELLS) {
      expect(
        plannedIdentities.has(`${cell.viewId}:${cell.role}:${cell.action}`),
        registeredIdentities.join(", ")
      ).toBe(true);
      const profile = profiles.get(cell.role);
      expect(profile, `Missing seeded profile ${cell.role}`).toBeDefined();
      const permissions = getPermissionsForRoles(profile?.roles ?? []);
      expect(
        canAccessPortalRoute({
          access: { allowed: true, permissions, roles: profile?.roles ?? [] },
          has: (permission) => permissions.includes(permission),
          view: cell.viewId,
        }),
        `${cell.role} cannot access ${cell.viewId}`
      ).toBe(true);
    }
  });

  test("binds every registered cell to one live stable test title", () => {
    const mobileRoles = new Set(PORTAL_E2E_MOBILE_ROLE_SCENARIOS.map((scenario) => scenario.role));
    for (const cell of PORTAL_E2E_COVERED_CELLS) {
      const path = join(ROOT, cell.spec);
      expect(existsSync(path), cell.spec).toBe(true);
      if (cell.spec.endsWith("mobile-portal-quality.spec.ts")) {
        expect(mobileRoles.has(cell.role)).toBe(true);
        expect(cell.testTitle).toBe(mobilePortalTestTitle(cell.role));
        continue;
      }
      const source = readFileSync(path, "utf8");
      expect(source.split(cell.testTitle).length - 1, `${cell.spec}:${cell.testId}`).toBe(1);
    }
  });

  test("registers every planned action and current profile across all route families", () => {
    expect(portalE2eDiscoverySummary()).toEqual({
      actions: { registered: 15, total: 15 },
      cells: { registered: 22, total: 44 },
      roles: { registered: 12, total: 12 },
      views: { registered: 11, total: 26 },
    });
    expect(
      new Set(PORTAL_E2E_COVERED_CELLS.map((cell) => PORTAL_ROUTES[cell.viewId].family))
    ).toEqual(new Set(["administration", "core", "inbound", "operations", "pilot", "ticketing"]));
  });

  test("counts only selected passing titles as executed interaction evidence", () => {
    expect(portalE2eExecutionSummary([])).toEqual({
      actions: { executed: 0, total: 15 },
      cells: { executed: 0, total: 22 },
      roles: { executed: 0, total: 12 },
      views: { executed: 0, total: 11 },
    });
    expect(
      portalE2eExecutionSummary(["[crm-critical-09] Operations creates and edits traveller"])
    ).toEqual({
      actions: { executed: 2, total: 15 },
      cells: { executed: 2, total: 22 },
      roles: { executed: 1, total: 12 },
      views: { executed: 1, total: 11 },
    });
    expect(
      portalE2eExecutionSummary(PORTAL_E2E_COVERED_CELLS.map((cell) => cell.testTitle))
    ).toEqual({
      actions: { executed: 15, total: 15 },
      cells: { executed: 22, total: 22 },
      roles: { executed: 12, total: 12 },
      views: { executed: 11, total: 11 },
    });
  });

  test("uses the exact case-sensitive Playwright evidence tag vocabulary", () => {
    const recognizedTag = /@(critical|smoke|workflow|performance)\b/gi;
    for (const path of specFiles(join(ROOT, "e2e"))) {
      for (const match of readFileSync(path, "utf8").matchAll(recognizedTag)) {
        expect(match[0], path).toBe(match[0].toLowerCase());
      }
    }
  });
});
