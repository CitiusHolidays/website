import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  collectChangeRangeSummary,
  parseNameStatus,
  parseNumstat,
  summarizeChangeRows,
} from "./summarize-change-range.ts";

const root = resolve(import.meta.dir, "../..");
const TARGET_BOUND_COMMAND_PATTERN = /deploy|codegen|vercel/;

describe("advisory release-range scope report", () => {
  test("reproduces the architecture remediation range facts and risk domains", () => {
    const summary = collectChangeRangeSummary(root, "5b843be^", "5b843be");

    expect(summary.files.total).toBe(239);
    expect(summary.ownership.map((row) => row.area)).toEqual(
      expect.arrayContaining(["agent-tooling", "application", "backend"])
    );
    expect(summary.risks.map((risk) => risk.tag)).toEqual(
      expect.arrayContaining(["auth", "release-tooling", "schema-migrations"])
    );
    expect(summary.mixing.toolchainAndProduct).toBe(true);
  });

  test("reproduces the Staff Workspace release accounting and command suggestions", () => {
    const summary = collectChangeRangeSummary(root, "7fa38a0^", "7fa38a0");

    expect(summary.files.total).toBe(84);
    expect(summary.lines.rawChanged).toBe(6532);
    expect(summary.tests.files).toBe(20);
    expect(summary.risks.map((risk) => risk.tag)).toEqual(
      expect.arrayContaining([
        "backend",
        "frontend",
        "imports-exports",
        "notifications",
        "performance",
        "staff-workspace",
      ])
    );
    expect(summary.suggestedCommands).toEqual(
      expect.arrayContaining([
        "bun run typecheck",
        "bun run convex:typecheck",
        "bun run performance:check",
        "bun run verify:local",
      ])
    );
    expect(summary.suggestedCommands.join(" ")).not.toMatch(TARGET_BOUND_COMMAND_PATTERN);
  });

  test("parses binary paths and renames without fabricating line counts", () => {
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

  test("keeps an isolated documentation change compact and target-neutral", () => {
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
    expect(summary.suggestedCommands).toEqual(["bun run diff:check", "bun run docs:check"]);
  });

  test("requires an explicit valid base and rejects an empty range", () => {
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
