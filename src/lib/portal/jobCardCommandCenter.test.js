import { describe, expect, test } from "bun:test";
import { buildJobCardCommandCenter } from "./jobCardCommandCenter.js";

describe("JobCardCommandCenter", () => {
  test("Uses the server projection without deriving finance or action state in the client", () => {
    const model = buildJobCardCommandCenter({
      actions: [
        {
          href: "/portal/tickets?jc=job_1",
          id: "readiness:tickets",
          label: "Continue ticketing",
        },
      ],
      blockers: [{ key: "tickets", label: "Tickets incomplete", severity: "critical" }],
      money: { exact: null, readiness: "partially_outstanding" },
      openingEvidence: { current: { variances: [] }, status: "recorded", variances: [] },
      readiness: [{ complete: false, key: "tickets", label: "Tickets", percent: 50 }],
    });

    expect(model.readinessSections).toEqual([
      { complete: false, key: "tickets", label: "Tickets", percent: 50 },
    ]);
    expect(model.actions[0].href).toBe("/portal/tickets?jc=job_1");
    expect(model.blockers[0].severity).toBe("critical");
    expect(model.money).toEqual({
      exact: null,
      label: "Partially outstanding",
      readiness: "partially_outstanding",
    });
  });
});
