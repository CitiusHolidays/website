import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "./constants.js";
import { buildContractingSurfaceStatusAction } from "./contractingQueryActions.js";

const sampleRow = {
  approxMargin: 18_000,
  budgetAmount: 250_000,
  contractingAirlinesCost: 8000,
  contractingLandCost: 12_000,
  contractingStatus: "Proposal in progress",
  contractingVisaCost: 1500,
  destination: "Ladakh",
  id: "query_1",
  leadStage: "Qualified",
  lostReason: "Budget",
  paxCount: 12,
  salesStatus: "Proposal in discussion",
  travelEndDate: "2026-08-10",
  travelStartDate: "2026-08-01",
};

function hasPermissions(permissions: string[]) {
  const set = new Set(permissions);
  return (permission: string) => set.has(permission);
}

describe("buildContractingSurfaceStatusAction", () => {
  test("dual-permission users get Status on the contracting surface, not Sales Decision", () => {
    const action = buildContractingSurfaceStatusAction(
      sampleRow,
      hasPermissions([P.MANAGE_QUERIES, P.MANAGE_CONTRACTING])
    );

    expect(action).toEqual({
      initial: expect.objectContaining({
        queryId: "query_1",
        salesDecision: "Proposal in discussion",
      }),
      label: "Status",
      modal: "queryStatus",
    });
    expect(action?.modal).not.toBe("salesDecision");
    expect(action?.label).not.toBe("Sales Decision");
  });

  test("contracting-only users open query status with contracting fields", () => {
    const action = buildContractingSurfaceStatusAction(
      sampleRow,
      hasPermissions([P.MANAGE_CONTRACTING])
    );

    expect(action?.modal).toBe("queryStatus");
    expect(action?.label).toBe("Status");
    expect(action?.initial.contractingLandCost).toBe("12000");
  });
});
