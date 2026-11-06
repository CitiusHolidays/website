import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TravellerGuardianDetails } from "./TravellersView";

const text = (row) =>
  renderToStaticMarkup(
    <TravellerGuardianDetails row={{ fullName: "Synthetic", id: "t1", ...row }} />
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("Traveller guardian cell", () => {
  test("Names the guardian on a minor, or says none is linked", () => {
    expect(text({ guardian: { fullName: "Meera Iyer", id: "g1" }, isMinor: true })).toBe(
      "Minor Guardian: Meera Iyer"
    );
    expect(text({ guardian: null, isMinor: true })).toBe("Minor No guardian linked");
    expect(text({ guardian: null, guardianSheetReference: "Anil Rao", isMinor: true })).toBe(
      "Minor Sheet guardian not matched: Anil Rao"
    );
  });

  test("Lists the minors a guardian covers and stays quiet otherwise", () => {
    expect(
      text({
        guardianOf: [
          { fullName: "Kavya Iyer", id: "m1" },
          { fullName: "Rohan Iyer", id: "m2" },
        ],
        isMinor: false,
      })
    ).toBe("Guardian of Kavya Iyer, Rohan Iyer");
    expect(text({ isMinor: false })).toBe("Adult");
    expect(text({ isMinor: null })).toBe("-");
  });
});
