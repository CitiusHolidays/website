import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "./constants.js";
import { buildQueryStatusAction } from "./queryStatusAction.js";

const sampleRow = {
  id: "query_1",
  salesStatus: "Proposal in discussion",
  leadStage: "Qualified",
  contractingStatus: "Proposal in progress",
  budgetAmount: 250000,
  contractingLandCost: 12000,
  contractingAirlinesCost: 8000,
  contractingVisaCost: 1500,
  approxMargin: 18000,
  lostReason: "Budget",
};

function hasPermissions(permissions) {
  const set = new Set(permissions);
  return (permission) => set.has(permission);
}

describe("buildQueryStatusAction", () => {
  test("sales-only users open Sales Decision with full sales initial fields", () => {
    const action = buildQueryStatusAction(sampleRow, hasPermissions([P.MANAGE_QUERIES]));

    expect(action.modal).toBe("salesDecision");
    expect(action.label).toBe("Sales Decision");
    expect(action.initial).toEqual({
      queryId: "query_1",
      salesStatus: "Proposal in discussion",
      salesDecision: "Proposal in discussion",
      leadStage: "Qualified",
      contractingStatus: "Proposal in progress",
      budgetAmount: "250000",
      contractingLandCost: "12000",
      contractingAirlinesCost: "8000",
      contractingVisaCost: "1500",
      approxMargin: "18000",
      lostReason: "Budget",
    });
  });

  test("contracting-only users open query status with contracting cost fields", () => {
    const action = buildQueryStatusAction(sampleRow, hasPermissions([P.MANAGE_CONTRACTING]));

    expect(action.modal).toBe("queryStatus");
    expect(action.label).toBe("Status");
    expect(action.initial.contractingLandCost).toBe("12000");
    expect(action.initial.contractingAirlinesCost).toBe("8000");
    expect(action.initial.contractingVisaCost).toBe("1500");
    expect(action.initial.budgetAmount).toBe("250000");
    expect(action.initial.approxMargin).toBe("18000");
  });

  test("dual-permission users prefer Sales Decision over contracting status", () => {
    const action = buildQueryStatusAction(
      sampleRow,
      hasPermissions([P.MANAGE_QUERIES, P.MANAGE_CONTRACTING]),
    );

    expect(action.modal).toBe("salesDecision");
    expect(action.label).toBe("Sales Decision");
    expect(action.initial.salesDecision).toBe("Proposal in discussion");
    expect(action.initial.lostReason).toBe("Budget");
  });
});
