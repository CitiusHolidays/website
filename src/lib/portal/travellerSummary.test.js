import { describe, expect, test } from "bun:test";
import { buildTravellerCountSummary } from "./travellerSummary";

describe("buildTravellerCountSummary", () => {
  test("counts gender and food preferences from filtered traveller rows", () => {
    expect(
      buildTravellerCountSummary([
        { foodPreference: "Veg", gender: "Male" },
        { foodPreference: "Jain", gender: "F" },
        { foodPreference: "Veg", gender: "female" },
        { foodPreference: "No Onion", gender: "M" },
        { foodPreference: "Veg", gender: "MALE" },
        { foodPreference: "Non-Veg", gender: "FEMALE" },
      ])
    ).toEqual({
      female: 3,
      foodRows: [
        { label: "Veg", value: 3 },
        { label: "Non-Veg", value: 1 },
        { label: "Jain", value: 1 },
        { label: "Vegan", value: 0 },
        { label: "No Onion", value: 1 },
      ],
      male: 3,
    });
  });
});
