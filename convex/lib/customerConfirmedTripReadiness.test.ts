import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { confirmedTravelSummaryProjection } from "./customerConfirmedTripReadiness";

const OFFER = {
  confirmedAt: 100,
  destination: "Kyoto",
  proposalId: "proposals_1",
  proposalRevision: 2,
  queryId: "queries_1",
  travelEndDate: "2026-11-10",
  travelStartDate: "2026-11-01",
};
const HANDOFF = {
  proposalId: "proposals_1",
  proposalRevision: 2,
  queryId: "queries_1",
};

describe("Customer confirmed travel summary readiness", () => {
  test("requires one exact immutable source plus complete normalized travel facts", () => {
    expect(
      confirmedTravelSummaryProjection({
        handoff: fromAny(HANDOFF),
        offer: fromAny(OFFER),
        queryId: fromAny("queries_1"),
      })
    ).toEqual({
      asOf: 100,
      destination: "Kyoto",
      endDate: "2026-11-10",
      startDate: "2026-11-01",
    });
  });

  test("keeps missing, invalid, inverted, or mismatched facts pending", () => {
    const inputs = [
      { offer: { ...OFFER, travelEndDate: undefined } },
      { offer: { ...OFFER, travelEndDate: "invalid-date" } },
      { offer: { ...OFFER, destination: "" } },
      { offer: { ...OFFER, travelStartDate: "2026-12-01" } },
      { handoff: { ...HANDOFF, proposalRevision: 3 }, offer: OFFER },
    ];
    const projections = inputs.map((input) =>
      confirmedTravelSummaryProjection({
        handoff: fromAny(input.handoff ?? HANDOFF),
        offer: fromAny(input.offer),
        queryId: fromAny("queries_1"),
      })
    );

    expect(projections.every((projection) => projection.asOf === null)).toBe(true);
  });
});
