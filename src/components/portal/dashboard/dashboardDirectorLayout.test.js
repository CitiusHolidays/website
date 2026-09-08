import { afterAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { PORTAL_PERMISSIONS as P, ROLE_PERMISSIONS } from "@/lib/portal/constants";
import { groupDashboardSections, resolveDashboardPersona } from "@/lib/portal/dashboardPersona";

mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedQuery: () => undefined,
}));

afterAll(() => mock.restore());

describe("Dashboard director layout", () => {
  test("Keeps executive overview separate from today work sections", () => {
    const permissions = [
      P.VIEW_REPORTS,
      P.VIEW_QUERIES,
      P.VIEW_CONTRACTING,
      P.VIEW_JOB_CARDS,
      P.VIEW_TICKETING,
    ];
    const has = (permission) => permissions.includes(permission);
    const persona = resolveDashboardPersona(has, { permissions });
    const groups = groupDashboardSections(persona, [
      "stats",
      "inbox",
      "workQueue",
      "pipeline",
      "queryTypes",
    ]);

    expect(persona.id).toBe("director");
    expect(groups.overview).toEqual(["stats"]);
    expect(groups.today[0]).toBe("inbox");
  });

  test("Renders My Work before overview and scorecards for every staff persona", async () => {
    const { DashboardView } = await import("./DashboardView");
    for (const role of [
      "Directors",
      "Sales",
      "Contracting",
      "Operations",
      "Ticketing",
      "Finance",
      "HR",
    ]) {
      const permissions = ROLE_PERMISSIONS[role];
      const { document } = new JSDOM(
        renderToStaticMarkup(
          <DashboardView
            access={{ permissions, roles: [role], staffId: "staff-1" }}
            dateRange={{ from: "2026-09-01", to: "2026-09-08" }}
            has={(permission) => permissions.includes(permission)}
            openModal={() => undefined}
            referenceNow={Date.UTC(2026, 8, 8)}
            setDateRange={() => undefined}
            summary={{
              metrics: {},
              progress: {},
              urgentActionCategories: [{ complete: false, count: 0, type: "approvals" }],
            }}
          />
        )
      ).window;
      const headings = [...document.querySelectorAll("h2, h3")].map(
        (heading) => heading.textContent
      );
      const workIndex = headings.indexOf("My work today");
      expect(workIndex).toBeGreaterThanOrEqual(0);
      expect(workIndex).toBeLessThan(headings.indexOf("Workspace overview"));
      const overview = document.querySelector('[aria-labelledby="dashboard-overview-heading"]');
      expect(overview.textContent).toContain("Unknown");
      expect(overview.textContent).not.toContain("INR 0");
      const scorecardIndex = headings.indexOf("Operating-day scorecard");
      if (scorecardIndex >= 0) {
        expect(workIndex).toBeLessThan(scorecardIndex);
        expect(document.body.textContent).toContain("Loading scorecard");
      }
      document.defaultView.close();
    }
  });
});
