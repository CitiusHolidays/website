import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  type ConvexRuntimeEnvironmentEvidence,
  evaluateEnvironmentPreflight,
  readEnvironmentRegistry,
  validateConvexRuntimeEnvironmentEvidence,
  validateEnvironmentRegistry,
} from "./environment-preflight";

const root = resolve(import.meta.dir, "../..");

const urls = {
  AI_RATE_LIMIT_SALT: "redacted",
  AI_RUNTIME_SECRET: "redacted",
  BETTER_AUTH_URL: "https://preview.citiusholidays.com",
  CONVEX_DEPLOYMENT: "preview:example",
  INBOUND_INTENT_GATEWAY_SECRET: "redacted",
  INBOUND_INTENT_RATE_LIMIT_SALT: "redacted",
  NEXT_PUBLIC_APP_URL: "https://preview.citiusholidays.com",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  NEXT_PUBLIC_SANITY_DATASET: "production",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "example-project",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "redacted",
  OPENROUTER_API_KEY: "redacted",
  OPERATIONAL_CONTROL_GATEWAY_SECRET: "redacted",
  OPERATIONAL_CONTROL_SOURCE_REVISION: "abc1234",
  OPERATIONAL_CONTROL_TARGET_ID: "preview:example",
  SACRED_BHARAT_EVENT_GATEWAY_SECRET: "redacted",
  SITE_URL: "https://preview.citiusholidays.com",
  TURNSTILE_SECRET_KEY: "redacted",
  VERCEL_ENV: "preview",
};

function runtimeEvidence(
  overrides: Partial<ConvexRuntimeEnvironmentEvidence> = {}
): ConvexRuntimeEnvironmentEvidence {
  return { ...runtimeEvidenceBase(), ...overrides };
}

function runtimeEvidenceBase(): ConvexRuntimeEnvironmentEvidence {
  return {
    authOrigin: "https://preview.citiusholidays.com",
    deployment: "preview:example",
    names: [
      "AI_RUNTIME_SECRET",
      "BETTER_AUTH_SECRET",
      "INBOUND_INTENT_GATEWAY_SECRET",
      "OPERATIONAL_CONTROL_GATEWAY_SECRET",
      "OPERATIONAL_CONTROL_SOURCE_REVISION",
      "OPERATIONAL_CONTROL_TARGET_ID",
      "RESEND_API_KEY",
      "SACRED_BHARAT_EVENT_GATEWAY_SECRET",
      "SITE_URL",
      "VERCEL_ENV",
    ],
    schemaVersion: 1,
    secretChecks: { BETTER_AUTH_SECRET: { minimumLength: 32, satisfied: true } },
    target: "preview",
  };
}

describe("Target-aware environment preflight", () => {
  test("Requires the preview registry keys without inspecting secret values", () => {
    const result = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted" },
      "preview",
      undefined,
      runtimeEvidence()
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("Requires deployment credentials for production", () => {
    const result = evaluateEnvironmentPreflight(
      {
        ...urls,
        CONVEX_DEPLOYMENT: "prod:example",
        RESEND_API_KEY: "redacted",
      },
      "production",
      undefined,
      runtimeEvidence({ deployment: "prod:example", target: "production" })
    );
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["CONVEX_DEPLOY_KEY"]);
    expect(result.errors[0]).not.toContain("redacted");
  });

  test("Rejects E2E provisioning configuration from production releases", () => {
    const result = evaluateEnvironmentPreflight(
      {
        ...urls,
        CONVEX_DEPLOY_KEY: "redacted",
        CONVEX_DEPLOYMENT: "prod:example",
        E2E_PROVISIONING_TARGET: "preview",
        E2E_SEED_SECRET: "redacted",
        E2E_STAFF_PASSWORD: "redacted",
        RESEND_API_KEY: "redacted",
      },
      "production",
      undefined,
      runtimeEvidence({ deployment: "prod:example", target: "production" })
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Production must not configure E2E provisioning variables");
    expect(result.errors.join("\n")).not.toContain("redacted");
  });

  test("Requires an explicit preview classification when preview provisioning is configured", () => {
    const missingTarget = evaluateEnvironmentPreflight(
      {
        ...urls,
        E2E_SEED_SECRET: "redacted",
        E2E_STAFF_PASSWORD: "redacted",
        RESEND_API_KEY: "redacted",
      },
      "preview",
      undefined,
      runtimeEvidence()
    );
    expect(missingTarget.ok).toBe(false);
    expect(missingTarget.errors).toContain(
      "Preview E2E provisioning requires E2E_PROVISIONING_TARGET=preview"
    );

    const allowed = evaluateEnvironmentPreflight(
      {
        ...urls,
        E2E_PROVISIONING_TARGET: "preview",
        E2E_SEED_SECRET: "redacted",
        E2E_STAFF_PASSWORD: "redacted",
        RESEND_API_KEY: "redacted",
      },
      "preview",
      undefined,
      runtimeEvidence()
    );
    expect(allowed.ok).toBe(true);
  });

  test("Rejects an auth-origin mismatch before domain cutover", () => {
    const result = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted", SITE_URL: "https://old.citiusholidays.com" },
      "preview",
      undefined,
      runtimeEvidence()
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "SITE_URL must resolve to the same authentication origin as BETTER_AUTH_URL"
    );
  });

  test("Keeps the checked-in registry target names explicit", () => {
    const registry = readEnvironmentRegistry();
    expect(Object.keys(registry.targets)).toEqual(["preview", "production"]);
    expect(registry.schemaVersion).toBe(2);
  });

  test("Fails closed for malformed, incomplete, empty, duplicate, and invalid registries", () => {
    const cases = [
      null,
      { schemaVersion: 1, targets: {} },
      { schemaVersion: 2, targets: { preview: { scopes: {} }, production: { scopes: {} } } },
      {
        schemaVersion: 2,
        targets: {
          preview: { scopes: { browser: { required: ["SITE_URL", "SITE_URL"] } } },
          production: { scopes: {} },
        },
      },
      {
        schemaVersion: 2,
        targets: {
          preview: { scopes: { browser: { required: ["site-url"] } } },
          production: { scopes: {} },
        },
      },
      {
        schemaVersion: 2,
        targets: {
          preview: { scopes: {} },
          production: { scopes: {} },
          staging: { scopes: {} },
        },
      },
    ];

    for (const registry of cases) {
      expect(() => validateEnvironmentRegistry(registry)).toThrow();
    }
  });

  test("Fails closed without exact names-only Convex runtime evidence", () => {
    const missing = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted" },
      "preview"
    );
    expect(missing.ok).toBe(false);
    expect(missing.errors).toContain(
      "Missing target-explicit Convex runtime environment evidence for preview"
    );

    const wrongDeployment = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted" },
      "preview",
      undefined,
      runtimeEvidence({ deployment: "preview:other" })
    );
    expect(wrongDeployment.errors).toContain(
      "Convex runtime evidence deployment must match CONVEX_DEPLOYMENT exactly"
    );
  });

  test("Validates secret strength and optional Google credentials without values", () => {
    const shortSecret = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted" },
      "preview",
      undefined,
      runtimeEvidence({
        secretChecks: {
          BETTER_AUTH_SECRET: { minimumLength: 32, satisfied: false },
        },
      })
    );
    expect(shortSecret.errors).toContain(
      "BETTER_AUTH_SECRET must contain at least 32 characters in the selected runtime"
    );

    const partialGoogle = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted" },
      "preview",
      undefined,
      runtimeEvidence({
        names: [...runtimeEvidenceBase().names, "GOOGLE_CLIENT_ID"],
      })
    );
    expect(partialGoogle.errors).toContain(
      "Convex runtime Google credentials must configure both names or neither"
    );
    expect(JSON.stringify(partialGoogle)).not.toContain("redacted-secret-value");
  });

  test("Rejects a stale deprecated auth alias", () => {
    const result = evaluateEnvironmentPreflight(
      {
        ...urls,
        NEXT_PUBLIC_SITE_URL: "https://stale.citiusholidays.com",
        RESEND_API_KEY: "redacted",
      },
      "preview",
      undefined,
      runtimeEvidence()
    );
    expect(result.errors).toContain(
      "NEXT_PUBLIC_SITE_URL is deprecated and must not conflict with the authentication origin"
    );
  });

  test("Fails closed for malformed runtime evidence", () => {
    expect(() => validateConvexRuntimeEnvironmentEvidence(null)).toThrow();
    expect(() =>
      validateConvexRuntimeEnvironmentEvidence({
        ...runtimeEvidence(),
        names: ["BETTER_AUTH_SECRET", "BETTER_AUTH_SECRET"],
      })
    ).toThrow("invalid or duplicate names");
  });

  test("The CLI fails production closed without printing provisioning secrets", () => {
    const provisioningSecret = "production-provisioning-must-stay-private";
    const result = spawnSync(
      "bun",
      [
        "config/release/environment-preflight.ts",
        "--target",
        "production",
        "--convex-env-evidence",
        "config/test/fixtures/convex-env-evidence.production.json",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          ...urls,
          CONVEX_DEPLOY_KEY: "prod:example|redacted",
          CONVEX_DEPLOYMENT: "prod:example",
          E2E_PROVISIONING_TARGET: "preview",
          E2E_SEED_SECRET: provisioningSecret,
          E2E_STAFF_PASSWORD: provisioningSecret,
          RESEND_API_KEY: "redacted",
        },
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Production must not configure E2E provisioning variables");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(provisioningSecret);
  }, 30_000);

  test("Help is side-effect-free and missing, unknown, or invalid targets fail before validation", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["config/release/environment-preflight.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run env:preflight");
    expect(help.stdout).not.toContain("Missing required");

    for (const [args, message] of [
      [[], "requires --target"],
      [["--target"], "--target requires a value"],
      [["--target", "local"], "Valid choices: preview, production"],
      [["--wat"], "Unknown flag --wat"],
    ] as const) {
      const result = run([...args]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
      expect(result.stderr).not.toContain("Missing required");
    }
  }, 30_000);
});
