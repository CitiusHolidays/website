import { describe, expect, test } from "bun:test";
import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import { resolveAuthReturnPath, signInHrefWithReturn } from "./auth-return-path";

const guest = getAuthVariant("guest");

describe("Sign-in return path", () => {
  test("Keeps a same-origin path inside the variant's own area, with its query and hash", () => {
    expect(resolveAuthReturnPath("/account?tab=settings#delete-account", guest)).toBe(
      "/account?tab=settings#delete-account"
    );
    expect(resolveAuthReturnPath("/account", guest)).toBe("/account");
  });

  test("Refuses anything that could leave the site or the variant's area", () => {
    for (const value of [
      "https://evil.example/account",
      "//evil.example/account",
      "/\\evil.example/account",
      "\\\\evil.example",
      "javascript:alert(1)",
      "/account\n/evil",
      " /account",
      "/accounts-and-more",
      "/accountX",
      "/portal",
      "/",
      "account",
      "",
      `/account?${"x".repeat(600)}`,
      null,
      undefined,
      ["/account"],
    ]) {
      expect(resolveAuthReturnPath(value, guest)).toBeNull();
    }
  });

  test("Builds the variant's sign-in link carrying an allowed return path only", () => {
    expect(signInHrefWithReturn("/account?tab=settings#delete-account", guest)).toBe(
      "/auth/guest?returnTo=%2Faccount%3Ftab%3Dsettings%23delete-account"
    );
    expect(signInHrefWithReturn("//evil.example", guest)).toBe("/auth/guest");
  });
});
