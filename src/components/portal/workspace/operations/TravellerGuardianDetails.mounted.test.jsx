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
  test("Names both guardians on a minor, or says none is linked", () => {
    expect(
      text({
        guardians: [
          { fullName: "Meera Iyer", id: "g1" },
          { fullName: "Ravi Iyer", id: "g2" },
        ],
        isMinor: true,
      })
    ).toBe("Minor Guardians: Meera Iyer, Ravi Iyer");
    expect(text({ guardians: [{ fullName: "Meera Iyer", id: "g1" }], isMinor: true })).toBe(
      "Minor Guardian: Meera Iyer"
    );
    expect(text({ guardians: [], isMinor: true })).toBe("Minor No guardian linked");
  });

  test("Shows sheet guardians that did not match next to the linked one", () => {
    expect(
      text({
        guardianSheetReferences: ["Anil Rao"],
        guardians: [{ fullName: "Meera Iyer", id: "g1" }],
        isMinor: true,
      })
    ).toBe("Minor Guardian: Meera Iyer Sheet guardian not matched: Anil Rao");
    expect(text({ guardianSheetReferences: ["Anil Rao", "Asha Rao"], isMinor: null })).toBe(
      "Age not recorded · sheet guardians: Anil Rao, Asha Rao"
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
