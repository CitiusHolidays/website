import { describe, expect, test } from "bun:test";
import { evaluateLocalDoctor, formatDoctorResult } from "./doctor";

const supportedVersions = { bun: "1.3.14", node: "26.5.0" };

const portalEnvironment = {
  BETTER_AUTH_URL: "http://localhost:3000",
  CONVEX_DEPLOYMENT: "dev:careful-otter-123",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://careful-otter-123.convex.site",
  NEXT_PUBLIC_CONVEX_URL: "https://careful-otter-123.convex.cloud",
  SITE_URL: "http://localhost:3000",
};

describe("Local development doctor", () => {
  test("Checks only the chosen profile and accepts an explicit non-production portal target", () => {
    const publicResult = evaluateLocalDoctor({
      env: {},
      files: { bunLock: true, generatedConvex: false, nodeModules: true, studioLock: true },
      profile: "public",
      versions: supportedVersions,
    });
    const portalResult = evaluateLocalDoctor({
      env: portalEnvironment,
      files: { bunLock: true, generatedConvex: true, nodeModules: true, studioLock: true },
      profile: "portal",
      versions: supportedVersions,
    });

    expect(publicResult).toMatchObject({ errors: [], ok: true, profile: "public" });
    expect(portalResult).toMatchObject({
      deployment: { classification: "development", name: "careful-otter-123" },
      errors: [],
      ok: true,
      profile: "portal",
    });
  });

  test("Fails before startup for unsafe targets, missing keys, invalid origins, and runtimes", () => {
    const secret = "must-never-be-printed";
    const result = evaluateLocalDoctor({
      env: {
        ...portalEnvironment,
        BETTER_AUTH_URL: "localhost:3000",
        CONVEX_DEPLOYMENT: "prod:important-production",
        E2E_SEED_SECRET: secret,
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      },
      files: { bunLock: false, generatedConvex: false, nodeModules: false, studioLock: true },
      profile: "portal",
      versions: { bun: "1.2.0", node: "20.9.0" },
    });
    const output = formatDoctorResult(result);

    expect(result.ok).toBe(false);
    expect(output).toContain("Production-class Convex deployments are not allowed");
    expect(output).toContain("BETTER_AUTH_URL must be an absolute HTTP(S) URL");
    expect(output).toContain("Supported Bun range");
    expect(output).toContain("Supported Node range");
    expect(output).not.toContain(secret);
    expect(output).not.toContain("important-production");
  });
});
