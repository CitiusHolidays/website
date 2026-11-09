import { describe, expect, test } from "bun:test";
import { getAuthVariant, verificationCallbackHref } from "./auth-sign-in-targets";

describe("verificationCallbackHref", () => {
  test("sends a traveller's link on to their Travel Account destination", () => {
    expect(verificationCallbackHref(getAuthVariant("guest"), "/account?tab=trips")).toBe(
      "/auth/email-verified?from=guest&next=%2Faccount%3Ftab%3Dtrips"
    );
  });

  test("keeps staff and vendor links on the verified page with no destination", () => {
    expect(verificationCallbackHref(getAuthVariant("employee"), "/portal")).toBe(
      "/auth/email-verified?from=connect"
    );
    expect(verificationCallbackHref(getAuthVariant("vendor"), "/vendor")).toBe(
      "/auth/email-verified?from=vendor"
    );
  });
});
