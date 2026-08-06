import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConvexError } from "convex/values";
import { hasTravellerNamed } from "./e2eAssertions";
import { assertE2eSecret, assertProvidedE2eSecret } from "./lib/e2eAuth";

describe("e2e assertions guard", () => {
  const allowedPreviewEnvironment = {
    E2E_PROVISIONING_TARGET: "preview",
    E2E_SEED_SECRET: "expected-secret",
  };

  test("rejects production even when its target and secret would otherwise allow provisioning", () => {
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

  test("rejects missing, invalid, or unclassified HTTP boundary secrets", () => {
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

  test("accepts explicitly classified preview and development environments", () => {
    expect(() =>
      assertProvidedE2eSecret("expected-secret", allowedPreviewEnvironment)
    ).not.toThrow();
    expect(() =>
      assertProvidedE2eSecret("expected-secret", {
        E2E_PROVISIONING_TARGET: "development",
        E2E_SEED_SECRET: "expected-secret",
      })
    ).not.toThrow();
  });

  test("allows the internal guard only when an allowed target and secret are configured", () => {
    expect(() => assertE2eSecret(undefined, allowedPreviewEnvironment)).not.toThrow();
    expect(() =>
      assertE2eSecret(undefined, {
        E2E_PROVISIONING_TARGET: "preview",
      })
    ).toThrow(ConvexError);
  });

  test("keeps HTTP denials generic and does not accept a request-controlled target", () => {
    const httpSource = readFileSync(join(import.meta.dir, "../http.ts"), "utf8");
    expect(httpSource).toContain('{ error: "E2E seed is not authorized" }');
    expect(httpSource).not.toContain("error.message");
    expect(httpSource).not.toContain('headers.get("x-e2e-target")');
  });

  test("matches the exact traveller name returned by either indexed lookup", () => {
    const travellers = [{ fullName: "E2E Traveller 123" }, { fullName: "Another Traveller" }];
    expect(hasTravellerNamed(travellers, "E2E Traveller 123")).toBe(true);
    expect(hasTravellerNamed(travellers, "e2e traveller 123")).toBe(false);
    expect(hasTravellerNamed(travellers, "Missing Traveller")).toBe(false);
  });
});
