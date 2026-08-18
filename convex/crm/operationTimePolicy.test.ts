import { describe, expect, test } from "bun:test";
import {
  isOperationArtifactExpired,
  isOperationStalled,
  OPERATION_STALL_THRESHOLD_MS,
} from "./operationTimePolicy";

describe("Operation time policy", () => {
  test("Changes running operations to stalled only just after two minutes", () => {
    const updatedAt = 1_000_000;
    expect(isOperationStalled("running", updatedAt, updatedAt + OPERATION_STALL_THRESHOLD_MS)).toBe(
      false
    );
    expect(
      isOperationStalled("running", updatedAt, updatedAt + OPERATION_STALL_THRESHOLD_MS + 1)
    ).toBe(true);
    expect(
      isOperationStalled("completed", updatedAt, updatedAt + OPERATION_STALL_THRESHOLD_MS + 1)
    ).toBe(false);
  });

  test("Changes an export artifact at its exact expiry boundary", () => {
    expect(isOperationArtifactExpired(2000, 1999)).toBe(false);
    expect(isOperationArtifactExpired(2000, 2000)).toBe(true);
    expect(isOperationArtifactExpired(undefined, 3000)).toBe(false);
  });
});
