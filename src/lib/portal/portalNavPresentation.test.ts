import { describe, expect, test } from "bun:test";
import { getCompactRoleLabel, getMobileQuickNavigation } from "./portalNavPresentation";

describe("portal navigation presentation", () => {
  test("keeps the primary role visible when a user has multiple roles", () => {
    expect(getCompactRoleLabel([])).toBe("Staff");
    expect(getCompactRoleLabel(["Sales"])).toBe("Sales");
    expect(getCompactRoleLabel(["Sales", "Ticketing", "Operations"])).toBe("Sales +2");
  });

  test("prioritizes accessible common destinations for the mobile drawer", () => {
    expect(
      getMobileQuickNavigation([
        {
          items: [
            { href: "/portal/job-cards", label: "Job Cards" },
            { href: "/portal/travellers", label: "Traveller Master" },
          ],
        },
        {
          items: [
            { href: "/portal", label: "Dashboard" },
            { href: "/portal/queries", label: "All Sales Queries" },
          ],
        },
      ])
    ).toEqual([
      { href: "/portal", label: "Dashboard" },
      { href: "/portal/queries", label: "All Sales Queries" },
      { href: "/portal/job-cards", label: "Job Cards" },
      { href: "/portal/travellers", label: "Traveller Master" },
    ]);
  });
});
