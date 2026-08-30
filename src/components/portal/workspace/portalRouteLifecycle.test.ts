import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getPortalDataDependencies } from "@/lib/portal/portalDataDependencies";
import {
  canAccessPortalRoute,
  getPortalRouteDefinition,
  getPortalRouteImplementationKey,
  PORTAL_ROUTES,
  resolvePortalRoutePagination,
  resolvePortalViewId,
} from "@/lib/portal/portalRouteManifest";

describe("Portal route lifecycle manifest", () => {
  test("Owns every view family through one compiler-checked definition", () => {
    const families = new Set(Object.values(PORTAL_ROUTES).map((route) => route.family));
    expect(families).toEqual(
      new Set(["administration", "core", "inbound", "operations", "pilot", "ticketing"])
    );
    expect(Object.keys(PORTAL_ROUTES)).toHaveLength(26);

    for (const view of Object.keys(PORTAL_ROUTES)) {
      const route = getPortalRouteDefinition(view);
      expect(getPortalRouteImplementationKey(view)).toBeTruthy();
      expect(route.permission).toBeTruthy();
      expect(route.title).toBeTruthy();
      expect(Array.isArray(route.dependencies)).toBe(true);
    }
  });

  test("Keeps Recovery module-owned and out of the workspace renderer", () => {
    expect(getPortalRouteDefinition("recovery")).toMatchObject({
      dependencies: [],
      module: "RecoveryCenterModule",
      permission: P.VIEW_DASHBOARD,
    });
    expect(getPortalRouteImplementationKey("recovery")).toBe("RecoveryCenterModule");
    expect([...getPortalDataDependencies({ view: "recovery" })]).toEqual([]);
  });

  test("Normalizes unknown routes to the safe dashboard lifecycle", () => {
    expect(resolvePortalViewId("unknown-route")).toBe("dashboard");
    expect(getPortalRouteDefinition("unknown-route")).toEqual(PORTAL_ROUTES.dashboard);
  });

  test("Uses route permissions and preserves the special pipeline authority rule", () => {
    const dashboardAccess = {
      allowed: true,
      permissions: [P.VIEW_DASHBOARD],
      roles: ["Sales"],
    };
    expect(
      canAccessPortalRoute({
        access: dashboardAccess,
        has: (permission) => dashboardAccess.permissions.includes(permission),
        view: "dashboard",
      })
    ).toBe(true);
    expect(
      canAccessPortalRoute({
        access: dashboardAccess,
        has: (permission) => dashboardAccess.permissions.includes(permission),
        view: "finance",
      })
    ).toBe(false);

    const contractingAccess = {
      allowed: true,
      permissions: [P.VIEW_CONTRACTING],
      roles: ["Contracting"],
    };
    expect(
      canAccessPortalRoute({ access: contractingAccess, has: () => false, view: "pipeline" })
    ).toBe(true);
    expect(
      canAccessPortalRoute({
        access: { allowed: false, permissions: [P.MANAGE_QUERIES], roles: ["Sales"] },
        has: () => true,
        view: "pipeline",
      })
    ).toBe(false);
  });

  test("Routes pagination through the same definition as rendering", () => {
    const pagination = {
      activity: {},
      approvals: {},
      expenses: {},
      flightOperations: {},
      hotelOperations: {},
      invoices: {},
      jobCards: {},
      leaves: { canLoadMore: true, loadedCount: 50 },
      proposals: {},
      queries: { canLoadMore: false, loadedCount: 12 },
      seats: {},
      staff: {},
      team: {},
      tickets: {},
      tourManagers: {},
      travellers: {},
      visas: {},
    };
    expect(resolvePortalRoutePagination("employees-on-leave", pagination)).toBe(pagination.leaves);
    expect(resolvePortalRoutePagination("queries", pagination)).toBe(pagination.queries);
    expect(resolvePortalRoutePagination("dashboard", pagination)).toBeUndefined();
    expect(resolvePortalRoutePagination("recovery", pagination)).toBeUndefined();
  });

  test("Combines route, modal, and deep-link subscriptions without all-domain fan-out", () => {
    expect([...getPortalDataDependencies({ view: "dashboard" })]).toEqual(["dashboard"]);
    expect([...getPortalDataDependencies({ view: "contracting" })].sort()).toEqual([
      "queries",
      "team",
    ]);
    expect(
      [...getPortalDataDependencies({ modal: "passengerImport", view: "ticketing" })].sort()
    ).toEqual(["jobCards", "ticketDashboard"]);
    expect(
      [...getPortalDataDependencies({ modal: "passengerExport", view: "ticketing" })].sort()
    ).toEqual(["jobCards", "ticketDashboard"]);
    expect(
      [
        ...getPortalDataDependencies({
          deepLinkOpen: "approval",
          modal: "ticket",
          view: "dashboard",
        }),
      ].sort()
    ).toEqual(["approvals", "dashboard", "expenses", "jobCards", "pnrs", "tickets", "travellers"]);
  });
});
