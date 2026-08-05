import { describe, expect, test } from "bun:test";
import { authIdentityCandidates, canonicalAuthUserId, legacyAuthUserId } from "./authIdentity";

describe("canonical auth identity seam", () => {
  test("prefers the issuer-qualified token identifier", () => {
    const identity = { subject: "legacy-subject", tokenIdentifier: "issuer|subject" };
    expect(canonicalAuthUserId(identity)).toBe("issuer|subject");
    expect(legacyAuthUserId(identity)).toBe("legacy-subject");
  });

  test("keeps subject fallback explicit for the dual-read migration window", () => {
    expect(canonicalAuthUserId({ subject: "legacy-subject" })).toBe("legacy-subject");
    expect(canonicalAuthUserId({ subject: "", tokenIdentifier: " " })).toBeNull();
    expect(legacyAuthUserId({ tokenIdentifier: "issuer|subject" })).toBeNull();
  });

  test("returns canonical then legacy candidates once each", () => {
    expect(
      authIdentityCandidates({ subject: "legacy-subject", tokenIdentifier: "issuer|subject" })
    ).toEqual(["issuer|subject", "legacy-subject"]);
    expect(
      authIdentityCandidates({ subject: "same-subject", tokenIdentifier: "same-subject" })
    ).toEqual(["same-subject"]);
    expect(authIdentityCandidates({ subject: " ", tokenIdentifier: "" })).toEqual([]);
  });
});
