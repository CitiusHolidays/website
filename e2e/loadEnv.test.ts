import { describe, expect, test } from "bun:test";
import { parseEnvLineValue } from "./loadEnv";

describe("parseEnvLineValue", () => {
  test("keeps quoted values when an inline comment follows", () => {
    expect(parseEnvLineValue('"seedsecret"   # workflow assertions')).toBe("seedsecret");
  });

  test("strips surrounding quotes from plain assignments", () => {
    expect(parseEnvLineValue('"staffpassword"')).toBe("staffpassword");
  });
});
