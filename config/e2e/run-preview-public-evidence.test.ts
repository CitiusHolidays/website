import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPreviewPublicSmokeEvidence } from "../release/release-evidence";
import { validatePreviewPublicTarget } from "./run-preview-public-evidence";

describe("Preview public browser evidence adapter", () => {
  test("uses a credential-free config with no auth setup, seed, or local web server", () => {
    const root = resolve(import.meta.dir, "../..");
    const runner = readFileSync(resolve(root, "config/e2e/run-preview-public-evidence.ts"), "utf8");
    const config = readFileSync(resolve(root, "playwright.preview-public.config.ts"), "utf8");
    expect(runner).toContain('"playwright.preview-public.config.ts"');
    expect(runner).toContain("readApprovedE2eTarget");
    expect(runner).toContain("verifyFrontendE2eIdentity");
    expect(config).not.toContain("globalSetup");
    expect(config).not.toContain("globalTeardown");
    expect(config).not.toContain("loadE2eEnv");
    expect(config).not.toContain("webServer");
  });

  test("accepts an explicit HTTPS Preview and rejects local/production-shaped input", () => {
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

  test("populates only the Preview public-smoke scope", () => {
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
