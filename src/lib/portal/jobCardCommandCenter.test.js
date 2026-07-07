import { describe, expect, test } from "bun:test";
import { buildJobCardCommandCenter } from "./jobCardCommandCenter.js";

describe("jobCardCommandCenter", () => {
  test("builds readiness sections and blockers", () => {
    const model = buildJobCardCommandCenter({
      checklistTasks: [{ _id: "t1", completed: false, title: "Briefing" }],
      jobCard: { confirmedPax: 2, tourManagerName: "", travelStartDate: "2026-07-01" },
      tickets: [{ ticketStatus: "Pending Issue" }],
      travellers: [{ passportStatus: "Received" }],
      visaRecords: [{ status: "Approved" }],
    });
    expect(model.readinessSections.some((section) => section.key === "tickets")).toBe(true);
    expect(model.blockers.length).toBeGreaterThan(0);
    expect(model.ownerLanes[0].label).toBe("Contracting SPOC");
  });
});
