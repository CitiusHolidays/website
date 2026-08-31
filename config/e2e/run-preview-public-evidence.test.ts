import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPlaywrightConfig } from "../../playwright.config";
import { createPreviewPublicSmokeEvidence } from "../release/release-evidence";
import { validatePreviewPublicTarget } from "./run-preview-public-evidence";

describe("Preview public browser evidence adapter", () => {
  test("Uses a credential-free config with no auth setup, seed, or local web server", () => {
    const root = resolve(import.meta.dir, "../..");
    const runner = readFileSync(resolve(root, "config/e2e/run-preview-public-evidence.ts"), "utf8");
    const config = createPlaywrightConfig("preview-public", {
      BROWSER_SMOKE_BASE_URL: "https://branch.example.test",
    });
    expect(runner).toContain('CITIUS_PLAYWRIGHT_PROFILE: "preview-public"');
    expect(runner).toContain("readApprovedE2eTarget");
    expect(runner).toContain("verifyFrontendE2eIdentity");
    expect(config.globalSetup).toBeUndefined();
    expect(config.globalTeardown).toBeUndefined();
    expect(config.testDir).toBe("./e2e");
    expect(config.testMatch).toEqual([
      "specs/public-interface-accessibility.spec.ts",
      "public/sacred-bharat-edition.spec.ts",
    ]);
    expect(config.webServer).toBeUndefined();
    expect(config.use?.extraHTTPHeaders).toBeDefined();
  });

  test("Accepts an explicit HTTPS Preview and rejects local/production-shaped input", () => {
    expect(validatePreviewPublicTarget("https://branch.example.test", "preview-123")).toBe(
      "https://branch.example.test/"
    );
    expect(() => validatePreviewPublicTarget("http://localhost:3000", "preview-123")).toThrow(
      "non-loopback HTTPS"
    );
    expect(() => validatePreviewPublicTarget("https://example.test", "production")).toThrow(
      "beginning with preview-"
    );
    expect(() => validatePreviewPublicTarget("https://example.test", "branch-123")).toThrow(
      "beginning with preview-"
    );
  });

  test("Populates only the Preview public-smoke scope", () => {
    const evidence = createPreviewPublicSmokeEvidence({
      artifactRefs: [".scratch/e2e-preview-public/results"],
      finishedAt: "2026-08-12T12:00:05.000Z",
      outcome: "passed",
      revision: "abc123",
      startedAt: "2026-08-12T12:00:00.000Z",
      targetId: "preview-123",
    });
    expect(evidence.scopes["preview-public-smoke"]).toMatchObject({
      status: "passed",
      target: { id: "preview-123", kind: "preview" },
    });
    expect(evidence.scopes.local.status).toBe("not_run");
    expect(evidence.scopes["production-public-smoke"].status).toBe("not_run");
  });
});
