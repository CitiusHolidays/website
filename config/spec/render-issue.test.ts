import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderGitHubIssueBody } from "./render-issue";

const ROOT = resolve(import.meta.dir, "../..");
const VALID_FIXTURE = "config/spec/fixtures/implementation-valid.md";

function runRenderer(path: string) {
  return spawnSync("bun", ["config/spec/render-issue.ts", path], {
    cwd: ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
}

function gitStatus() {
  return spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  }).stdout;
}

describe("Validated GitHub issue rendering", () => {
  test("Maps every implementation field once into deterministic Markdown", () => {
    const source = readFileSync(resolve(ROOT, VALID_FIXTURE), "utf8").replace(
      "## Proof boundaries",
      "## Operator notes\n\nRenderer retains reviewed program extensions.\n\n## Proof boundaries"
    );
    const first = renderGitHubIssueBody(source);
    const second = renderGitHubIssueBody(source);

    expect(first).toBe(second);
    expect(first).toContain("<!-- Suggested issue title: Enforce spec readiness -->");
    expect(first).toContain("## Context and target user/job");
    expect(first).toContain("## Testing and evidence");
    expect(first).toContain("## UI extension");
    expect(first).toContain("## Operator notes");
    expect(first).toContain("Source artifact kind: implementation_spec");
    expect(first).toContain("Implementation authorized at render: true");
    expect(first).toContain("Source issue: #168");
    expect(first.match(/GitHub Issues are canonical/g)).toHaveLength(1);
    expect(first.match(/`docs\/PLAN_MAP\.md`/g)).toHaveLength(1);
    expect(first.match(/Renderer retains reviewed program extensions\./g)).toHaveLength(1);
  });

  test("CLI is opt-in, stdout-only, deterministic, and rejects non-executable specs", () => {
    const before = gitStatus();
    const first = runRenderer(VALID_FIXTURE);
    const second = runRenderer(VALID_FIXTURE);
    const help = runRenderer("--help");
    const rejected = runRenderer("config/spec/fixtures/research-valid.md");

    expect(first.status).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout).toBe(second.stdout);
    expect(first.stdout).toContain(
      "review and deduplicate before any separately authorized GitHub write"
    );
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run spec:render-issue -- <exact-spec.md> [options]");
    expect(rejected.status).not.toBe(0);
    expect(rejected.stdout).toBe("");
    expect(rejected.stderr).toContain("implementation-authorized");
    expect(gitStatus()).toBe(before);
  });
});
