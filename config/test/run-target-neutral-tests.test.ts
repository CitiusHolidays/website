import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { classifyTargetNeutralTestArgs } from "./run-target-neutral-tests";

describe("Target-neutral test runner selection", () => {
  test("Composes both lanes only for the unfiltered broad command", () => {
    expect(classifyTargetNeutralTestArgs([])).toEqual({ bun: true, convex: true });
  });

  test("Preserves focused Bun and Convex integration commands without double discovery", () => {
    expect(classifyTargetNeutralTestArgs(["src/example.test.ts"])).toEqual({
      bun: true,
      convex: false,
    });
    expect(classifyTargetNeutralTestArgs(["convex/example.convex.integration.ts"])).toEqual({
      bun: false,
      convex: true,
    });
    expect(() =>
      classifyTargetNeutralTestArgs(["src/example.test.ts", "convex/example.convex.integration.ts"])
    ).toThrow("either Bun tests or Convex integration tests");
  });

  test("Keeps Playwright specs out of the Bun lane", () => {
    const runner = readFileSync("config/test/run-target-neutral-tests.ts", "utf8");
    const coverage = readFileSync("config/release/coverage-ratchet.ts", "utf8");

    for (const source of [runner, coverage]) {
      expect(source).toContain("--path-ignore-patterns=e2e/specs/**");
      expect(source).toContain("--path-ignore-patterns=e2e/public/**");
    }
  });

  test("Serializes shared-process tests without triggering Bun's coverage finalizer hang", () => {
    const runner = readFileSync("config/test/run-target-neutral-tests.ts", "utf8");
    const coverage = readFileSync("config/release/coverage-ratchet.ts", "utf8");
    // SAFETY: This test reads the repository-owned package JSON fixture.
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(runner).toContain('"--max-concurrency=1"');
    expect(packageJson.scripts["test:bun"]).toContain("--max-concurrency=1");
    expect(coverage).not.toContain('"--max-concurrency=1"');
    expect(coverage).toContain('"--timeout=30000"');
  });
});
