import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const report = readFileSync(join(root, "docs/CNFAST_BENCHMARK.md"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const lockfile = readFileSync(join(root, "bun.lock"), "utf8");
const CNFAST_LOCK_ENTRY = /^\s*"cnfast":/m;

describe("cnfast benchmark decision contract", () => {
  test("keeps cnfast out of the application dependency graph", () => {
    expect(packageJson.dependencies?.cnfast).toBeUndefined();
    expect(packageJson.devDependencies?.cnfast).toBeUndefined();
    expect(lockfile).not.toMatch(CNFAST_LOCK_ENTRY);
  });

  test("records reproducible correctness, performance, and footprint evidence", () => {
    for (const requiredText of [
      "cnfast 0.1.0",
      "Bun 1.3.14",
      "20,000 iterations",
      "7 trials",
      "Public site",
      "Sacred Bharat",
      "Customer Travel Account",
      "Staff Workspace",
      "Warm-cache median speedup",
      "Cold-cache median speedup",
      "Compatibility",
      "Package footprint",
    ]) {
      expect(report).toContain(requiredText);
    }
  });

  test("makes a benchmark-only decision without implying application adoption", () => {
    expect(report).toContain("Decision: defer adoption");
    expect(report).toContain("No implementation ticket is warranted yet");
    expect(report).toContain("did not change the application `cn` implementation");
  });
});
