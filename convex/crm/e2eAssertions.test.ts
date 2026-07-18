import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import { hasTravellerNamed } from "./e2eAssertions";
import { assertE2eSecret } from "./lib/e2eAuth";

describe("e2e assertions guard", () => {
  test("rejects missing or incorrect secrets", () => {
    expect(() => assertE2eSecret("", "expected-secret")).toThrow(ConvexError);
    expect(() => assertE2eSecret("wrong-secret", "expected-secret")).toThrow(ConvexError);
  });

  test("accepts the configured secret", () => {
    expect(() => assertE2eSecret("expected-secret", "expected-secret")).not.toThrow();
  });

  test("matches the exact traveller name returned by either indexed lookup", () => {
    const travellers = [{ fullName: "E2E Traveller 123" }, { fullName: "Another Traveller" }];
    expect(hasTravellerNamed(travellers, "E2E Traveller 123")).toBe(true);
    expect(hasTravellerNamed(travellers, "e2e traveller 123")).toBe(false);
    expect(hasTravellerNamed(travellers, "Missing Traveller")).toBe(false);
  });
});
