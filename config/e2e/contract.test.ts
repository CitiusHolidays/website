import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("E2E command and target contract", () => {
  test("uses one implemented browser base URL name across harnesses and docs", () => {
    for (const path of [
      "playwright.config.ts",
      "playwright.public.config.ts",
      "scripts/browser-smoke.ts",
      "docs/E2E_TESTING.md",
      "docs/BROWSER_SMOKE.md",
    ]) {
      expect(read(path), path).toContain("BROWSER_SMOKE_BASE_URL");
      expect(read(path), path).not.toContain("E2E_BASE_URL");
    }
  });

  test("makes proof commands strict while retaining explicitly optional discovery", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    expect(scripts.test).not.toContain("playwright");
    expect(scripts["test:e2e"]).toContain("E2E_STRICT=1");
    expect(scripts["test:e2e:optional"]).toBe("playwright test");
    expect(scripts["test:local"]).toBe("bun run test && bun run test:e2e");
    expect(scripts["smoke:browser:public"]).toContain("--strict");
    expect(scripts["smoke:browser:authenticated"]).toContain("--strict");
  });

  test("validates target prerequisites before creating auth storage", () => {
    const setup = read("e2e/global-setup.ts");
    expect(setup.indexOf("validateE2ePreflight")).toBeLessThan(setup.indexOf("mkdir(AUTH_DIR"));
    expect(setup).toContain("optional E2E discovery".replace("optional", "Optional"));
    expect(setup).toContain("seedE2eStaffProfiles");
    expect(setup.indexOf("writeFile(\n    RUN_STATE_PATH")).toBeLessThan(
      setup.indexOf("await seedE2eStaffProfiles(")
    );
    expect(setup).toContain('{ flag: "wx", mode: 0o600 }');
  });

  test("keeps the evidence summary explicit and ignored", () => {
    const reporter = read("e2e/reporters/evidenceReporter.ts");
    expect(reporter).toContain("missing-credentials");
    expect(reporter).toContain("missing-record-url");
    expect(reporter).toContain("planned-matrix");
    expect(reporter).toContain("product-precondition");
    expect(reporter).toContain(".scratch/playwright-results/evidence-summary.json");
    expect(read(".gitignore")).toContain(".scratch/");
  });
});
