import { describe, expect, test } from "bun:test";
import {
  canMoveContractingPipelineForAccess,
  canMoveSalesPipelineForAccess,
} from "./pipelineMovementAccess";

describe("Pipeline movement access presentation", () => {
  test("Shows Sales movement only with permission and a Sales authority role", () => {
    expect(canMoveSalesPipelineForAccess(true, ["Sales"])).toBe(true);
    expect(canMoveSalesPipelineForAccess(false, ["Sales"])).toBe(false);
    expect(canMoveSalesPipelineForAccess(true, ["Contracting"])).toBe(false);
  });

  test("Shows Contracting handoff to assigned workflow roles", () => {
    expect(canMoveContractingPipelineForAccess(true, ["Contracting"])).toBe(true);
    expect(canMoveContractingPipelineForAccess(true, ["Ticketing"])).toBe(true);
    expect(canMoveContractingPipelineForAccess(true, ["Directors"])).toBe(true);
    expect(canMoveContractingPipelineForAccess(false, ["Contracting"])).toBe(false);
    expect(canMoveContractingPipelineForAccess(true, ["Sales"])).toBe(false);
  });
});
