import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkSpecPathArguments, validateSpecDocument } from "./spec-check";

const ROOT = resolve(import.meta.dir, "../..");

function fixture(name: string) {
  return readFileSync(resolve(import.meta.dir, "fixtures", name), "utf8");
}

describe("Spec readiness validator", () => {
  test("Accepts research and deferred decisions without making them executable", () => {
    for (const name of ["research-valid.md", "decision-valid.md"]) {
      const result = validateSpecDocument(fixture(name), ROOT);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.executable).toBe(false);
    }
  });

  test("Accepts approved single-ticket and ticketed multi-ticket implementations", () => {
    for (const name of ["implementation-valid.md", "implementation-multi-ticket-valid.md"]) {
      const result = validateSpecDocument(fixture(name), ROOT);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.executable).toBe(true);
    }
  });

  test("Fails closed on illegal authorization, placeholders, empty acceptance, and broken paths", () => {
    const valid = fixture("implementation-valid.md");
    const cases = [
      valid.replace("artifact_kind: implementation_spec", "artifact_kind: research"),
      valid.replace("readiness: approved", "readiness: completed"),
      valid.replace("Add the tracked contract", "TBD"),
      valid.replace(
        "- [ ] `bun run spec:check -- config/spec/fixtures/implementation-valid.md` exits zero.\n- [ ] Passing two paths is rejected before either file is read.",
        ""
      ),
      valid.replace("`docs/PLAN_MAP.md`", "`docs/does-not-exist.md`"),
      valid.replace("### Production proof", "### Deployment proof"),
    ];

    for (const source of cases) {
      expect(validateSpecDocument(source, ROOT).valid).toBe(false);
    }
  });

  test("Covers every authorization boundary without inferring approval", () => {
    const implementation = fixture("implementation-valid.md");
    const research = fixture("research-valid.md");
    const decision = fixture("decision-valid.md");
    const cases = [
      {
        source: research.replace(
          "implementation_authorized: false",
          "implementation_authorized: true"
        ),
        valid: false,
      },
      {
        source: decision.replace(
          "implementation_authorized: false",
          "implementation_authorized: true"
        ),
        valid: false,
      },
      { source: implementation.replace("readiness: approved", "readiness: draft"), valid: false },
      { source: implementation, valid: true },
      { source: implementation.replace("readiness: approved", "readiness: ticketed"), valid: true },
      {
        source: implementation.replace("readiness: approved", "readiness: completed"),
        valid: false,
      },
      {
        source: implementation.replace("readiness: approved", "readiness: superseded"),
        valid: false,
      },
      { source: implementation.replace("readiness: approved", "readiness: unknown"), valid: false },
      { source: implementation.replace("verified_revision: 1d7192c\n", ""), valid: false },
      {
        source: implementation.replace(
          "None: the local contract has no runtime dependency.",
          "Dependency is described but has no ticket reference."
        ),
        valid: false,
      },
    ];

    for (const item of cases) {
      expect(validateSpecDocument(item.source, ROOT).valid).toBe(item.valid);
    }
  });

  test("Fails closed on metadata, dependency, proof, acceptance, and UI drift", () => {
    const valid = fixture("implementation-valid.md");
    const cases = [
      valid.replace(
        "artifact_kind: implementation_spec",
        "owner: docs\nartifact_kind: implementation_spec"
      ),
      valid.replace("readiness: approved", "readiness: approved\nreadiness: ticketed"),
      valid.replace(
        'source_issue: "#168"',
        'source_issue: "https://github.com/acme/repo/pull/168"'
      ),
      valid.replace(
        "None: the local contract has no runtime dependency.",
        "- #159 establishes the owner.\n- An unnamed prose dependency remains."
      ),
      valid.replace("Focused validator tests and the exact command are required.", ""),
      valid.replace(
        "N/A: this tooling-only contract does not change a user interface.",
        "This work is tooling only."
      ),
      valid.replace("## Dependencies", "## Dependencies\n\nNone: duplicate.\n\n## Dependencies"),
      valid.replace("# Enforce spec readiness", "Enforce spec readiness"),
      valid.replace(
        "- [ ] Passing two paths is rejected before either file is read.",
        "- [ ] The feature works."
      ),
    ];

    for (const source of cases) {
      expect(validateSpecDocument(source, ROOT).valid).toBe(false);
    }
  });

  test("Accepts exactly one explicit file and never falls back to a directory scan", () => {
    expect(checkSpecPathArguments([], ROOT).result).toBeNull();
    expect(
      checkSpecPathArguments(
        ["config/spec/fixtures/research-valid.md", "config/spec/fixtures/decision-valid.md"],
        ROOT
      ).result
    ).toBeNull();
    expect(
      checkSpecPathArguments(["config/spec/fixtures/implementation-valid.md"], ROOT).result?.valid
    ).toBe(true);
  });

  test("Keeps the package command, tracked docs, UI extension, and issue intake aligned", () => {
    const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    const planMap = readFileSync(resolve(ROOT, "docs/PLAN_MAP.md"), "utf8");
    const issueTracker = readFileSync(resolve(ROOT, "docs/agents/issue-tracker.md"), "utf8");
    const uiBrief = readFileSync(resolve(ROOT, "docs/agents/ui-change-brief.md"), "utf8");
    const issueTemplate = readFileSync(
      resolve(ROOT, ".github/ISSUE_TEMPLATE/implementation-spec.md"),
      "utf8"
    );

    expect(packageJson.scripts["spec:check"]).toBe("bun config/spec/spec-check.ts");
    expect(planMap).toContain("agents/spec-handoff.md");
    expect(issueTracker).toContain("spec-handoff.md");
    for (const heading of [
      "## Surface and preserved baseline",
      "## Hierarchy and journey",
      "## Visible state contract",
      "## Viewport and input behavior",
      "## Accessibility and motion",
      "## Decisions and evidence boundary",
    ]) {
      expect(uiBrief).toContain(heading);
    }
    for (const heading of [
      "## Context and target user/job",
      "## Verified current state",
      "## Proposed behavior",
      "## Preservation constraints and out of scope",
      "## Failure modes and rollback",
      "## Acceptance criteria",
      "### Local/source proof",
      "### Preview proof",
      "### Production proof",
    ]) {
      expect(issueTemplate).toContain(heading);
    }
  });
});
