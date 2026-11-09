import { describe, expect, test } from "bun:test";
import { options } from "./auth";

describe("Better Auth sign-in policy", () => {
  test("links Google into an email/password account only after its email is verified", () => {
    const linking = options.account.accountLinking;
    expect(linking.enabled).toBe(true);
    expect(linking.allowDifferentEmails).toBe(false);
    expect(linking.trustedProviders).toBeArray();
    expect(linking.requireLocalEmailVerified).toBe(true);
  });
});
