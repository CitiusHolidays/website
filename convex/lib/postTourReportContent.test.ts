import { describe, expect, test } from "bun:test";
import {
  emptyPostTourReport,
  postTourReportError,
  reportNeedsClosureDetails,
} from "./postTourReportContent";

function completeReport() {
  const content = emptyPostTourReport({
    client: "Synthetic group",
    destination: "Jaipur",
    endDate: "2026-10-04",
    guests: 20,
    programme: "MICE / Corporate",
    startDate: "2026-10-01",
    tourManager: "Synthetic manager",
  });
  content.performance = { handling: 5, itinerary: 4, overall: 4, satisfaction: 5, services: 3 };
  content.highlights = "Clear arrivals, useful sessions and a well-paced city visit.";
  content.suppliers = content.suppliers.map((s) => ({ ...s, rating: "na" }));
  content.closure = {
    additionalCost: "No",
    billing: "Completed",
    budgetVariation: "No",
    pendingDetails: "",
    refundPending: "No",
  };
  content.assessment = {
    learnings: "Confirm rooms, allow transfer time and brief local hosts.",
    rating: 8,
    repeat: "Yes, with changes",
    status: "Good",
  };
  return content;
}
describe("internal report content", () => {
  test("incomplete drafts stay valid without inventing answers or supplier zeroes", () => {
    const draft = emptyPostTourReport();
    expect(postTourReportError(draft, false)).toBeNull();
    expect(postTourReportError(draft, true)).toBe("Complete the required tour details.");
    expect(draft.suppliers.every((s) => s.rating === null)).toBe(true);
  });
  test("retains five distinct 1–5 ratings and a separate final 1–10 score", () => {
    const c = completeReport();
    expect(postTourReportError(c, true)).toBeNull();
    c.assessment.rating = 10;
    expect(postTourReportError(c, true)).toBeNull();
    c.performance.handling = 10;
    expect(postTourReportError(c, true)).toBe(
      "Choose performance and supplier ratings from 1 to 5; use N.A. only for suppliers."
    );
  });
  test("requires follow-up only for low supplier scores and never treats N.A. as zero", () => {
    const c = completeReport();
    c.suppliers[0].rating = 2;
    expect(postTourReportError(c, true)).toBe(
      "For suppliers rated 1 or 2, explain what went wrong and whether to use them again."
    );
    c.suppliers[0].followUp = "Rooms were late. Use again only with written early check-in.";
    expect(postTourReportError(c, true)).toBeNull();
    c.suppliers[0].rating = 0;
    expect(postTourReportError(c, true)).toContain("from 1 to 5");
  });
  test("a miss needs the issue, resolution and future change; no miss requires no invented issue", () => {
    const c = completeReport();
    expect(postTourReportError(c, true)).toBeNull();
    c.misses = ["Itinerary / timing"];
    expect(postTourReportError(c, true)).toContain("describe the issue");
    c.issue = "Late transfer";
    c.resolution = "Rebooked vehicle";
    c.nextTime = "Confirm dispatch earlier";
    expect(postTourReportError(c, true)).toBeNull();
  });
  test("closure choices reveal a required amount, reason and owner only when needed", () => {
    const c = completeReport();
    expect(reportNeedsClosureDetails(c.closure)).toBe(false);
    c.closure.refundPending = "Yes";
    expect(reportNeedsClosureDetails(c.closure)).toBe(true);
    expect(postTourReportError(c, true)).toContain("amount, reason and responsible person");
    c.closure.pendingDetails = "INR 1200, cancelled transfer, Operations owner to recover.";
    expect(postTourReportError(c, true)).toBeNull();
  });
  test("rejects invalid dates, fractional guests, unknown choices and oversized text even in drafts", () => {
    const c = completeReport();
    c.tour.endDate = "2026-02-30";
    expect(postTourReportError(c, false)).toContain("valid tour dates");
    c.tour.endDate = "2026-10-04";
    c.tour.guests = 1.5;
    expect(postTourReportError(c, false)).toContain("whole guest count");
    c.tour.guests = 20;
    c.hits = ["Unknown"];
    expect(postTourReportError(c, false)).toBe("Choose valid, distinct Hits.");
    c.hits = [];
    c.highlights = "x".repeat(4001);
    expect(postTourReportError(c, false)).toContain("4,000");
  });
  test("rejects duplicate or missing supplier categories and blank final learnings", () => {
    const c = completeReport();
    c.suppliers.pop();
    expect(postTourReportError(c, false)).toContain("six supplier categories");
    const other = completeReport();
    other.assessment.learnings = " ";
    expect(postTourReportError(other, true)).toContain("final assessment");
  });
});
