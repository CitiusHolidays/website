import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  collectChangeRangeSummary,
  parseNameStatus,
  parseNumstat,
  summarizeChangeRows,
} from "./summarize-change-range.ts";

const root = resolve(import.meta.dir, "../..");
const TARGET_BOUND_COMMAND_PATTERN = /deploy|codegen|vercel/;

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args[0]} failed`);
  }
}

function writeFixture(fixtureRoot: string, filePath: string, content: string) {
  const output = resolve(fixtureRoot, filePath);
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, content);
}

function createChangeRangeFixture() {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "citius-release-range-"));
  runGit(fixtureRoot, ["init", "--initial-branch=main"]);
  runGit(fixtureRoot, ["config", "user.email", "release-fixture@example.invalid"]);
  runGit(fixtureRoot, ["config", "user.name", "Release Fixture"]);
  writeFixture(fixtureRoot, ".agents/review.md", "baseline\n");
  writeFixture(fixtureRoot, "src/app/auth/page.tsx", "export const state = 'baseline';\n");
  writeFixture(fixtureRoot, "convex/schema.ts", "export const schema = 'baseline';\n");
  writeFixture(fixtureRoot, "config/release/tool.ts", "export const tool = 'baseline';\n");
  runGit(fixtureRoot, ["add", "."]);
  runGit(fixtureRoot, ["commit", "-m", "chore: create release fixture"]);

  writeFixture(fixtureRoot, ".agents/review.md", "updated\n");
  writeFixture(fixtureRoot, "src/app/auth/page.tsx", "export const state = 'updated';\n");
  writeFixture(fixtureRoot, "src/app/auth/page.test.ts", "export const covered = true;\n");
  writeFixture(fixtureRoot, "convex/schema.ts", "export const schema = 'updated';\n");
  writeFixture(fixtureRoot, "config/release/tool.ts", "export const tool = 'updated';\n");
  runGit(fixtureRoot, ["add", "."]);
  runGit(fixtureRoot, ["commit", "-m", "feat: update release fixture"]);
  return fixtureRoot;
}

describe("Advisory release-range scope report", () => {
  test("Summarizes a self-contained Git fixture without depending on workspace history", () => {
    const fixtureRoot = createChangeRangeFixture();
    try {
      const summary = collectChangeRangeSummary(fixtureRoot, "HEAD^", "HEAD");

      expect(summary.files.total).toBe(5);
      expect(summary.tests.files).toBe(1);
      expect(summary.ownership.map((row) => row.area)).toEqual(
        expect.arrayContaining(["agent-tooling", "application", "backend", "release-tooling"])
      );
      expect(summary.risks.map((risk) => risk.tag)).toEqual(
        expect.arrayContaining(["auth", "backend", "frontend", "release-tooling"])
      );
      expect(summary.mixing.toolchainAndProduct).toBe(true);
      expect(summary.suggestedCommands).toEqual(
        expect.arrayContaining([
          "bun run config:check",
          "bun run convex:typecheck",
          "bun run typecheck",
          "bun run verify:local",
        ])
      );
      expect(summary.suggestedCommands.join(" ")).not.toMatch(TARGET_BOUND_COMMAND_PATTERN);
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  test("Parses binary paths and renames without fabricating line counts", () => {
    const rows = parseNumstat("10\t2\tsrc/a.ts\n-\t-\tpublic/a.png\n4\t1\told => new.ts\n");
    const statuses = parseNameStatus("M\tsrc/a.ts\nA\tpublic/a.png\nR100\told.ts\tnew.ts\n");

    expect(rows).toEqual([
      { added: 10, binary: false, deleted: 2, path: "src/a.ts" },
      { added: 0, binary: true, deleted: 0, path: "public/a.png" },
      { added: 4, binary: false, deleted: 1, path: "old => new.ts" },
    ]);
    expect(statuses).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "public/a.png", status: "added" },
      { from: "old.ts", path: "new.ts", status: "renamed" },
    ]);
  });

  test("Keeps an isolated documentation change compact and target-neutral", () => {
    const summary = summarizeChangeRows({
      base: "base",
      commits: [{ sha: "head", subject: "docs: explain local proof" }],
      head: "head",
      nameStatuses: [{ path: "docs/VERIFICATION.md", status: "modified" }],
      numstat: [{ added: 8, binary: false, deleted: 2, path: "docs/VERIFICATION.md" }],
      recentPaths: [],
    });

    expect(summary.reviewLoad).toBe("compact");
    expect(summary.risks.map((risk) => risk.tag)).toEqual(["documentation"]);
    expect(summary.suggestedCommands).toEqual(["bun run diff:check"]);
  });

  test("Requires an explicit valid base and rejects an empty range", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["config/release/summarize-change-range.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });

    expect(run([]).status).toBe(1);
    expect(run([]).stderr).toContain("--base");
    expect(run(["--base", "not-a-revision"]).status).toBe(1);
    expect(run(["--base", "HEAD", "--head", "HEAD"]).stderr).toContain("empty");
  });
});
