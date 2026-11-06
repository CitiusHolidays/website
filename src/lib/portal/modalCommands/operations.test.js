import { describe, expect, test } from "bun:test";
import { travellerGuardianPayload } from "./operations";

describe("Traveller guardian form payload", () => {
  test("Maps the age group to minor status, clearing it when not recorded", () => {
    expect(travellerGuardianPayload({ ageGroup: "minor" })).toEqual({ isMinor: true });
    expect(travellerGuardianPayload({ ageGroup: "adult" })).toEqual({ isMinor: false });
    expect(travellerGuardianPayload({ ageGroup: "" })).toEqual({ isMinor: null });
  });

  test("Sends both guardians only when Operations changed them on an existing minor", () => {
    const saved = {
      ageGroup: "minor",
      entityId: "t1",
      guardianTravellerId: "g1",
      initialGuardianTravellerIds: "g1,g2",
      secondGuardianTravellerId: "g2",
    };
    expect(travellerGuardianPayload(saved)).toEqual({ isMinor: true });
    expect(travellerGuardianPayload({ ...saved, secondGuardianTravellerId: "g3" })).toEqual({
      guardianTravellerIds: ["g1", "g3"],
      isMinor: true,
    });
    expect(travellerGuardianPayload({ ...saved, guardianTravellerId: "" })).toEqual({
      guardianTravellerIds: ["g2"],
      isMinor: true,
    });
    expect(
      travellerGuardianPayload({ ...saved, guardianTravellerId: "", secondGuardianTravellerId: "" })
    ).toEqual({ guardianTravellerIds: [], isMinor: true });
    expect(travellerGuardianPayload({ ageGroup: "minor", guardianTravellerId: "g1" })).toEqual({
      isMinor: true,
    });
  });
});
