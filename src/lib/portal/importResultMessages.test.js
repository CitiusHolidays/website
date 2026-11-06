import { describe, expect, test } from "bun:test";
import { buildPassengerImportResultMessage } from "./importResultMessages";

describe("BuildPassengerImportResultMessage", () => {
  const result = { created: 3, failed: 0, total: 4, updated: 1 };

  test("Returns isPartialFailure false when failed is 0", () => {
    const output = buildPassengerImportResultMessage(result, "Passenger import complete");
    expect(output.failed).toBe(0);
    expect(output.isPartialFailure).toBe(false);
    expect(output.message).toBe(
      "Passenger import complete. Created 3, updated 1, total processed 4."
    );
  });

  test("Returns isPartialFailure true and includes failed count", () => {
    const output = buildPassengerImportResultMessage(
      { ...result, failed: 2 },
      "Passenger import complete"
    );
    expect(output.failed).toBe(2);
    expect(output.isPartialFailure).toBe(true);
    expect(output.message).toContain("2 rows failed");
    expect(output.message).toContain("Created 3, updated 1, total processed 4.");
  });

  test("Preserves room summary text", () => {
    const output = buildPassengerImportResultMessage(
      result,
      "Passenger import complete",
      "Twin: 2, Single: 1"
    );
    expect(output.message).toContain("Room summary: Twin: 2, Single: 1");
  });

  test("Includes room summary on partial failure", () => {
    const output = buildPassengerImportResultMessage(
      { ...result, failed: 1 },
      "Passenger import complete",
      "Twin: 2"
    );
    expect(output.isPartialFailure).toBe(true);
    expect(output.message).toContain("1 row failed");
    expect(output.message).toContain("Room summary: Twin: 2");
  });

  test("Reports guardian links and unlinked guardian references", () => {
    const output = buildPassengerImportResultMessage(
      {
        ...result,
        guardianLinks: {
          linked: 2,
          warnings: [{ fullName: "Isha Rao", message: "Guardian Anil Rao not linked" }],
        },
      },
      "Passenger import complete"
    );
    expect(output.isPartialFailure).toBe(false);
    expect(output.message).toBe(
      "Passenger import complete. Created 3, updated 1, total processed 4. Linked 2 minors to a guardian; 1 guardian reference needs review."
    );
  });
});
