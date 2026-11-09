import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTAL_PERMISSIONS } from "./constants";
import {
  canAccessPage,
  canAccessPipeline,
  canAssignContracting,
  canAssignQueryTicketing,
  canCreateJobCardFromAccounts,
  canManageJobCardCreatorAccess,
  canUseTeamPicker,
  canViewFieldPassportAccessLog,
  canViewPassportExpiryInWorkspace,
  canViewPassportScansInWorkspace,
  getAccessibleNavGroups,
  getPermissionsForRoles,
  getQueryTypeOptions,
  isCementScopedUser,
  isDirectorOrAdmin,
  isExternalTourManager,
  normalizeEmail,
  portalHomeHref,
} from "./permissions";
import { canAccessPortalRoute } from "./portalRouteManifest";

const roleExpectations = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../tools/portal-role-pages-expected.json"),
    "utf8"
  )
);

function pagesForRoles(roles) {
  return getAccessibleNavGroups({
    allowed: true,
    permissions: getPermissionsForRoles(roles),
    roles,
  })
    .flatMap((group) => group.items)
    .map((item) => item.page);
}

describe("Portal permissions", () => {
  test("Normalizes staff email addresses", () => {
    expect(normalizeEmail("  Sales@CitiusHolidays.com ")).toBe("sales@citiusholidays.com");
  });

  test("Combines permissions across multiple roles without duplicates", () => {
    const permissions = getPermissionsForRoles(["Sales", "Ticketing"]);

    expect(permissions).toContain(PORTAL_PERMISSIONS.VIEW_QUERIES);
    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_TICKETING);
    expect(permissions).toContain(PORTAL_PERMISSIONS.CREATE_EXPENSES);
    expect(new Set(permissions).size).toBe(permissions.length);
  });

  test("Every staff role can create expenses without broad expense management access", () => {
    for (const role of Object.keys(roleExpectations)) {
      const permissions = getPermissionsForRoles([role]);

      expect(permissions, `${role} should create expenses`).toContain(
        PORTAL_PERMISSIONS.CREATE_EXPENSES
      );
    }

    expect(getPermissionsForRoles(["Sales"])).not.toContain(PORTAL_PERMISSIONS.MANAGE_EXPENSES);
  });

  test("Restricts navigation based on role permissions", () => {
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
        .map((item) => item.page)
    ).not.toContain("settings");
  });

  test("Pipeline is limited to sales and contracting workflows", () => {
    const salesAccess = { permissions: getPermissionsForRoles(["Sales"]) };
    const ticketingAccess = { permissions: getPermissionsForRoles(["Ticketing"]) };

    expect(canAccessPipeline(salesAccess)).toBe(true);
    expect(canAccessPipeline(ticketingAccess)).toBe(false);
  });

  test("Query ticketing assignment is limited to admin, directors, and head of ticketing", () => {
    expect(canAssignQueryTicketing({ roles: ["Admin"] })).toBe(true);
    expect(canAssignQueryTicketing({ roles: ["Directors"] })).toBe(true);
    expect(canAssignQueryTicketing({ roles: ["Head of Ticketing"] })).toBe(true);
    expect(canAssignQueryTicketing({ roles: ["Contracting Head"] })).toBe(false);
    expect(canAssignQueryTicketing({ roles: ["Operations Head"] })).toBe(false);
  });

  test("Directors receive full admin permissions", () => {
    const permissions = getPermissionsForRoles(["Directors"]);

    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_QUERIES);
    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_STAFF);
    expect(permissions).toContain(PORTAL_PERMISSIONS.VIEW_ACTIVITY);
    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_DROPDOWNS);
  });

  test("Sales can load team picker options for contracting spoc dropdowns", () => {
    const access = {
      permissions: getPermissionsForRoles(["Sales"]),
      roles: ["Sales"],
    };

    expect(canUseTeamPicker(access)).toBe(true);
    expect(isDirectorOrAdmin(access)).toBe(false);
    expect(canAssignContracting(access)).toBe(false);
  });

  test("Directors can assign contracting and ticketing teams", () => {
    expect(canAssignContracting({ roles: ["Directors"] })).toBe(true);
    expect(canAssignQueryTicketing({ roles: ["Directors"] })).toBe(true);
    expect(isDirectorOrAdmin({ roles: ["Director Cement"] })).toBe(true);
  });

  test("Job card creation is available to accounts team plus admin and director overrides", () => {
    const legacyCreators = [{ id: "staff_accounts", jobCardCreatorEnabled: true }];

    expect(canManageJobCardCreatorAccess({ roles: ["Accounts Head"] })).toBe(true);
    expect(canManageJobCardCreatorAccess({ roles: ["Accounts"] })).toBe(false);
    expect(canCreateJobCardFromAccounts({ roles: ["Directors"] }, [])).toBe(true);
    expect(canCreateJobCardFromAccounts({ roles: ["Admin"] }, [])).toBe(true);
    expect(canCreateJobCardFromAccounts({ roles: ["Accounts Head"] }, [])).toBe(true);
    expect(
      canCreateJobCardFromAccounts(
        { roles: ["Accounts"], staffId: "staff_accounts" },
        legacyCreators
      )
    ).toBe(true);
    expect(
      canCreateJobCardFromAccounts({ roles: ["Accounts"], staffId: "staff_other" }, legacyCreators)
    ).toBe(true);
    expect(
      canCreateJobCardFromAccounts({ roles: ["Sales"], staffId: "staff_accounts" }, legacyCreators)
    ).toBe(false);
  });

  test("Legacy job card creators list does not grant Sales users access", () => {
    const legacyCreators = [{ id: "staff_accounts", jobCardCreatorEnabled: true }];

    expect(
      canCreateJobCardFromAccounts({ roles: ["Sales"], staffId: "staff_accounts" }, legacyCreators)
    ).toBe(false);
    expect(
      canCreateJobCardFromAccounts({ roles: ["Accounts"], staffId: "staff_other" }, legacyCreators)
    ).toBe(true);
  });

  test("Ticketing role sees enquiry and proposal navigation for assigned work", () => {
    const pages = pagesForRoles(["Ticketing"]);

    expect(pages).toEqual(
      expect.arrayContaining([
        "dashboard",
        "queries",
        "proposals",
        "ticketing",
        "employees-on-leave",
      ])
    );
    expect(pages).not.toEqual(
      expect.arrayContaining(["pipeline", "contracting", "finance", "team"])
    );
  });

  test("Sales role only sees enquiry and proposal navigation", () => {
    const pages = pagesForRoles(["Sales"]);

    expect(pages).toEqual(
      expect.arrayContaining([
        "dashboard",
        "queries",
        "pipeline",
        "proposals",
        "employees-on-leave",
      ])
    );
    expect(pages).not.toEqual(
      expect.arrayContaining(["finance", "ticketing", "contracting", "job-cards", "team"])
    );
  });

  test("Inbound lead navigation matches the backend role boundary", () => {
    for (const role of ["Sales", "Sales Head", "Admin", "Directors", "Director Cement"]) {
      expect(pagesForRoles([role]), `${role} should see inbound leads`).toContain("inbound-leads");
    }
    for (const role of ["Sales Cement", "Operations", "Ticketing"]) {
      expect(pagesForRoles([role]), `${role} should not see inbound leads`).not.toContain(
        "inbound-leads"
      );
    }
  });

  test("The inbound leads route gate matches the backend role boundary, not just view:queries", () => {
    const routeAllowed = (roles) => {
      const permissions = getPermissionsForRoles(roles);
      return canAccessPortalRoute({
        access: { allowed: true, permissions, roles },
        has: (permission) => permissions.includes(permission),
        view: "inbound-leads",
      });
    };
    for (const role of ["Sales", "Sales Head", "Admin", "Directors", "Director Cement"]) {
      expect(routeAllowed([role]), `${role} should open inbound leads`).toBe(true);
    }
    // These roles hold view:queries but the server refuses them the inbound queue.
    for (const role of ["Contracting", "Contracting Cement", "Sales Cement", "Ticketing"]) {
      expect(getPermissionsForRoles([role]), role).toContain(PORTAL_PERMISSIONS.VIEW_QUERIES);
      expect(routeAllowed([role]), `${role} should not open inbound leads`).toBe(false);
    }
  });

  test("Hr can manage leave without staff settings access", () => {
    const permissions = getPermissionsForRoles(["HR"]);
    const pages = pagesForRoles(["HR"]);

    expect(permissions).toContain(PORTAL_PERMISSIONS.VIEW_LEAVE);
    expect(permissions).toContain(PORTAL_PERMISSIONS.APPROVE_LEAVE);
    expect(permissions).toContain(PORTAL_PERMISSIONS.MANAGE_LEAVE);
    expect(permissions).not.toContain(PORTAL_PERMISSIONS.MANAGE_STAFF);
    expect(pages).toEqual(expect.arrayContaining(["dashboard", "employees-on-leave"]));
    expect(pages).not.toContain("settings");
  });

  test("Every staff role reaches Office check-in through the baseline permission", () => {
    for (const role of Object.keys(roleExpectations)) {
      expect(pagesForRoles([role]), `${role} should see Office check-in`).toContain(
        "office-check-in"
      );
      expect(
        canAccessPage({ permissions: getPermissionsForRoles([role]) }, "office-check-in")
      ).toBe(true);
    }
    expect(pagesForRoles([])).not.toContain("office-check-in");
  });

  test("Team directory is limited to admin directors hr and heads", () => {
    expect(pagesForRoles(["Sales"])).not.toContain("team");
    expect(pagesForRoles(["Contracting"])).not.toContain("team");
    expect(pagesForRoles(["Contracting Head"])).toContain("team");
    expect(pagesForRoles(["HR"])).toContain("team");
    expect(pagesForRoles(["Admin"])).toContain("team");
  });

  test("Admin and directors can access settings", () => {
    expect(canAccessPage({ permissions: getPermissionsForRoles(["Admin"]) }, "settings")).toBe(
      true
    );
    expect(canAccessPage({ permissions: getPermissionsForRoles(["Directors"]) }, "settings")).toBe(
      true
    );
  });

  test("Activity route exposes email status to authorized leaders without granting audit access", () => {
    expect(pagesForRoles(["Admin"])).toContain("activity");
    expect(pagesForRoles(["Directors"])).toContain("activity");
    expect(pagesForRoles(["Sales Head"])).toContain("activity");
    expect(pagesForRoles(["Operations Head"])).toContain("activity");
    expect(pagesForRoles(["HR"])).toContain("activity");
    expect(pagesForRoles(["Finance"])).toContain("activity");
    expect(getPermissionsForRoles(["Finance"])).not.toContain(
      PORTAL_PERMISSIONS.VIEW_EMAIL_DELIVERY_STATUS
    );
    expect(getPermissionsForRoles(["Sales Head"])).not.toContain(PORTAL_PERMISSIONS.VIEW_ACTIVITY);
  });

  test("Cement roles only get cement query type options", () => {
    const cementAccess = {
      permissions: getPermissionsForRoles(["Sales Cement"]),
      roles: ["Sales Cement"],
    };
    expect(isCementScopedUser(cementAccess)).toBe(true);
    expect(getQueryTypeOptions(cementAccess)).toEqual(["Cement", "Cement Bidding"]);
    expect(
      isCementScopedUser({ permissions: getPermissionsForRoles(["Admin"]), roles: ["Admin"] })
    ).toBe(false);
  });

  for (const [role, { allowed, denied }] of Object.entries(roleExpectations)) {
    test(`${role} Nav matches Activity Flow / portal-crm-spec`, () => {
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

describe("Passport scans in the Staff Workspace", () => {
  test("Tour Manager visa read alone does not show scans; office roles still do", () => {
    expect(canViewPassportScansInWorkspace({ roles: ["Tour Manager"] })).toBe(false);
    expect(canViewPassportScansInWorkspace({ roles: ["Tour Manager", "Operations"] })).toBe(true);
    expect(canViewPassportScansInWorkspace({ roles: ["Operations Head"] })).toBe(true);
    expect(canViewPassportScansInWorkspace({ roles: ["Sales"] })).toBe(false);
    expect(canViewPassportScansInWorkspace({})).toBe(false);
    expect(canViewPassportScansInWorkspace({ roles: ["Ticketing"] })).toBe(false);
  });

  test("lets ticketing and visa staff see passport expiry dates, never a Tour Manager alone", () => {
    expect(canViewPassportExpiryInWorkspace({ roles: ["Ticketing"] })).toBe(true);
    expect(canViewPassportExpiryInWorkspace({ roles: ["Head of Ticketing"] })).toBe(true);
    expect(canViewPassportExpiryInWorkspace({ roles: ["Operations Head"] })).toBe(true);
    expect(canViewPassportExpiryInWorkspace({ roles: ["Tour Manager"] })).toBe(false);
    expect(canViewPassportExpiryInWorkspace({ roles: ["Sales"] })).toBe(false);
    expect(canViewPassportExpiryInWorkspace({})).toBe(false);
  });
});

describe("Passport view log", () => {
  const signedIn = (roles, extra = {}) => ({ allowed: true, roles, ...extra });

  test("only the Operations Head and Admin see the log, as on the server", () => {
    expect(canViewFieldPassportAccessLog(signedIn(["Operations Head"]))).toBe(true);
    expect(canViewFieldPassportAccessLog(signedIn(["Admin"]))).toBe(true);
    expect(canViewFieldPassportAccessLog(signedIn(["Operations Head", "Tour Manager"]))).toBe(true);
    for (const roles of [
      ["Directors"],
      ["Director Cement"],
      ["Operations"],
      ["Operations Cement"],
      ["Tour Manager"],
      ["Ticketing"],
      ["Sales"],
      [],
    ]) {
      expect(canViewFieldPassportAccessLog(signedIn(roles))).toBe(false);
    }
  });

  test("refuses an external login, a signed-out caller and missing access", () => {
    expect(
      canViewFieldPassportAccessLog(signedIn(["Operations Head"], { externalTourManager: true }))
    ).toBe(false);
    expect(canViewFieldPassportAccessLog({ allowed: false, roles: ["Admin"] })).toBe(false);
    expect(canViewFieldPassportAccessLog(undefined)).toBe(false);
    expect(canViewFieldPassportAccessLog(null)).toBe(false);
  });
});

describe("Event Photo Booth dedicated access", () => {
  test("navigation and route access follow the live capability, never broad role permissions", () => {
    for (const roles of [["Admin"], ["Directors"], ["Director Cement"], ["Sales"]]) {
      const access = { allowed: true, permissions: getPermissionsForRoles(roles), roles };
      const allowed = {
        canManage: true,
        canManageAssignments: false,
        canParticipateWhenClosed: false,
      };
      const denied = { ...allowed, canManage: false };
      const pages = (capability) =>
        getAccessibleNavGroups(access, capability).flatMap((group) =>
          group.items.map((item) => item.page)
        );
      expect(pages(undefined)).not.toContain("event-photo-booth");
      expect(pages(denied)).not.toContain("event-photo-booth");
      expect(pages(allowed)).toContain("event-photo-booth");
      expect(canAccessPage(access, "event-photo-booth", allowed)).toBe(true);
      expect(canAccessPage(access, "event-photo-booth", denied)).toBe(false);
      expect(canAccessPage({ ...access, allowed: false }, "event-photo-booth", allowed)).toBe(
        false
      );
    }
  });
});

test("Every allowed staff member can open their inbox without administrative permissions", () => {
  const staff = { allowed: true, permissions: [], roles: ["Contracting"] };
  expect(canAccessPage(staff, "activity")).toBe(true);
  expect(
    getAccessibleNavGroups(staff)
      .flatMap((group) => group.items)
      .map((item) => item.page)
  ).toContain("activity");
  expect(canAccessPage(staff, "settings")).toBe(false);
  expect(canAccessPage({ ...staff, allowed: false }, "activity")).toBe(false);
});

describe("Staff Workspace navigation groups", () => {
  const boothManager = {
    canManage: true,
    canManageAssignments: false,
    canParticipateWhenClosed: false,
  };
  const layoutFor = (roles, booth) =>
    getAccessibleNavGroups(
      { allowed: true, permissions: getPermissionsForRoles(roles), roles },
      booth
    ).map((group) => [group.label, group.items.map((item) => item.label)]);

  test("Every staff role gets the personal Me group second, after Overview", () => {
    for (const role of Object.keys(roleExpectations)) {
      expect(layoutFor([role])[1], role).toEqual([
        "Me",
        ["Notifications", "Leave", "Travel schedule", "Office check-in"],
      ]);
    }
  });

  test("Administration is last and lists only the destinations a role can open", () => {
    expect(layoutFor(["Admin"]).at(-1)).toEqual(["Administration", ["Team Directory", "Settings"]]);
    expect(layoutFor(["Admin"], boothManager).at(-1)).toEqual([
      "Administration",
      ["Team Directory", "Event Photo Booth", "Settings"],
    ]);
    expect(layoutFor(["HR"]).at(-1)).toEqual(["Administration", ["Team Directory"]]);
    expect(layoutFor(["Sales"], boothManager).at(-1)).toEqual([
      "Administration",
      ["Event Photo Booth"],
    ]);
    expect(layoutFor(["Sales"]).map(([label]) => label)).not.toContain("Administration");
  });

  test("No role sees the retired Admin or System group labels", () => {
    for (const role of Object.keys(roleExpectations)) {
      const labels = layoutFor([role], boothManager).map(([label]) => label);
      expect(labels, role).not.toContain("Admin");
      expect(labels, role).not.toContain("System");
    }
  });
});

describe("External tour manager logins", () => {
  // What getMyPortalAccess returns for an external tour manager (owner decisions, 7 Nov 2026).
  const external = {
    allowed: true,
    externalTourManager: true,
    permissions: [
      "create:expenses",
      "view:expenses",
      "view:jobCards",
      "view:ticketing",
      "view:travellers",
      "view:visa",
    ],
    roles: ["Tour Manager"],
  };

  test("see their trips, post-tour feedback, group rows, expenses and notifications", () => {
    const layout = getAccessibleNavGroups(external).map((group) => [
      group.label,
      group.items.map((item) => item.label),
    ]);
    expect(layout).toEqual([
      ["Me", ["Notifications"]],
      ["Job Cards", ["Job Cards", "Post-tour feedback"]],
      ["Ticketing", ["Flights & PNR", "Seat Allocation", "All Tickets"]],
      ["Operations", ["Traveller Master", "Visa Tracking"]],
      ["Finance", ["Expenses"]],
    ]);
  });

  test("never open passport documents, the ticket dashboard or staff-wide pages", () => {
    for (const page of ["passport", "ticketing", "travel-schedule", "dashboard", "team"]) {
      expect(canAccessPage(external, page), page).toBe(false);
    }
    for (const page of ["job-cards", "activity", "post-tour-feedback", "visa", "tickets"]) {
      expect(canAccessPage(external, page), page).toBe(true);
    }
    expect(canViewPassportScansInWorkspace(external)).toBe(false);
    expect(canViewPassportExpiryInWorkspace(external)).toBe(false);
    const has = (permission) => external.permissions.includes(permission);
    for (const [view, allowed] of [
      ["passport", false],
      ["ticketing", false],
      ["visa", true],
      ["tickets", true],
      ["job-cards", true],
    ]) {
      expect(canAccessPortalRoute({ access: external, has, view }), view).toBe(allowed);
    }
    expect(isExternalTourManager(external)).toBe(true);
    expect(isExternalTourManager({ allowed: true, roles: ["Tour Manager"] })).toBe(false);
  });

  test("land on their Job Cards instead of the dashboard", () => {
    expect(portalHomeHref(external)).toBe("/portal/job-cards");
    const staffTourManager = {
      allowed: true,
      permissions: getPermissionsForRoles(["Tour Manager"]),
      roles: ["Tour Manager"],
    };
    expect(portalHomeHref(staffTourManager)).toBe("/portal");
    // A staff Tour Manager keeps the staff-wide pages and the passport page.
    expect(canAccessPage(staffTourManager, "travel-schedule")).toBe(true);
    expect(canAccessPage(staffTourManager, "passport")).toBe(true);
  });
});
