import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Citius interface review contract", () => {
  test("owns one cross-surface checklist without merging product baselines", () => {
    const guidePath = "docs/INTERFACE_REVIEW.md";

    expect(existsSync(resolve(root, guidePath))).toBe(true);
    const guide = read(guidePath);
    expect(read("docs/README.md")).toContain("[Interface review contract](INTERFACE_REVIEW.md)");

    for (const surface of [
      "Public site",
      "Sacred Bharat",
      "Customer Travel Account",
      "Staff Workspace",
    ]) {
      expect(guide).toContain(surface);
    }
    expect(guide).toContain("Shared foundations do not merge product baselines");
    expect(guide).toContain("External checklist comparison");
  });

  test("covers observable interaction states and keeps the checklist source-only", () => {
    const guide = read("docs/INTERFACE_REVIEW.md");
    const packageJson = read("package.json");

    for (const observable of [
      "Keyboard and focus",
      "Forms and validation",
      "Loading, empty, error, success, partial, and retry",
      "Mobile and coarse pointers",
      "Hydration stability",
      "Screen readers",
      "Reduced motion",
    ]) {
      expect(guide).toContain(observable);
    }
    expect(guide).toContain("https://github.com/aidenybai/web-interface-guidelines");
    expect(packageJson).not.toContain("web-interface-guidelines");
  });
});
