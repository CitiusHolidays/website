import { describe, expect, test } from "bun:test";
import { withoutIdentityDocuments } from "./bookingTravellerDocuments";

describe("Kept booking traveller details after account deletion", () => {
  test("removes passport, expiry, national ID and birth date fields and keeps the rest", () => {
    const details = [
      {
        dateOfBirth: "1990-01-01",
        email: "lead@example.invalid",
        name: "Synthetic Lead",
        nationality: "Indian",
        passport: { expiry: "2030-01-01", number: "P1234567" },
        passport_number: "P1234567",
        passportExpiry: "2030-01-01",
        phone: "+910000000001",
      },
      {
        aadhaarNumber: "0000 0000 0000",
        DOB: "2015-05-05",
        documents: { idNumber: "D-3", type: "passport" },
        fullName: "Synthetic Child",
        "National ID": "X-1",
        nationalityId: "N-2",
      },
    ];

    const { removed, value } = withoutIdentityDocuments(details);

    expect(value).toEqual([
      {
        email: "lead@example.invalid",
        name: "Synthetic Lead",
        nationality: "Indian",
        phone: "+910000000001",
      },
      { documents: { type: "passport" }, fullName: "Synthetic Child" },
    ]);
    expect(removed).toBe(9);
  });

  test("leaves details without identity documents unchanged", () => {
    expect(withoutIdentityDocuments([{ name: "A" }])).toEqual({
      removed: 0,
      value: [{ name: "A" }],
    });
    expect(withoutIdentityDocuments(null)).toEqual({ removed: 0, value: null });
    expect(withoutIdentityDocuments("free text")).toEqual({ removed: 0, value: "free text" });
  });
});
