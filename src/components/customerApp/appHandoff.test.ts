import { describe, expect, test } from "bun:test";
import { appHandoffUrl, tokenFromHash } from "./appHandoff";

describe("customer app link handoff", () => {
  test("reads the token from the fragment only", () => {
    expect(tokenFromHash("#token=abcDEF_123-abcdefghijk")).toBe("abcDEF_123-abcdefghijk");
    expect(tokenFromHash("")).toBeNull();
    expect(tokenFromHash("#token=short")).toBeNull();
    expect(tokenFromHash("#token=<script>alert(1)</script>")).toBeNull();
  });

  test("hands the token to the app's scheme", () => {
    expect(appHandoffUrl("sign-in", "abcDEF_123-abcdefghijk")).toBe(
      "citius://sign-in?token=abcDEF_123-abcdefghijk"
    );
    expect(appHandoffUrl("invite", "abcDEF_123-abcdefghijk")).toBe(
      "citius://invite?token=abcDEF_123-abcdefghijk"
    );
  });
});
