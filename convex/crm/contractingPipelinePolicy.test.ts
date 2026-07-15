import { describe, expect, test } from "bun:test";
import {
  assertContractingPipelineBoardMove,
  getAllowedContractingPipelineBoardTargets,
  isContractingPipelineBoardLocked,
} from "./contractingPipelinePolicy";

describe("Contracting Pipeline Policy", () => {
  test("only offers the existing Send to Sales handoff", () => {
    expect(getAllowedContractingPipelineBoardTargets("Query Received")).toEqual([]);
    expect(getAllowedContractingPipelineBoardTargets("Proposal in progress")).toEqual([
      "Proposal sent",
    ]);
    expect(getAllowedContractingPipelineBoardTargets("Proposal sent")).toEqual([]);
  });

  test("accepts Proposal in progress to Proposal sent", () => {
    expect(() =>
      assertContractingPipelineBoardMove({
        currentStage: "Proposal in progress",
        query: { contractingStatus: "Proposal in progress" },
        targetStage: "Proposal sent",
      })
    ).not.toThrow();
  });

  test("requires proposal creation before board movement", () => {
    expect(() =>
      assertContractingPipelineBoardMove({
        currentStage: "Query Received",
        query: { contractingStatus: "Query Received" },
        targetStage: "Proposal in progress",
      })
    ).toThrow("Create the proposal before moving this query");
  });

  test.each([
    "Date/Destination Change Required",
    "Order Confirmed",
    "Order Lost",
  ])("locks Sales Decision outcome %s", (contractingStatus) => {
    const query = { contractingStatus };
    expect(isContractingPipelineBoardLocked(query)).toBe(true);
    expect(() =>
      assertContractingPipelineBoardMove({
        currentStage: contractingStatus,
        query,
        targetStage: "Proposal sent",
      })
    ).toThrow("Use Sales Decision");
  });
});
