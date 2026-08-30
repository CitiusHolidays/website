import { describe, expect, test } from "bun:test";
import { deriveProposalPairState, proposalPairClock } from "./proposalLifecycle";

describe("Proposal Query-pair lifecycle", () => {
  test("Derives pair state without using Proposal-wide status", () => {
    expect(deriveProposalPairState({ currentProposalRevision: 2 })).toBe("Draft");
    expect(deriveProposalPairState({ currentProposalRevision: 2, handedOffAt: 100 })).toBe(
      "Unknown"
    );
    expect(
      deriveProposalPairState({
        currentProposalRevision: 2,
        handedOffAt: 100,
        handedOffRevision: 1,
      })
    ).toBe("Stale");
    expect(
      deriveProposalPairState({
        currentProposalRevision: 2,
        handedOffRevision: 2,
        revisionRequestedAt: 120,
      })
    ).toBe("Revision requested");
    expect(deriveProposalPairState({ currentProposalRevision: 2, handedOffRevision: 2 })).toBe(
      "With Sales"
    );
    expect(
      deriveProposalPairState({
        currentProposalRevision: 2,
        decisionRevision: 2,
        decisionStatus: "Order Confirmed",
        handedOffRevision: 2,
      })
    ).toBe("Confirmed");
    expect(
      deriveProposalPairState({
        currentProposalRevision: 2,
        decisionRevision: 2,
        decisionStatus: "Order Lost",
        handedOffRevision: 2,
      })
    ).toBe("Lost");
  });

  test("Uses an explicit reference time and preserves Unknown legacy clocks", () => {
    expect(proposalPairClock(undefined, undefined, 500)).toEqual({
      elapsedMs: null,
      endedAt: null,
      startedAt: null,
      status: "Unknown",
    });
    expect(proposalPairClock(100, undefined, 500)).toEqual({
      elapsedMs: 400,
      endedAt: null,
      startedAt: 100,
      status: "Running",
    });
    expect(proposalPairClock(100, 350, 900)).toEqual({
      elapsedMs: 250,
      endedAt: 350,
      startedAt: 100,
      status: "Complete",
    });
    expect(proposalPairClock(500, 450, 900).elapsedMs).toBe(0);
  });
});
