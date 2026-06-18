import { describe, expect, test } from "bun:test";
import { buildTravellerCountSummary } from "./travellerSummary";

describe("buildTravellerCountSummary", () => {
  test("counts gender and food preferences from filtered traveller rows", () => {
    expect(
      buildTravellerCountSummary([
        { gender: "Male", foodPreference: "Veg" },
        { gender: "F", foodPreference: "Jain" },
        { gender: "female", foodPreference: "Veg" },
        { gender: "M", foodPreference: "No Onion" },
        { gender: "MALE", foodPreference: "Veg" },
        { gender: "FEMALE", foodPreference: "Non-Veg" },
      ]),
    ).toEqual({
      male: 3,
      female: 3,
      foodRows: [
        { label: "Veg", value: 3 },
        { label: "Non-Veg", value: 1 },
        { label: "Jain", value: 1 },
        { label: "Vegan", value: 0 },
        { label: "No Onion", value: 1 },
      ],
    });
  });
});
