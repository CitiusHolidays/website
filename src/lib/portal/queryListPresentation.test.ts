import { describe, expect, test } from "bun:test";
import { getQueryAttentionLabel, getQueryPrimaryActionKind } from "./queryListPresentation";

describe("query list presentation", () => {
  test("keeps the next actionable workflow step visible", () => {
    expect(
      getQueryPrimaryActionKind({
        canAssignTeams: true,
        canManageQueries: true,
        submittedToContractingAt: undefined,
      })
    ).toBe("submit");
    expect(
      getQueryPrimaryActionKind({
        canAssignTeams: true,
        canManageQueries: true,
        submittedToContractingAt: 1,
      })
    ).toBe("status");
    expect(
      getQueryPrimaryActionKind({
        canAssignTeams: true,
        canManageQueries: false,
        submittedToContractingAt: 1,
      })
    ).toBe("assign");
  });

  test("surfaces the most useful query exception on compact cards", () => {
    expect(getQueryAttentionLabel({ leadStage: "Inquiry" })).toBe("Contracting handoff pending");
    expect(
      getQueryAttentionLabel({
        leadStage: "Proposal",
        submittedToContractingAt: 1,
      })
    ).toBe("Contracting SPOC unassigned");
    expect(
      getQueryAttentionLabel({
        contractingOwnerId: "staff_contracting",
        leadStage: "Proposal",
        submittedToContractingAt: 1,
      })
    ).toBe("Ticketing scope pending");
    expect(
      getQueryAttentionLabel({
        contractingOwnerId: "staff_contracting",
        leadStage: "Proposal",
        submittedToContractingAt: 1,
        ticketingScope: "Required",
      })
    ).toBe("Ticketing SPOC unassigned");
    expect(
      getQueryAttentionLabel({
        contractingOwnerId: "staff_contracting",
        leadStage: "Lost",
        lostReason: "Budget",
        submittedToContractingAt: 1,
      })
    ).toBe("Lost — Budget");
  });

  test("does not invent an exception for a fully assigned query", () => {
    expect(
      getQueryAttentionLabel({
        contractingOwnerId: "staff_contracting",
        destination: "Goa",
        leadStage: "Proposal",
        submittedToContractingAt: 1,
        ticketingOwnerId: "staff_ticketing",
        ticketingScope: "Required",
        travelStartDate: "2026-08-01",
      })
    ).toBe("No open exception");
  });
});
