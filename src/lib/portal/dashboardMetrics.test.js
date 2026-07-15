import { describe, expect, test } from "bun:test";
import { ROLE_PERMISSIONS } from "./constants";
import { buildDashboardKpiHref } from "./dashboardLinks";
import {
  getDashboardMetricDefinitions,
  getVisibleDashboardMetricDefinitions,
} from "./dashboardMetrics";
import { resolveDashboardPersona } from "./dashboardPersona";

const ROLE_PERSONAS = {
  Contracting: "contracting",
  Directors: "director",
  Finance: "finance",
  HR: "hr",
  Operations: "operations",
  Sales: "sales",
  Ticketing: "ticketing",
};

describe("dashboard persona metrics", () => {
  test("defines at most six stable, linked KPIs for every persona", () => {
    for (const personaId of Object.values(ROLE_PERSONAS)) {
      const metrics = getDashboardMetricDefinitions(personaId);
      expect(metrics.length).toBeLessThanOrEqual(6);
      expect(new Set(metrics.map((metric) => metric.id)).size).toBe(metrics.length);
      for (const metric of metrics) {
        expect(buildDashboardKpiHref(metric.id, { from: "2026-07-01", to: "2026-07-14" })).not.toBe(
          "/portal"
        );
      }
    }
  });

  test("real roles receive only permitted metrics for their resolved persona", () => {
    for (const [role, expectedPersona] of Object.entries(ROLE_PERSONAS)) {
      const permissions = ROLE_PERMISSIONS[role] ?? [];
      const has = (permission) => permissions.includes(permission);
      const persona = resolveDashboardPersona(has, { permissions });
      const metrics = getVisibleDashboardMetricDefinitions(persona.id, has);

      expect(persona.id).toBe(expectedPersona);
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.length).toBeLessThanOrEqual(6);
      expect(metrics.every((metric) => has(metric.permission))).toBe(true);
    }
  });

  test("keeps query-type reporting out of every persona's primary KPI contract", () => {
    for (const personaId of Object.values(ROLE_PERSONAS)) {
      expect(getDashboardMetricDefinitions(personaId).map((metric) => metric.id)).not.toContain(
        "queryTypes"
      );
    }
  });
});
