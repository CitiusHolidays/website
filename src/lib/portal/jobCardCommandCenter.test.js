import { describe, expect, test } from "bun:test";
import { buildJobCardCommandCenter } from "./jobCardCommandCenter.js";

describe("jobCardCommandCenter", () => {
  test("builds readiness sections and blockers", () => {
    const model = buildJobCardCommandCenter({
      jobCard: { confirmedPax: 2, tourManagerName: "", travelStartDate: "2026-07-01" },
      travellers: [{ passportStatus: "Received" }],
      tickets: [{ ticketStatus: "Pending Issue" }],
      visaRecords: [{ status: "Approved" }],
      checklistTasks: [{ _id: "t1", title: "Briefing", completed: false }],
    });
    expect(model.readinessSections.some((section) => section.key === "tickets")).toBe(true);
    expect(model.blockers.length).toBeGreaterThan(0);
    expect(model.ownerLanes[0].label).toBe("Contracting SPOC");
  });
});
