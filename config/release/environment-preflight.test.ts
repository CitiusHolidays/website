import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  evaluateEnvironmentPreflight,
  readEnvironmentRegistry,
  validateEnvironmentRegistry,
} from "./environment-preflight";

const root = resolve(import.meta.dir, "../..");

const urls = {
  BETTER_AUTH_URL: "https://preview.citiusholidays.com",
  NEXT_PUBLIC_APP_URL: "https://preview.citiusholidays.com",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  NEXT_PUBLIC_SANITY_DATASET: "production",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "example-project",
  SITE_URL: "https://preview.citiusholidays.com",
};

describe("target-aware environment preflight", () => {
  test("requires the preview registry keys without inspecting secret values", () => {
    const result = evaluateEnvironmentPreflight({ ...urls, RESEND_API_KEY: "redacted" }, "preview");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("requires deployment credentials for production", () => {
    const result = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted" },
      "production"
    );
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY"]);
    expect(result.errors[0]).not.toContain("redacted");
  });

  test("rejects E2E provisioning configuration from production releases", () => {
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
      "production"
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Production must not configure E2E provisioning variables");
    expect(result.errors.join("\n")).not.toContain("redacted");
  });

  test("requires an explicit preview classification when preview provisioning is configured", () => {
    const missingTarget = evaluateEnvironmentPreflight(
      {
        ...urls,
        E2E_SEED_SECRET: "redacted",
        E2E_STAFF_PASSWORD: "redacted",
        RESEND_API_KEY: "redacted",
      },
      "preview"
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
      "preview"
    );
    expect(allowed.ok).toBe(true);
  });

  test("rejects an auth-origin mismatch before domain cutover", () => {
    const result = evaluateEnvironmentPreflight(
      { ...urls, RESEND_API_KEY: "redacted", SITE_URL: "https://old.citiusholidays.com" },
      "preview"
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "SITE_URL must resolve to the same origin as the authentication origin"
    );
  });

  test("keeps the checked-in registry target names explicit", () => {
    const registry = readEnvironmentRegistry();
    expect(Object.keys(registry.targets)).toEqual(["preview", "production"]);
    expect(registry.schemaVersion).toBe(1);
  });

  test("fails closed for malformed, incomplete, empty, duplicate, and invalid registries", () => {
    const cases = [
      null,
      { schemaVersion: 2, targets: {} },
      { schemaVersion: 1, targets: { preview: { required: [] }, production: { required: [] } } },
      {
        schemaVersion: 1,
        targets: {
          preview: { required: ["SITE_URL", "SITE_URL"] },
          production: { required: ["SITE_URL"] },
        },
      },
      {
        schemaVersion: 1,
        targets: {
          preview: { required: ["site-url"] },
          production: { required: ["SITE_URL"] },
        },
      },
      {
        schemaVersion: 1,
        targets: {
          preview: { required: ["SITE_URL"] },
          production: { required: ["SITE_URL"] },
          staging: { required: ["SITE_URL"] },
        },
      },
    ];

    for (const registry of cases) {
      expect(() => validateEnvironmentRegistry(registry)).toThrow();
    }
  });

  test("the CLI fails production closed without printing provisioning secrets", () => {
    const provisioningSecret = "production-provisioning-must-stay-private";
    const result = spawnSync(
      "bun",
      ["config/release/environment-preflight.ts", "--target", "production"],
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
  });

  test("help is side-effect-free and missing, unknown, or invalid targets fail before validation", () => {
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
  });
});
