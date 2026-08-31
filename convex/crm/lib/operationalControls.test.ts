import { describe, expect, test } from "bun:test";
import {
  OPERATIONAL_CONTROL_AVAILABLE_KEYS,
  OPERATIONAL_CONTROL_CATALOG,
  OPERATIONAL_CONTROL_KEYS,
  operationalControlKeyValidator,
} from "./operationalControls";

describe("operational control catalog contract", () => {
  test("derives the key list and validator from the one backend catalog owner", () => {
    const catalogKeys = OPERATIONAL_CONTROL_CATALOG.map((entry) => entry.key);
    const validatorKeys = operationalControlKeyValidator.json.value.map((member) => {
      if (member.type !== "literal") {
        throw new Error("Operational control key validator must contain only string literals.");
      }
      return member.value;
    });

    expect(OPERATIONAL_CONTROL_KEYS).toEqual(catalogKeys);
    expect(validatorKeys).toEqual(catalogKeys);
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
    expect(catalogKeys).toHaveLength(27);
    expect(OPERATIONAL_CONTROL_AVAILABLE_KEYS).toHaveLength(26);
    expect(OPERATIONAL_CONTROL_AVAILABLE_KEYS).not.toContain("ai.journey_planner");
  });

  test("keeps every declared dependency inside the same catalog", () => {
    const keys = new Set(OPERATIONAL_CONTROL_KEYS);
    expect(
      OPERATIONAL_CONTROL_CATALOG.flatMap((entry) => entry.dependencies).every((key) =>
        keys.has(key)
      )
    ).toBe(true);
  });

  test("owns the Sent reminder boundary and keeps Journey Planner historical-only", () => {
    expect(
      OPERATIONAL_CONTROL_CATALOG.find(
        (entry) => entry.key === "messaging.customer_journey_reminders"
      )
    ).toMatchObject({
      availability: "available",
      dependencies: [],
      standardEnabled: true,
    });
    expect(
      OPERATIONAL_CONTROL_CATALOG.find((entry) => entry.key === "ai.journey_planner")
    ).toMatchObject({
      availability: "unavailable",
      standardEnabled: false,
      unavailableReason: expect.stringContaining("retired"),
    });
  });
});
