import { describe, expect, test } from "bun:test";
import { buildQueryStatusPatch } from "./queryStatusPolicy";
import {
  formatTravelBatchCode,
  nextTravelBatchIdentity,
  parseTravelBatchSequence,
} from "./travelBatchPolicy";

describe("Query and job card rules", () => {
  test("Travel batch identity sequencing stays deterministic", () => {
    expect(formatTravelBatchCode(3)).toBe("B03");
    expect(parseTravelBatchSequence("B03")).toBe(3);
    expect(nextTravelBatchIdentity("JC-0001-NS", [{ batchCode: "B02" }])).toEqual({
      batchCode: "B03",
      batchReference: "JC-0001-NS / B03",
    });
  });

  test("Builds the Sales Decision status patch", () => {
    const patch = buildQueryStatusPatch({
      args: {
        commandId: "66666666-6666-4666-8666-666666666666",
        proposalId: "proposal_1",
        proposalRevision: 1,
        queryId: "queries_1",
        salesStatus: "Order Confirmed",
      },
      now: 42,
    });
    expect(patch).toMatchObject({
      confirmedAt: 42,
      contractingStatus: "Order Confirmed",
      leadStage: "Confirmation",
      salesStatus: "Order Confirmed",
    });
  });
});
