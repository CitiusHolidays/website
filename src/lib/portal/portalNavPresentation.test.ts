import { describe, expect, test } from "bun:test";
import { getCompactRoleLabel } from "./portalNavPresentation";

describe("Portal navigation presentation", () => {
  test("Keeps the primary role visible when a user has multiple roles", () => {
    expect(getCompactRoleLabel([])).toBe("Staff");
    expect(getCompactRoleLabel(["Sales"])).toBe("Sales");
    expect(getCompactRoleLabel(["Sales", "Ticketing", "Operations"])).toBe("Sales +2");
  });
});
