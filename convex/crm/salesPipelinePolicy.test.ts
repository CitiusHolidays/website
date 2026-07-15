import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  assertSalesPipelineBoardMove,
  getAllowedSalesPipelineBoardTargets,
  isSalesPipelineBoardLocked,
  resolveSalesPipelineStage,
} from "./salesPipelinePolicy";

describe("sales pipeline board policy", () => {
  test("resolves lead stage from stored leadStage first", () => {
    expect(resolveSalesPipelineStage({ leadStage: "Negotiation" })).toBe("Negotiation");
    expect(resolveSalesPipelineStage({ leadStage: "Closed" })).toBe("Lost");
  });

  test("falls back to workflow statuses when leadStage is missing", () => {
    expect(resolveSalesPipelineStage({ contractingStatus: "Proposal sent" })).toBe("Proposal");
    expect(
      resolveSalesPipelineStage({ contractingStatus: "Date/Destination Change Required" })
    ).toBe("Negotiation");
    expect(resolveSalesPipelineStage({ salesStatus: "Order Confirmed" })).toBe("Confirmation");
    expect(resolveSalesPipelineStage({ salesStatus: "Order Lost" })).toBe("Lost");
  });

  test("locks confirmed, lost, and revision outcomes out of board movement", () => {
    expect(isSalesPipelineBoardLocked({ salesStatus: "Order Confirmed" })).toBe(true);
    expect(isSalesPipelineBoardLocked({ salesStatus: "Order Lost" })).toBe(true);
    expect(isSalesPipelineBoardLocked({ salesStatus: "Date/Destination Change Required" })).toBe(
      true
    );
    expect(isSalesPipelineBoardLocked({ leadStage: "Confirmation" })).toBe(true);
    expect(isSalesPipelineBoardLocked({ leadStage: "Lost" })).toBe(true);
    expect(isSalesPipelineBoardLocked({ leadStage: "Proposal" })).toBe(false);
  });

  test("allows only routine stage transitions", () => {
    expect(getAllowedSalesPipelineBoardTargets("Inquiry")).toEqual(["Proposal"]);
    expect(getAllowedSalesPipelineBoardTargets("Proposal")).toEqual(["Inquiry", "Negotiation"]);
    expect(getAllowedSalesPipelineBoardTargets("Negotiation")).toEqual(["Proposal"]);
    expect(getAllowedSalesPipelineBoardTargets("Confirmation")).toEqual([]);
  });

  test("rejects Sales Decision outcomes and forbidden targets", () => {
    expect(() =>
      assertSalesPipelineBoardMove({
        currentStage: "Proposal",
        query: { leadStage: "Proposal" },
        targetStage: "Confirmation",
      })
    ).toThrow(new ConvexError("That pipeline stage must be set through Sales Decision."));

    expect(() =>
      assertSalesPipelineBoardMove({
        currentStage: "Proposal",
        query: { leadStage: "Proposal" },
        targetStage: "Lost",
      })
    ).toThrow(new ConvexError("That pipeline stage must be set through Sales Decision."));

    expect(() =>
      assertSalesPipelineBoardMove({
        currentStage: "Proposal",
        query: { salesStatus: "Order Confirmed" },
        targetStage: "Negotiation",
      })
    ).toThrow(new ConvexError("Use Sales Decision for confirmed, lost, or revision outcomes."));

    expect(() =>
      assertSalesPipelineBoardMove({
        currentStage: "Inquiry",
        query: { leadStage: "Inquiry" },
        targetStage: "Negotiation",
      })
    ).toThrow(new ConvexError("That pipeline move is not allowed."));
  });

  test("rejects no-op moves", () => {
    expect(() =>
      assertSalesPipelineBoardMove({
        currentStage: "Proposal",
        query: { leadStage: "Proposal" },
        targetStage: "Proposal",
      })
    ).toThrow(new ConvexError("Query is already in that pipeline stage."));
  });
});
