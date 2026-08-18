import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

function isIgnored(path: string) {
  return (
    spawnSync("git", ["check-ignore", "--no-index", "--quiet", path], {
      cwd: root,
    }).status === 0
  );
}

describe("Repository source visibility", () => {
  test("Keeps skills, settings, hooks, and workflows reviewable", () => {
    expect(isIgnored(".agents/skills/convex/SKILL.md")).toBe(false);
    expect(isIgnored(".claude/settings.json")).toBe(false);
    expect(isIgnored(".claude/hooks/react-doctor.mjs")).toBe(false);
    expect(isIgnored(".github/workflows/review.yml")).toBe(false);
  });

  test("Continues to ignore exact machine-local state", () => {
    expect(isIgnored(".scratch/local-evidence.json")).toBe(true);
    expect(isIgnored(".worktrees/local-branch")).toBe(true);
    expect(isIgnored(".gstack/runtime.json")).toBe(true);
    expect(isIgnored(".playwright-mcp/session.json")).toBe(true);
    expect(isIgnored(".context/retros/2026-08-12.md")).toBe(true);
  });

  test("Does not hide unrelated context files", () => {
    expect(isIgnored(".context/unrelated.json")).toBe(false);
    expect(isIgnored(".context/decisions/ownership.md")).toBe(false);
  });
});
