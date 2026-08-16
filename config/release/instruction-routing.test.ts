import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const SOURCE_FILENAME_PATTERN = /\.(?:js|jsx|ts|tsx)`/;
const WORD_BOUNDARY_PATTERN = /\s+/;

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

function block(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error(`Missing generated block ${start}`);
  }
  return source.slice(startIndex, endIndex + end.length);
}

describe("trigger-led repository instructions", () => {
  test("preserves generated Convex and Next blocks byte-for-byte", () => {
    const agents = read("AGENTS.md");
    expect(
      createHash("sha256")
        .update(block(agents, "<!-- convex-ai-start -->", "<!-- convex-ai-end -->"))
        .digest("hex")
    ).toBe("5934f676ea9a332e7cd4a4f64aa23b59d926e9faca026c758d4b1f87d2101cc3");
    expect(
      createHash("sha256")
        .update(
          block(agents, "<!-- BEGIN:nextjs-agent-rules -->", "<!-- END:nextjs-agent-rules -->")
        )
        .digest("hex")
    ).toBe("2fbfa7b274e091643f266d9941fa7f6d72b9f16812e94aad69aa8971cd0a7640");
  });

  test("keeps root compact while retaining global evidence and preservation boundaries", () => {
    const agents = read("AGENTS.md");
    const handMaintained = agents.slice(0, agents.indexOf("<!-- convex-ai-start -->"));
    expect(handMaintained.split(WORD_BOUNDARY_PATTERN).filter(Boolean).length).toBeLessThan(430);
    expect(handMaintained).toContain("Staff Workspace and Customer Account");
    expect(handMaintained).toContain("separate evidence states");
    expect(handMaintained).toContain("do not recreate a second plan system");
    expect(handMaintained).toContain("Preserve unrelated working-tree changes");
    expect(handMaintained).not.toMatch(SOURCE_FILENAME_PATTERN);
    expect(handMaintained).not.toContain("react-doctor@latest");
  });

  test("routes every high-impact task family to existing durable owners", () => {
    const routing = read("docs/agents/task-routing.md");
    for (const trigger of [
      "Authentication",
      "Convex schema",
      "commercial",
      "Portal UI",
      "Spreadsheet",
      "Role",
      "Release",
      "Issue",
    ]) {
      expect(routing).toContain(trigger);
    }
    for (const path of [
      "CONTEXT.md",
      "docs/PORTAL_CRM_WORKFLOWS.md",
      "docs/PORTAL_ROLES_AND_ACCESS.md",
      "docs/TRANSITION_POLICY.md",
      "docs/adr/0004-typescript-first-effect-adoption.md",
      "RELEASE.md",
      "docs/agents/issue-tracker.md",
      "docs/PLAN_MAP.md",
    ]) {
      expect(routing).toContain(path);
      expect(existsSync(resolve(root, path))).toBe(true);
    }
  });

  test("documents the package-owned Health Stack without claiming live proof", () => {
    const claude = read("CLAUDE.md");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    for (const command of [
      "typecheck",
      "convex:typecheck",
      "lint",
      "lint:ratchet",
      "test",
      "deadcode",
      "deadcode:ratchet",
      "verify:local",
    ]) {
      expect(packageJson.scripts[command]).toBeDefined();
      expect(claude).toContain(`bun run ${command}`);
    }
    expect(claude).toContain("cannot prove current Next route types");
    expect(claude).toContain("not replace the deployment");
  });
});
