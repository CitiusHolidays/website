import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TravellerGuardianDetails, TravellerMobileCard } from "./TravellersView";

const plain = (markup) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const text = (row) =>
  plain(
    renderToStaticMarkup(
      <TravellerGuardianDetails row={{ fullName: "Synthetic", id: "t1", ...row }} />
    )
  );
const mobileCard = (row) =>
  plain(
    renderToStaticMarkup(
      <TravellerMobileCard
        row={{
          fullName: "Synthetic",
          id: "t1",
          jobCode: "JC/1",
          visaStatus: "Not Required",
          ...row,
        }}
      />
    )
  );
const consent = {
  note: "",
  receivedAt: Date.parse("2026-11-07T12:00:00Z"),
  recordedByName: "Synthetic Ops Lead",
};

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
    ).toBe("Minor Guardians: Meera Iyer, Ravi Iyer Consent pending");
    expect(text({ guardians: [{ fullName: "Meera Iyer", id: "g1" }], isMinor: true })).toBe(
      "Minor Guardian: Meera Iyer Consent pending"
    );
    expect(text({ guardians: [], isMinor: true })).toBe("Minor No guardian linked Consent pending");
  });

  test("Shows sheet guardians that did not match next to the linked one", () => {
    expect(
      text({
        guardianSheetReferences: ["Anil Rao"],
        guardians: [{ fullName: "Meera Iyer", id: "g1" }],
        isMinor: true,
      })
    ).toBe("Minor Guardian: Meera Iyer Sheet guardian not matched: Anil Rao Consent pending");
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

  test("Shows parental consent as received or pending on minors only", () => {
    expect(text({ guardians: [], isMinor: true, parentalConsent: consent })).toBe(
      "Minor No guardian linked Consent received"
    );
    expect(text({ isMinor: true, parentalConsent: null })).toContain("Consent pending");
    expect(text({ isMinor: false, parentalConsent: null })).toBe("Adult");
    expect(text({ isMinor: null, parentalConsent: null })).toBe("-");
    expect(
      text({ guardianOf: [{ fullName: "Kavya Iyer", id: "m1" }], isMinor: false })
    ).not.toContain("Consent");
  });

  test("Shows the consent state on the mobile card for minors only", () => {
    expect(mobileCard({ isMinor: true, parentalConsent: consent })).toContain("Consent received");
    expect(mobileCard({ isMinor: true, parentalConsent: null })).toContain("Consent pending");
    expect(mobileCard({ isMinor: false, parentalConsent: null })).not.toContain("Consent");
    expect(
      mobileCard({ guardianOf: [{ fullName: "Kavya Iyer", id: "m1" }], isMinor: false })
    ).not.toContain("Consent");
  });
});
