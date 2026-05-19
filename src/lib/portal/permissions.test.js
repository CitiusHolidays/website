import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS } from "./constants";
import {
  canAccessPage,
  getAccessibleNavGroups,
  getPermissionsForRoles,
  normalizeEmail,
} from "./permissions";

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
    expect(
      getAccessibleNavGroups(access)
        .flatMap((group) => group.items)
        .map((item) => item.page),
    ).not.toContain("settings");
  });

  test("admin can access settings", () => {
    const access = {
      permissions: getPermissionsForRoles(["Admin"]),
    };

    expect(canAccessPage(access, "settings")).toBe(true);
  });
});
