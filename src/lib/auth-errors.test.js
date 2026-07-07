import { describe, expect, test } from "bun:test";
import { formatAuthApiError, formatAuthCallbackError } from "./auth-errors";

describe("formatAuthCallbackError", () => {
  test("maps OAuth link failures to actionable copy", () => {
    expect(formatAuthCallbackError("account%20not%20linked")).toContain("Forgot password");
  });

  test("returns empty string when no error", () => {
    expect(formatAuthCallbackError(undefined)).toBe("");
  });
});

describe("formatAuthApiError", () => {
  test("guides Google-only users on invalid password", () => {
    expect(formatAuthApiError("Invalid email or password", "INVALID_EMAIL_OR_PASSWORD")).toContain(
      "Google"
    );
  });

  test("mentions inbox for duplicate sign-up", () => {
    expect(formatAuthApiError("User already exists", "USER_ALREADY_EXISTS")).toContain("inbox");
  });
});
