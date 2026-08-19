import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const workflow = readFileSync(resolve(root, ".github/workflows/hosted-quality.yml"), "utf8");
const ACTION_REFERENCE_PATTERN = /uses:\s+[^@\s]+@([^\s]+)/g;
const IMMUTABLE_ACTION_REFERENCE_PATTERN = /^[a-f0-9]{40}$/;
const WORKFLOW_ENVIRONMENT_PATTERN = /^\s+environment:/m;
const TEMPLATE_DOLLAR = String.fromCodePoint(36);

describe("Credential-free hosted quality workflow", () => {
  test("Pins every third-party action to an immutable commit", () => {
    const references = [...workflow.matchAll(ACTION_REFERENCE_PATTERN)].map((match) => match[1]);
    expect(references).toEqual([
      "11d5960a326750d5838078e36cf38b85af677262",
      "0c5077e51419868618aeaa5fe8019c62421857d6",
    ]);
    expect(
      references.every((reference) => IMMUTABLE_ACTION_REFERENCE_PATTERN.test(reference ?? ""))
    ).toBe(true);
  });

  test("Is read-only, cancellable, bounded, and revision-labelled", () => {
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("timeout-minutes: 30");
    expect(workflow).toContain(`${TEMPLATE_DOLLAR}{GITHUB_SHA}`);
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("fetch-depth: 0");
  });

  test("Has no secret, provider, deployment, codegen, or authenticated lane", () => {
    const normalized = workflow.toLowerCase();
    for (const forbidden of [
      "secrets.",
      "convex deploy",
      "convex codegen",
      "convex dev",
      "vercel",
      "deploy key",
      "browser_smoke_",
      "e2e_password",
    ]) {
      expect(normalized).not.toContain(forbidden);
    }
    expect(workflow).not.toMatch(WORKFLOW_ENVIRONMENT_PATTERN);
  });

  test("Runs the complete clean-clone-safe test suite and Studio gates", () => {
    expect(workflow).toContain("bun install --frozen-lockfile");
    expect(workflow).toContain("run: bun run test");
    expect(workflow).not.toContain("bun run test -- config/release config/test");
    expect(workflow).toContain("bun run assets:check");
    expect(workflow).toContain("working-directory: citius-blog");
  });
});
