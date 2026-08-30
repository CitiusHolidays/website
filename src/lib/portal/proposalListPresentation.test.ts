import { describe, expect, test } from "bun:test";
import { getProposalAttention, proposalWorkflowLabel } from "./proposalListPresentation";

const NOW = Date.parse("2026-07-12T12:00:00.000Z");
const ownedQuery = { contractingOwnerId: "staff-1" };

describe("Proposal list presentation", () => {
  test("Keeps authoring state separate from the Query-pair lifecycle", () => {
    expect(proposalWorkflowLabel("Sent")).toBe("Authoring");
    expect(proposalWorkflowLabel("Draft")).toBe("Authoring");
    expect(proposalWorkflowLabel({ proposalRevision: 3, status: "Sent" })).toBe(
      "Authoring revision 3"
    );
  });
  test("Distinguishes blocked, unassigned, pair decisions, and overdue authoring", () => {
    expect(getProposalAttention({ status: "Draft" }, NOW)).toEqual({
      label: "Blocked: no linked query",
      tone: "danger",
    });
    expect(getProposalAttention({ query: {}, status: "Draft" }, NOW)).toEqual({
      label: "Contracting SPOC unassigned",
      tone: "warning",
    });
    expect(
      getProposalAttention({ query: { ...ownedQuery, pairState: "With Sales" } }, NOW)
    ).toEqual({
      label: "With Sales: awaiting Sales Decision",
      tone: "info",
    });
    expect(
      getProposalAttention({
        query: { ...ownedQuery, pairState: "Revision requested" },
      })
    ).toEqual({ label: "Revision requested for query pair", tone: "warning" });
    expect(getProposalAttention({ query: { ...ownedQuery, pairState: "Unknown" } })).toEqual({
      label: "Legacy pair clock unavailable",
      tone: "warning",
    });
    expect(
      getProposalAttention({
        queryPreview: [
          { ...ownedQuery, pairState: "Confirmed" },
          { ...ownedQuery, pairState: "Lost" },
        ],
      })
    ).toEqual({ label: "Pair decisions recorded", tone: undefined });
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
    ).toEqual({ label: "Draft overdue: 4 days", tone: "warning" });
  });
});
