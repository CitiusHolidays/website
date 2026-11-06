import { describe, expect, test } from "bun:test";
import { NATIVE_APP_TRUSTED_ORIGINS } from "./nativeAppOrigins";

describe("Native app trusted origins", () => {
  test("Trusts exactly the two Citius app schemes", () => {
    expect([...NATIVE_APP_TRUSTED_ORIGINS]).toEqual(["citius://", "citiusconnect://"]);
  });

  test("Never trusts Expo Go, web or wildcard origins", () => {
    for (const origin of NATIVE_APP_TRUSTED_ORIGINS) {
      expect(origin.startsWith("exp:")).toBe(false);
      expect(origin.startsWith("http")).toBe(false);
      expect(origin).not.toContain("*");
    }
  });

  test("Cannot be modified at runtime", () => {
    expect(Object.isFrozen(NATIVE_APP_TRUSTED_ORIGINS)).toBe(true);
  });
});
