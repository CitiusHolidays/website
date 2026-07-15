import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ROLE_PERMISSIONS } from "@/lib/portal/constants";
import { buildDashboardKpiHref } from "@/lib/portal/dashboardLinks";
import { getVisibleDashboardMetricDefinitions } from "@/lib/portal/dashboardMetrics";
import { resolveDashboardPersona } from "@/lib/portal/dashboardPersona";
import { DashboardStatGrid } from "./DashboardStatGrid";

const ROLE_PERSONAS = {
  Contracting: "contracting",
  Directors: "director",
  Finance: "finance",
  HR: "hr",
  Operations: "operations",
  Sales: "sales",
  Ticketing: "ticketing",
};

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

function MetricIcon() {
  return <span aria-hidden />;
}

describe("mounted dashboard persona metrics", () => {
  for (const [role, expectedPersona] of Object.entries(ROLE_PERSONAS)) {
    test(`renders only the ${expectedPersona} KPI contract for ${role}`, () => {
      const permissions = ROLE_PERMISSIONS[role] ?? [];
      const has = (permission) => permissions.includes(permission);
      const persona = resolveDashboardPersona(has, { permissions });
      const metrics = getVisibleDashboardMetricDefinitions(persona.id, has).map((metric) => ({
        ...metric,
        href: buildDashboardKpiHref(metric.id, { from: "2026-07-01", to: "2026-07-14" }),
        Icon: MetricIcon,
        value: 1,
      }));
      const container = document.createElement("div");
      const root = createRoot(container);

      act(() => {
        root.render(
          <DashboardStatGrid featuredMetricId={persona.featuredMetricId} metrics={metrics} />
        );
      });

      const links = [...container.querySelectorAll("a")];
      expect(persona.id).toBe(expectedPersona);
      expect(links).toHaveLength(metrics.length);
      expect(links.length).toBeLessThanOrEqual(6);
      expect(links.every((link) => link.href.includes("from=2026-07-01"))).toBe(true);
      expect(links.every((link) => link.href.includes("to=2026-07-14"))).toBe(true);

      act(() => root.unmount());
    });
  }
});
