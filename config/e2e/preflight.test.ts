import { describe, expect, test } from "bun:test";
import { validateE2ePreflight } from "./preflight";

const developmentEnv = {
  E2E_PROVISIONING_TARGET: "development",
  E2E_SEED_SECRET: "fixture-secret",
  E2E_STAFF_PASSWORD: "fixture-password",
  E2E_TARGET_ID: "development-local",
  NEXT_PUBLIC_CONVEX_SITE_URL: "http://localhost:3210",
};

describe("fail-closed E2E preflight", () => {
  test("keeps credential-free discovery explicitly optional", () => {
    expect(validateE2ePreflight({}, "http://localhost:3000", false)).toEqual({
      mode: "optional-skip",
      target: null,
    });
  });

  test("strict mode lists missing key names without values", () => {
    expect(() => validateE2ePreflight({}, "http://localhost:3000", true)).toThrow(
      "E2E_STAFF_PASSWORD, E2E_SEED_SECRET, E2E_TARGET_ID, NEXT_PUBLIC_CONVEX_SITE_URL"
    );
  });

  test("accepts an explicit loopback development target", () => {
    expect(validateE2ePreflight(developmentEnv, "http://localhost:3000", true)).toEqual({
      mode: "ready",
      target: "development",
    });
  });

  test("accepts only non-loopback HTTPS for an explicit preview", () => {
    const preview = {
      ...developmentEnv,
      E2E_PROVISIONING_TARGET: "preview",
      E2E_TARGET_ID: "preview-fixture",
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://fixture-preview.convex.site",
    };
    expect(validateE2ePreflight(preview, "https://preview.example.test", true)).toEqual({
      mode: "ready",
      target: "preview",
    });
    expect(() => validateE2ePreflight(preview, "http://localhost:3000", true)).toThrow(
      "non-loopback HTTPS"
    );
    expect(() =>
      validateE2ePreflight(
        { ...preview, NEXT_PUBLIC_CONVEX_SITE_URL: "http://localhost:3210" },
        "https://preview.example.test",
        true
      )
    ).toThrow("non-loopback HTTPS NEXT_PUBLIC_CONVEX_SITE_URL");
  });

  test("rejects production and ambiguous target classification before auth artifacts", () => {
    for (const target of [undefined, "production", "staging"]) {
      expect(() =>
        validateE2ePreflight(
          { ...developmentEnv, E2E_PROVISIONING_TARGET: target },
          "http://localhost:3000",
          true
        )
      ).toThrow("development or preview");
    }
    expect(() =>
      validateE2ePreflight(
        { ...developmentEnv, VERCEL_ENV: "production" },
        "http://localhost:3000",
        true
      )
    ).toThrow("forbidden");
  });
});
