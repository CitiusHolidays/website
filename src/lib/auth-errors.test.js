import { describe, expect, test } from "bun:test";
import {
  formatAuthApiError,
  formatAuthCallbackError,
  formatAuthRecoveryError,
} from "./auth-errors";

describe("FormatAuthCallbackError", () => {
  test("Maps OAuth link failures to actionable copy", () => {
    expect(formatAuthCallbackError("account%20not%20linked")).toContain("Forgot password");
  });

  test("Returns empty string when no error", () => {
    expect(formatAuthCallbackError(undefined)).toBe("");
  });

  test("Fails closed for malformed callback encoding", () => {
    expect(formatAuthCallbackError("%E0%A4%A")).toBe(
      "Sign-in failed. Please try again or use a different sign-in method."
    );
  });
});

describe("FormatAuthApiError", () => {
  test("Guides Google-only users on invalid password", () => {
    expect(formatAuthApiError("Invalid email or password", "INVALID_EMAIL_OR_PASSWORD")).toContain(
      "Google"
    );
  });

  test("Mentions inbox for duplicate sign-up", () => {
    expect(formatAuthApiError("User already exists", "USER_ALREADY_EXISTS")).toContain("inbox");
  });

  test("Never renders unknown provider or exception text", () => {
    const secret = "Provider failed with secret-value";
    expect(formatAuthApiError(secret, "UNKNOWN")).not.toContain(secret);
    expect(formatAuthApiError(secret, "UNKNOWN")).toContain("Forgot password");
  });
});

describe("FormatAuthRecoveryError", () => {
  test("Keeps expired-link recovery specific", () => {
    expect(formatAuthRecoveryError("Token is invalid", "reset")).toContain("Request a new link");
  });

  test("Uses operation-specific fallbacks without exposing transport text", () => {
    const secret = "Failed to fetch secret-value";
    expect(formatAuthRecoveryError(secret, "request")).toContain("send a reset link");
    expect(formatAuthRecoveryError(secret, "request")).not.toContain(secret);
    expect(formatAuthRecoveryError(secret, "reset")).toContain("Request a new link");
  });
});
