import { describe, expect, test } from "bun:test";
import { getProposalAttention, proposalWorkflowLabel } from "./proposalListPresentation";

const NOW = Date.parse("2026-07-12T12:00:00.000Z");
const ownedQuery = { contractingOwnerId: "staff-1" };

describe("proposal list presentation", () => {
  test("presents the Contracting handoff as With Sales", () => {
    expect(proposalWorkflowLabel("Sent")).toBe("With Sales");
    expect(proposalWorkflowLabel("Draft")).toBe("Draft");
    expect(
      proposalWorkflowLabel({ sentToClientAt: "2026-07-13T12:00:00.000Z", status: "Sent" })
    ).toBe("Sent to Client");
  });
  test("distinguishes blocked, unassigned, waiting, and overdue proposals", () => {
    expect(getProposalAttention({ status: "Draft" }, NOW)).toEqual({
      label: "Blocked — no linked query",
      tone: "danger",
    });
    expect(getProposalAttention({ query: {}, status: "Draft" }, NOW)).toEqual({
      label: "Contracting SPOC unassigned",
      tone: "warning",
    });
    expect(getProposalAttention({ query: ownedQuery, status: "Sent" }, NOW)).toEqual({
      label: "With Sales — awaiting Sales Decision",
      tone: "info",
    });
    expect(
      getProposalAttention({
        query: ownedQuery,
        sentToClientAt: "2026-07-13T12:00:00.000Z",
        status: "Sent",
      })
    ).toEqual({ label: "Client delivery recorded", tone: undefined });
    expect(
      getProposalAttention(
        {
          createdAt: "2026-07-01T12:00:00.000Z",
          pricingEnteredAt: "2026-07-01T12:00:00.000Z",
          query: ownedQuery,
          status: "Draft",
          updatedAt: "2026-07-08T12:00:00.000Z",
        },
        NOW
      )
    ).toEqual({ label: "Draft overdue — 4 days", tone: "warning" });
  });
});
