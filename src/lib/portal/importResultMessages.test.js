import { describe, expect, test } from "bun:test";
import { buildPassengerImportResultMessage } from "./importResultMessages";

describe("buildPassengerImportResultMessage", () => {
  const result = { created: 3, failed: 0, total: 4, updated: 1 };

  test("returns isPartialFailure false when failed is 0", () => {
    const output = buildPassengerImportResultMessage(result, "Passenger import complete");
    expect(output.failed).toBe(0);
    expect(output.isPartialFailure).toBe(false);
    expect(output.message).toBe(
      "Passenger import complete. Created 3, updated 1, total processed 4."
    );
  });

  test("returns isPartialFailure true and includes failed count", () => {
    const output = buildPassengerImportResultMessage(
      { ...result, failed: 2 },
      "Passenger import complete"
    );
    expect(output.failed).toBe(2);
    expect(output.isPartialFailure).toBe(true);
    expect(output.message).toContain("2 row(s) failed");
    expect(output.message).toContain("Created 3, updated 1, total processed 4.");
  });

  test("preserves room summary text", () => {
    const output = buildPassengerImportResultMessage(
      result,
      "Passenger import complete",
      "Twin: 2, Single: 1"
    );
    expect(output.message).toContain("Room summary: Twin: 2, Single: 1");
  });

  test("includes room summary on partial failure", () => {
    const output = buildPassengerImportResultMessage(
      { ...result, failed: 1 },
      "Passenger import complete",
      "Twin: 2"
    );
    expect(output.isPartialFailure).toBe(true);
    expect(output.message).toContain("1 row(s) failed");
    expect(output.message).toContain("Room summary: Twin: 2");
  });
});
