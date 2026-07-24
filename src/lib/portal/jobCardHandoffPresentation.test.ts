import { describe, expect, test } from "bun:test";
import {
  queryJobCardHandoffLabel,
  ticketingRoleShowsJobCardHandoff,
} from "./jobCardHandoffPresentation";

describe("job card handoff presentation", () => {
  test("shows awaiting state before job card exists", () => {
    expect(
      queryJobCardHandoffLabel({
        salesStatus: "Order Confirmed",
      })
    ).toBe("Awaiting Job Card");
  });

  test("shows linked job card code after creation", () => {
    expect(
      queryJobCardHandoffLabel({
        jobCardCode: "JC-0001-NS",
        salesStatus: "Order Confirmed",
      })
    ).toBe("JC-0001-NS");
  });

  test("ticketing handoff is hidden when scope is Not required", () => {
    expect(ticketingRoleShowsJobCardHandoff("Not required")).toBe(false);
    expect(ticketingRoleShowsJobCardHandoff("Domestic")).toBe(true);
  });
});
