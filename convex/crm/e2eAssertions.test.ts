import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import { hasTravellerNamed } from "./e2eAssertions";
import { assertE2eSecret, assertE2eTargetIdentity, assertProvidedE2eSecret } from "./lib/e2eAuth";

describe("E2e assertions guard", () => {
  const allowedPreviewEnvironment = {
    E2E_PROVISIONING_TARGET: "preview",
    E2E_SEED_SECRET: "expected-secret",
    E2E_TARGET_ID: "preview-fixture",
  };

  test("Rejects production even when its target and secret would otherwise allow provisioning", () => {
    expect(() =>
      assertProvidedE2eSecret("expected-secret", {
        ...allowedPreviewEnvironment,
        VERCEL_ENV: "production",
      })
    ).toThrow(ConvexError);
    expect(() =>
      assertProvidedE2eSecret("expected-secret", {
        E2E_PROVISIONING_TARGET: "production",
        E2E_SEED_SECRET: "expected-secret",
      })
    ).toThrow(ConvexError);
  });

  test("Rejects missing, invalid, or unclassified HTTP boundary secrets", () => {
    expect(() => assertProvidedE2eSecret(undefined, allowedPreviewEnvironment)).toThrow(
      ConvexError
    );
    expect(() => assertProvidedE2eSecret("wrong-secret", allowedPreviewEnvironment)).toThrow(
      ConvexError
    );
    expect(() =>
      assertProvidedE2eSecret("expected-secret", {
        E2E_SEED_SECRET: "expected-secret",
      })
    ).toThrow(ConvexError);
  });

  test("Accepts explicitly classified preview and development environments", () => {
    expect(() =>
      assertProvidedE2eSecret("expected-secret", allowedPreviewEnvironment)
    ).not.toThrow();
    expect(() =>
      assertProvidedE2eSecret("expected-secret", {
        E2E_PROVISIONING_TARGET: "development",
        E2E_SEED_SECRET: "expected-secret",
        E2E_TARGET_ID: "development-local",
      })
    ).not.toThrow();
  });

  test("Binds protected requests to the server-configured target identity", () => {
    expect(assertE2eTargetIdentity("preview-fixture", allowedPreviewEnvironment)).toEqual({
      target: "preview",
      targetId: "preview-fixture",
    });
    expect(() => assertE2eTargetIdentity("preview-other", allowedPreviewEnvironment)).toThrow(
      ConvexError
    );
  });

  test("Allows the internal guard only when an allowed target and secret are configured", () => {
    expect(() => assertE2eSecret(undefined, allowedPreviewEnvironment)).not.toThrow();
    expect(() =>
      assertE2eSecret(undefined, {
        E2E_PROVISIONING_TARGET: "preview",
      })
    ).toThrow(ConvexError);
  });

  test("Matches the exact traveller name returned by either indexed lookup", () => {
    const travellers = [{ fullName: "E2E Traveller 123" }, { fullName: "Another Traveller" }];
    expect(hasTravellerNamed(travellers, "E2E Traveller 123")).toBe(true);
    expect(hasTravellerNamed(travellers, "e2e traveller 123")).toBe(false);
    expect(hasTravellerNamed(travellers, "Missing Traveller")).toBe(false);
  });
});
