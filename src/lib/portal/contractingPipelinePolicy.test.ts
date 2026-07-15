import { describe, expect, test } from "bun:test";
import {
  getAllowedContractingPipelineBoardTargets,
  isContractingPipelineBoardLocked,
} from "./contractingPipelinePolicy";

describe("Contracting Pipeline Presentation Policy", () => {
  test("exposes only Proposal in progress to Proposal sent", () => {
    expect(getAllowedContractingPipelineBoardTargets("Query Received")).toEqual([]);
    expect(getAllowedContractingPipelineBoardTargets("Proposal in progress")).toEqual([
      "Proposal sent",
    ]);
    expect(getAllowedContractingPipelineBoardTargets("Proposal sent")).toEqual([]);
  });

  test("locks terminal and revision records", () => {
    expect(isContractingPipelineBoardLocked({ contractingStatus: "Order Confirmed" })).toBe(true);
    expect(
      isContractingPipelineBoardLocked({ salesStatus: "Date/Destination Change Required" })
    ).toBe(true);
  });
});
