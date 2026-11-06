import { describe, expect, test } from "bun:test";
import { travellerGuardianPayload } from "./operations";

describe("Traveller guardian form payload", () => {
  test("Maps the age group to minor status, clearing it when not recorded", () => {
    expect(travellerGuardianPayload({ ageGroup: "minor" })).toEqual({ isMinor: true });
    expect(travellerGuardianPayload({ ageGroup: "adult" })).toEqual({ isMinor: false });
    expect(travellerGuardianPayload({ ageGroup: "" })).toEqual({ isMinor: null });
  });

  test("Sends a guardian only when Operations changed it on an existing minor", () => {
    const saved = { ageGroup: "minor", entityId: "t1", initialGuardianTravellerId: "g1" };
    expect(travellerGuardianPayload({ ...saved, guardianTravellerId: "g1" })).toEqual({
      isMinor: true,
    });
    expect(travellerGuardianPayload({ ...saved, guardianTravellerId: "g2" })).toEqual({
      guardianTravellerId: "g2",
      isMinor: true,
    });
    expect(travellerGuardianPayload({ ...saved, guardianTravellerId: "" })).toEqual({
      guardianTravellerId: null,
      isMinor: true,
    });
    expect(travellerGuardianPayload({ ageGroup: "minor", guardianTravellerId: "g1" })).toEqual({
      isMinor: true,
    });
  });
});
