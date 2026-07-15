import { describe, expect, test } from "bun:test";
import {
  canMovePipelineCard,
  getAllowedSalesPipelineBoardTargets,
  isSalesPipelineBoardLocked,
} from "./salesPipelinePolicy";

describe("Sales Pipeline client affordance policy", () => {
  test("matches adjacent routine stages and excludes Sales Decision outcomes", () => {
    expect(getAllowedSalesPipelineBoardTargets("Inquiry")).toEqual(["Proposal"]);
    expect(getAllowedSalesPipelineBoardTargets("Proposal")).toEqual(["Inquiry", "Negotiation"]);
    expect(getAllowedSalesPipelineBoardTargets("Negotiation")).toEqual(["Proposal"]);
    expect(getAllowedSalesPipelineBoardTargets("Confirmation")).toEqual([]);
    expect(canMovePipelineCard({ leadStage: "Proposal" }, "Negotiation")).toBe(true);
    expect(canMovePipelineCard({ leadStage: "Proposal" }, "Confirmation")).toBe(false);
  });

  test("locks terminal and revision workflow records", () => {
    expect(isSalesPipelineBoardLocked({ salesStatus: "Order Confirmed" })).toBe(true);
    expect(isSalesPipelineBoardLocked({ salesStatus: "Order Lost" })).toBe(true);
    expect(isSalesPipelineBoardLocked({ salesStatus: "Date/Destination Change Required" })).toBe(
      true
    );
  });
});
