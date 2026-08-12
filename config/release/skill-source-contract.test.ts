import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const CURL_PIPE_PATTERN = /curl[^\n|]*\|\s*(?:ba)?sh/i;
const MUTABLE_PROCEDURE_PATTERN = /follow (?:its|the) (?:Procedure|served)/i;
const UNSAFE_APPROVAL_PATTERN = /auto-approve/i;
const WGET_PIPE_PATTERN = /wget[^\n|]*\|\s*(?:ba)?sh/i;

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

const mirroredSkills = [
  "convex",
  "convex-add",
  "convex-improve-convex-plugin",
  "react-doctor",
] as const;

describe("tracked skill execution authority", () => {
  test("keeps the agent and Claude safety overrides identical", () => {
    for (const skill of mirroredSkills) {
      expect(read(`.agents/skills/${skill}/SKILL.md`)).toBe(
        read(`.claude/skills/${skill}/SKILL.md`)
      );
    }
  });

  test("rejects remote bootstrap and mutable procedure authority", () => {
    for (const skill of mirroredSkills) {
      const source = read(`.agents/skills/${skill}/SKILL.md`);
      expect(source).not.toMatch(CURL_PIPE_PATTERN);
      expect(source).not.toMatch(WGET_PIPE_PATTERN);
      expect(source).not.toContain("@latest");
      expect(source).not.toMatch(MUTABLE_PROCEDURE_PATTERN);
      expect(source).not.toMatch(UNSAFE_APPROVAL_PATTERN);
    }
  });

  test("keeps transcript discovery disabled until consent-safe local tooling exists", () => {
    const source = read(".agents/skills/convex-improve-convex-plugin/SKILL.md");
    expect(source).toContain("Transcript sharing is unavailable");
    expect(source).toContain("must not discover transcripts");
    expect(source).toContain("fresh explicit consent");
    expect(source).toContain("exact outbound manifest");
  });

  test("pins the reviewed local React Doctor playbook content", () => {
    const playbook = read("docs/agents/react-doctor-triage.md");
    expect(createHash("sha256").update(playbook).digest("hex")).toBe(
      "123d65591bddf0236e10306e8947542a24d02266aa694ee71d9754f2aaf76559"
    );
    expect(playbook).toContain("bun run doctor --");
    expect(playbook).toContain("--no-score");
  });
});
