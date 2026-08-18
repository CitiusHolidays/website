import { describe, expect, test } from "bun:test";
import { authAccountSummary } from "./betterAuthLookup";

describe("AuthAccountSummary", () => {
  test("Detects credential and Google providers", () => {
    expect(
      authAccountSummary([
        { providerId: "google" },
        { password: "hashed", providerId: "credential" },
      ])
    ).toEqual({ hasCredential: true, hasGoogle: true });
  });

  test("Treats credential without password as no email login", () => {
    expect(authAccountSummary([{ password: null, providerId: "credential" }])).toEqual({
      hasCredential: false,
      hasGoogle: false,
    });
  });
});
