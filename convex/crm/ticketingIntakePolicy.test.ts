import { describe, expect, test } from "bun:test";
import {
  queryNeedsTicketingHeadIntakeAlert,
  requiresTicketingSpocAssignment,
} from "./ticketingIntakePolicy";

describe("Ticketing intake policy", () => {
  test.each([
    ["Domestic", true],
    ["International", true],
    ["Both", true],
    ["Not required", false],
    ["", false],
    [undefined, false],
  ] as const)("Ticketing scope %s requires assignment: %s", (scope, expected) => {
    expect(requiresTicketingSpocAssignment(scope)).toBe(expected);
  });

  test("Relevant scope without ticketing SPOC needs a ticketing head intake alert", () => {
    expect(
      queryNeedsTicketingHeadIntakeAlert({
        salesStatus: "Proposal in discussion",
        ticketingScope: "Domestic",
      })
    ).toBe(true);
  });

  test("Not required stays silent", () => {
    expect(
      queryNeedsTicketingHeadIntakeAlert({
        salesStatus: "Proposal in discussion",
        ticketingScope: "Not required",
      })
    ).toBe(false);
  });

  test("Assigned ticketing SPOC clears the intake alert", () => {
    expect(
      queryNeedsTicketingHeadIntakeAlert({
        salesStatus: "Proposal in discussion",
        ticketingOwnerId: "staff_ticketing",
        ticketingScope: "Both",
      })
    ).toBe(false);
  });
});
