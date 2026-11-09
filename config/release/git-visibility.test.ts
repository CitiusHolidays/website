import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { CHILD_TEST_TIMEOUT_MS, runChild } from "../../test-helpers/runChild";

const root = resolve(import.meta.dir, "../..");

async function isIgnored(path: string) {
  const result = await runChild(
    "git",
    ["check-ignore", "--no-index", "--quiet", path],
    {
      cwd: root,
    },
    CHILD_TEST_TIMEOUT_MS
  );
  return result.status === 0;
}

describe("Repository source visibility", () => {
  test(
    "Keeps skills, settings, hooks, and workflows reviewable",
    async () => {
      expect(await isIgnored(".agents/skills/convex/SKILL.md")).toBe(false);
      expect(await isIgnored(".claude/settings.json")).toBe(false);
      expect(await isIgnored(".claude/hooks/react-doctor.mjs")).toBe(false);
      expect(await isIgnored(".github/workflows/review.yml")).toBe(false);
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Continues to ignore exact machine-local state",
    async () => {
      expect(await isIgnored(".scratch/local-evidence.json")).toBe(true);
      expect(await isIgnored(".worktrees/local-branch")).toBe(true);
      expect(await isIgnored(".gstack/runtime.json")).toBe(true);
      expect(await isIgnored(".playwright-mcp/session.json")).toBe(true);
      expect(await isIgnored(".context/retros/2026-08-12.md")).toBe(true);
    },
    CHILD_TEST_TIMEOUT_MS
  );

  test(
    "Does not hide unrelated context files",
    async () => {
      expect(await isIgnored(".context/unrelated.json")).toBe(false);
      expect(await isIgnored(".context/decisions/ownership.md")).toBe(false);
    },
    CHILD_TEST_TIMEOUT_MS
  );
});
