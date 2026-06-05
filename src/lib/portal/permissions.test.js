import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTAL_PERMISSIONS } from "./constants";
import {
  canAccessPage,
  canAccessPipeline,
  canAssignQueryTicketing,
  getAccessibleNavGroups,
  getPermissionsForRoles,
  getQueryTypeOptions,
  isCementScopedUser,
  normalizeEmail,
} from "./permissions";

const roleExpectations = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../tools/portal-role-pages-expected.json"),
    "utf8",
  ),
);

function pagesForRoles(roles) {
  return getAccessibleNavGroups({ permissions: getPermissionsForRoles(roles) })
    .flatMap((group) => group.items)
    .map((item) => item.page);
}

describe("portal permissions", () => {
  test("normalizes staff email addresses", () => {
    expect(normalizeEmail("  Sales@CitiusHolidays.com ")).toBe("sales@citiusholidays.com");
  });

  test("combines permissions across multiple roles without duplicates", () => {
    const permissions = getPermissionsForRoles(["Sales", "Ticketing"]);

    expect(permissions).toContain(PORTAL_PERMISSIONS.VIEW_QUERIES);
    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_TICKETING);
    expect(new Set(permissions).size).toBe(permissions.length);
  });

  test("restricts navigation based on role permissions", () => {
    const access = {
      permissions: getPermissionsForRoles(["Sales"]),
    };

    expect(canAccessPage(access, "queries")).toBe(true);
    expect(canAccessPage(access, "finance")).toBe(false);
    expect(canAccessPage(access, "contracting")).toBe(false);
    expect(canAccessPage(access, "ticketing")).toBe(false);
    expect(
      getAccessibleNavGroups(access)
        .flatMap((group) => group.items)
        .map((item) => item.page),
    ).not.toContain("settings");
  });

  test("pipeline is limited to sales and contracting workflows", () => {
    const salesAccess = { permissions: getPermissionsForRoles(["Sales"]) };
    const ticketingAccess = { permissions: getPermissionsForRoles(["Ticketing"]) };

    expect(canAccessPipeline(salesAccess)).toBe(true);
    expect(canAccessPipeline(ticketingAccess)).toBe(false);
  });

  test("query ticketing assignment is limited to admin and head of ticketing", () => {
    expect(canAssignQueryTicketing({ roles: ["Admin"] })).toBe(true);
    expect(canAssignQueryTicketing({ roles: ["Head of Ticketing"] })).toBe(true);
    expect(canAssignQueryTicketing({ roles: ["Contracting Head"] })).toBe(false);
    expect(canAssignQueryTicketing({ roles: ["Operations Head"] })).toBe(false);
  });

  test("ticketing role sees enquiry and proposal navigation for assigned work", () => {
    const pages = pagesForRoles(["Ticketing"]);

    expect(pages).toEqual(
      expect.arrayContaining([
        "dashboard",
        "queries",
        "proposals",
        "ticketing",
        "employees-on-leave",
      ]),
    );
    expect(pages).not.toEqual(
      expect.arrayContaining(["pipeline", "contracting", "finance", "team"]),
    );
  });

  test("sales role only sees enquiry and proposal navigation", () => {
    const pages = pagesForRoles(["Sales"]);

    expect(pages).toEqual(
      expect.arrayContaining([
        "dashboard",
        "queries",
        "pipeline",
        "proposals",
        "employees-on-leave",
      ]),
    );
    expect(pages).not.toEqual(
      expect.arrayContaining(["finance", "ticketing", "contracting", "job-cards", "team"]),
    );
  });

  test("hr can manage leave without staff settings access", () => {
    const permissions = getPermissionsForRoles(["HR"]);
    const pages = pagesForRoles(["HR"]);

    expect(permissions).toContain(PORTAL_PERMISSIONS.VIEW_LEAVE);
    expect(permissions).toContain(PORTAL_PERMISSIONS.APPROVE_LEAVE);
    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_LEAVE);
    expect(permissions).not.toContain(PORTAL_PERMISSIONS.MANAGE_STAFF);
    expect(pages).toEqual(expect.arrayContaining(["dashboard", "employees-on-leave"]));
    expect(pages).not.toContain("settings");
  });

  test("team directory is limited to admin directors hr and heads", () => {
    expect(pagesForRoles(["Sales"])).not.toContain("team");
    expect(pagesForRoles(["Contracting"])).not.toContain("team");
    expect(pagesForRoles(["Contracting Head"])).toContain("team");
    expect(pagesForRoles(["HR"])).toContain("team");
    expect(pagesForRoles(["Admin"])).toContain("team");
  });

  test("admin can access settings", () => {
    const access = {
      permissions: getPermissionsForRoles(["Admin"]),
    };

    expect(canAccessPage(access, "settings")).toBe(true);
  });

  test("activity log nav is admin-only", () => {
    expect(pagesForRoles(["Admin"])).toContain("activity");
    expect(pagesForRoles(["Sales Head"])).not.toContain("activity");
    expect(pagesForRoles(["Finance"])).not.toContain("activity");
    expect(pagesForRoles(["Operations Head"])).not.toContain("activity");
  });

  test("cement roles only get cement query type options", () => {
    const cementAccess = {
      roles: ["Sales Cement"],
      permissions: getPermissionsForRoles(["Sales Cement"]),
    };
    expect(isCementScopedUser(cementAccess)).toBe(true);
    expect(getQueryTypeOptions(cementAccess)).toEqual(["Cement", "Cement Bidding"]);
    expect(
      isCementScopedUser({ roles: ["Admin"], permissions: getPermissionsForRoles(["Admin"]) }),
    ).toBe(false);
  });

  for (const [role, { allowed, denied }] of Object.entries(roleExpectations)) {
    test(`${role} nav matches Activity Flow / portal-crm-spec`, () => {
      const pages = pagesForRoles([role]);
      for (const page of allowed) {
        expect(pages, `${role} should include ${page}`).toContain(page);
      }
      for (const page of denied) {
        expect(pages, `${role} should not include ${page}`).not.toContain(page);
      }
    });
  }
});
