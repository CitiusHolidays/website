import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "./constants.js";
import { buildQueryStatusAction } from "./queryStatusAction.js";

const sampleRow = {
  approxMargin: 18_000,
  budgetAmount: 250_000,
  contractingAirlinesCost: 8000,
  contractingLandCost: 12_000,
  contractingStatus: "Proposal in progress",
  contractingVisaCost: 1500,
  id: "query_1",
  leadStage: "Qualified",
  lostReason: "Budget",
  salesStatus: "Proposal in discussion",
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
      approxMargin: "18000",
      budgetAmount: "250000",
      contractingAirlinesCost: "8000",
      contractingLandCost: "12000",
      contractingStatus: "Proposal in progress",
      contractingVisaCost: "1500",
      leadStage: "Qualified",
      lostReason: "Budget",
      queryId: "query_1",
      salesDecision: "Proposal in discussion",
      salesStatus: "Proposal in discussion",
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
      hasPermissions([P.MANAGE_QUERIES, P.MANAGE_CONTRACTING])
    );

    expect(action.modal).toBe("salesDecision");
    expect(action.label).toBe("Sales Decision");
    expect(action.initial.salesDecision).toBe("Proposal in discussion");
    expect(action.initial.lostReason).toBe("Budget");
  });
});
