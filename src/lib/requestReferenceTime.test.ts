import { describe, expect, test } from "bun:test";
import { captureRequestReferenceNow } from "./requestReferenceTime";

describe("Request reference time", () => {
  test("Captures one finite integer millisecond input for request-owned reads", () => {
    const referenceNow = captureRequestReferenceNow();
    expect(Number.isSafeInteger(referenceNow)).toBe(true);
    expect(referenceNow).toBeGreaterThan(0);
  });
});
