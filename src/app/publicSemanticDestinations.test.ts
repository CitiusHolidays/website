import { describe, expect, test } from "bun:test";
import { getPublicOffices } from "@/data/publicContacts";
import { PUBLIC_DESTINATIONS } from "@/data/publicDestinations";
import { readDestinationPlan } from "@/lib/public/destinationPlan";
import { POLICY_VIEW_HREFS, resolvePolicyView } from "./(public)/policies/policyView";

const DIAL_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const NON_DIGIT_PATTERN = /\D/g;

describe("Public destinations", () => {
  test("Editorial destination records carry no synthetic popularity or rank metrics", () => {
    expect(PUBLIC_DESTINATIONS).toHaveLength(10);
    expect(
      readDestinationPlan(
        JSON.stringify({
          catalogVersion: "2026-08-12",
          draft: {},
          schemaVersion: 2,
          shortlist: [{ id: "japan", name: "Japan", region: "international" }],
        })
      ).status
    ).toBe("ready");
    for (const destination of PUBLIC_DESTINATIONS) {
      expect(destination).not.toHaveProperty("percentage");
      expect(destination).not.toHaveProperty("rank");
    }
  });

  test("General offices preserve each surface order and expose independently valid dial values", () => {
    const contactOffices = getPublicOffices("contact");
    const footerOffices = getPublicOffices("footer");

    expect(contactOffices.map(({ city }) => city)).toEqual(["Kolkata", "Mumbai", "Bengaluru"]);
    expect(footerOffices.map(({ city }) => city)).toEqual(["Mumbai", "Bengaluru", "Kolkata"]);
    expect(contactOffices.map(({ displayPhone }) => displayPhone)).toEqual([
      "+91 98310 82929",
      "+91 9920993259",
      "+91 99008 14292",
    ]);

    for (const office of contactOffices) {
      expect(office.dialPhone).toMatch(DIAL_PHONE_PATTERN);
      expect(office.dialPhone).toBe(`+${office.displayPhone.replace(NON_DIGIT_PATTERN, "")}`);
      expect(office.address.contact.length).toBeGreaterThan(0);
      expect(office.address.footer.length).toBeGreaterThan(0);
    }
  });
  test("Policy URL values resolve billing explicitly and default every other state to Terms", () => {
    expect(POLICY_VIEW_HREFS).toEqual({
      billing: "/policies?view=billing",
      terms: "/policies?view=terms",
    });
    expect(resolvePolicyView("billing")).toBe("billing");
    expect(resolvePolicyView("terms")).toBe("terms");
    expect(resolvePolicyView(undefined)).toBe("terms");
    expect(resolvePolicyView("")).toBe("terms");
    expect(resolvePolicyView("privacy")).toBe("terms");
  });
});
