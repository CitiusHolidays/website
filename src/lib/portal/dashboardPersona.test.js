import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P, ROLE_PERMISSIONS } from "./constants.js";
import {
  groupDashboardSections,
  orderDashboardSections,
  resolveDashboardPersona,
} from "./dashboardPersona.js";

function personaForRole(role) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  const has = (permission) => permissions.includes(permission);
  return resolveDashboardPersona(has, { permissions });
}

describe("dashboardPersona", () => {
  test("detects sales persona from the real Sales role", () => {
    expect(personaForRole("Sales").id).toBe("sales");
  });

  test("detects contracting persona from the real Contracting role", () => {
    const persona = personaForRole("Contracting");

    expect(persona.id).toBe("contracting");
    expect(persona.featuredMetricLabel).toBe("Proposals Sent");
  });

  test("detects operations persona from the real Operations role", () => {
    const persona = personaForRole("Operations");

    expect(persona.id).toBe("operations");
    expect(persona.sections).toContain("readiness");
  });

  test("detects ticketing persona from the real Ticketing role", () => {
    const persona = personaForRole("Ticketing");

    expect(persona.id).toBe("ticketing");
    expect(persona.featuredMetricLabel).toBe("Tickets Pending");
  });

  test("detects finance persona from the real Finance role", () => {
    const persona = personaForRole("Finance");

    expect(persona.id).toBe("finance");
    expect(persona.featuredMetricLabel).toBe("Outstanding");
  });

  test("detects director persona from broad reporting access", () => {
    const persona = personaForRole("Directors");

    expect(persona.id).toBe("director");
    expect(persona.sections).toContain("pipeline");
    expect(persona.sections).toContain("queryTypes");
  });

  test("detects HR persona from leave management access", () => {
    const persona = personaForRole("HR");

    expect(persona.id).toBe("hr");
    expect(persona.featuredMetricLabel).toBe("Pending Approvals");
  });

  test("uses minimal sales shell when permissions are still loading", () => {
    const persona = resolveDashboardPersona(() => false, { permissions: [] });

    expect(persona).toMatchObject({
      id: "sales",
      sections: ["hero", "periodPresets"],
    });
  });

  test("orders requested sections by persona priority", () => {
    const ordered = orderDashboardSections(["activity", "hero", "stats"], {
      sections: ["hero", "quickActions", "stats", "activity"],
    });

    expect(ordered).toEqual(["hero", "stats", "activity"]);
  });

  test("puts director action queues before metrics and reporting", () => {
    const groups = groupDashboardSections(personaForRole("Directors"), [
      "stats",
      "inbox",
      "pipeline",
      "workQueue",
      "ticketingQueue",
      "readiness",
      "queryTypes",
      "collapsible",
    ]);

    expect(groups).toMatchObject({
      overview: ["stats"],
      reporting: ["pipeline", "queryTypes"],
      supporting: ["collapsible"],
      today: ["inbox", "workQueue", "ticketingQueue", "readiness"],
    });
    expect(groups.today.at(-1)).toBe("readiness");
  });

  test("keeps each staff persona focused on its actionable sections", () => {
    const ticketingGroups = groupDashboardSections(personaForRole("Ticketing"), [
      "stats",
      "inbox",
      "ticketingQueue",
      "activity",
    ]);
    const operationsGroups = groupDashboardSections(personaForRole("Operations"), [
      "stats",
      "inbox",
      "workQueue",
      "readiness",
      "activity",
    ]);

    expect(ticketingGroups.today).toEqual(["inbox", "ticketingQueue"]);
    expect(operationsGroups.today).toEqual(["inbox", "workQueue", "readiness"]);
    expect(ticketingGroups.overview).toEqual(["stats"]);
  });

  test("defaults to sales when only query permissions are available", () => {
    const permissions = [P.VIEW_QUERIES, P.MANAGE_QUERIES];
    const has = (permission) => permissions.includes(permission);

    expect(resolveDashboardPersona(has, { permissions }).id).toBe("sales");
  });
});
