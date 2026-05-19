import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PORTAL_PERMISSIONS } from "./constants";
import {
  canAccessPage,
  getAccessibleNavGroups,
  getPermissionsForRoles,
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

  test("sales role only sees enquiry and proposal navigation", () => {
    const pages = pagesForRoles(["Sales"]);

    expect(pages).toEqual(
      expect.arrayContaining(["dashboard", "queries", "pipeline", "proposals", "team"]),
    );
    expect(pages).not.toEqual(expect.arrayContaining(["finance", "ticketing", "contracting", "job-cards"]));
  });

  test("admin can access settings", () => {
    const access = {
      permissions: getPermissionsForRoles(["Admin"]),
    };

    expect(canAccessPage(access, "settings")).toBe(true);
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
