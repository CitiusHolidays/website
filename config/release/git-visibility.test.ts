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

describe("repository source visibility", () => {
  test("keeps skills, settings, hooks, and workflows reviewable", () => {
    expect(isIgnored(".agents/skills/convex/SKILL.md")).toBe(false);
    expect(isIgnored(".claude/settings.json")).toBe(false);
    expect(isIgnored(".claude/hooks/react-doctor.mjs")).toBe(false);
    expect(isIgnored(".github/workflows/review.yml")).toBe(false);
  });

  test("continues to ignore exact machine-local state", () => {
    expect(isIgnored(".scratch/local-evidence.json")).toBe(true);
    expect(isIgnored(".worktrees/local-branch")).toBe(true);
    expect(isIgnored(".gstack/runtime.json")).toBe(true);
    expect(isIgnored(".playwright-mcp/session.json")).toBe(true);
  });
});
