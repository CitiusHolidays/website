import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { groupDashboardSections, resolveDashboardPersona } from "@/lib/portal/dashboardPersona";

describe("dashboard director layout", () => {
  test("keeps executive overview before today work sections", () => {
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
});
