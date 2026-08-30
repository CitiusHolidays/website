import { describe, expect, test } from "bun:test";
import { handleRetiredJourneyPlannerRequest } from "./route";

describe("Retired Sacred Bharat Journey Planner route", () => {
  test("preserves the old endpoint with an explicit retired response", async () => {
    const response = handleRetiredJourneyPlannerRequest();

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error:
        "The Sacred Bharat Journey Planner has been retired. Contact Citius Holidays for pilgrimage planning help.",
    });
  });
});
